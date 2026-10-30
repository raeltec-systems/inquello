import { RpcResponseError, NotReadyError, QueueFullError } from '../runtime/errors';
import { createHash } from 'node:crypto';
import type { PolicyService } from '../policy/service';
import type { PolicyView } from '../policy/views';
import type { CodexRuntimeLink } from '../providers/codex-account';
import { entryFromFact, hostAllowed, policyRefusal, type CapabilityFact } from './rules';
import { LOCAL_MCP_CONFIRMATION, type CapabilityInput, type CapabilityInventory, type CapabilityResult } from './types';
type Obj = Record<string, unknown>;
class PendingLoginCleanupError extends Error {}
const obj = (x: unknown): Obj => x && typeof x === 'object' && !Array.isArray(x) ? x as Obj : {};
const list = (x: unknown): Obj[] => Array.isArray(x) ? x.map(obj) : [];
const requiredObject = (value: unknown): Obj => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid runtime object');
    return value as Obj;
};
const requiredList = (value: unknown): Obj[] => {
    if (!Array.isArray(value)) throw new Error('invalid runtime list');
    return value.map(requiredObject);
};
function pluginResponse(value: unknown): Obj {
    const response = requiredObject(value);
    if (response.marketplaceLoadErrors !== undefined && !Array.isArray(response.marketplaceLoadErrors)) throw new Error('invalid marketplace errors');
    for (const market of requiredList(response.marketplaces)) for (const plugin of requiredList(market.plugins)) {
        if (typeof plugin.id !== 'string' || typeof plugin.installed !== 'boolean' || typeof plugin.enabled !== 'boolean') throw new Error('invalid plugin state');
    }
    return response;
}
const str = (x: unknown, fallback = 'Not reported'): string => typeof x === 'string' ? x : fallback;
function host(x: unknown): string | undefined { try {
    return new URL(str(x)).hostname;
}
catch {
    return undefined;
} }
function origin(x: unknown): string { try {
    const u = new URL(str(x));
    return u.origin;
}
catch {
    return 'local';
} }
const unavailableProvider = () => ({ provider: 'Codex', accountType: 'Unavailable', effectiveRoute: 'No processing route configured', limits: ['Provider sign-in grants no Inquello permissions.', 'Model runs are not enabled (Story 1.25).'] });
interface Target {
    fact: CapabilityFact;
    pluginParams?: Obj;
    skillPath?: string;
    configKey?: string;
    installUrl?: string;
    managementBlock?: string;
    admissions?: Obj[] | null;
    serverName?: string;
    pluginId?: string;
}
interface Snapshot {
    view: CapabilityInventory;
    targets: Map<string, Target>;
    known: Set<string>;
}
const key = (kind: string, id: string) => `${kind}:${id}`;
export class CapabilityService {
    private generation = 0;
    private lifecycleEpoch = 0;
    private readonly logins = new Map<string, {id: string; workspaceId: string; entryId: string; pluginId?: string}>();
    private paused = false;
    private readonly unresolvedLoginStarts = new Set<string>();
    private readonly completedLogins = new Map<string, boolean>();
    private readonly expired = new Set<string>();
    private queue: Promise<unknown> = Promise.resolve();
    constructor(private readonly options: {
        runtime: CodexRuntimeLink;
        policy: Pick<PolicyService, 'forWorkspace' | 'capabilitySandboxAvailable'>;
        runtimeVersion: string;
        openBrowser(url: string): Promise<void>;
    }) { }
    handleNotification(method: string, params?: unknown): void {
        const notification = obj(params);
        if (typeof notification.name === 'string') {
            if (method === 'mcpServer/oauthLogin/completed' && typeof notification.loginId === 'string') {
                this.completedLogins.set(key(notification.name,notification.loginId),notification.success===true);
                if(this.completedLogins.size>1000) this.completedLogins.delete(this.completedLogins.keys().next().value!);
            }
            if (method === 'mcpServer/oauthLogin/completed' && notification.loginId === this.logins.get(notification.name)?.id) this.logins.delete(notification.name);
            if (String(notification.failureReason).toLowerCase().replace(/_/g, '') === 'reauthenticationrequired') this.expired.add(notification.name);
            if (notification.status === 'ready' || (method === 'mcpServer/oauthLogin/completed' && notification.success === true)) this.expired.delete(notification.name);
        }
        if (['app/list/updated', 'skills/changed', 'mcpServer/startupStatus/updated', 'mcpServerStatus', 'mcpServer/oauthLogin/completed', 'account/updated'].includes(method))
            this.generation += 1;
    }
    private unavailable(workspaceId: string, reason: string): CapabilityInventory {
        return { workspaceId, available: false, stale: true, refreshedAt: null, reason, entries: this.pendingEntries(workspaceId), provider: unavailableProvider() };
    }
    private pendingEntries(workspaceId: string) {
        return [...this.logins].filter(([, a]) => a.workspaceId === workspaceId).map(([name, a]) => ({
            kind: 'mcp_server' as const, id: a.entryId, display_name: name, source: a.pluginId ? `Plugin: ${a.pluginId}` : 'Runtime-owned sign-in', version: 'Not reported', dependencies: [], state_known: false, installed: true, enabled: false,
            callable_now: false, reason_not_callable: 'Pending runtime-owned sign-in; current capability status unavailable', effective_permission: 'Cancellation does not grant tool access', next_action: 'Cancel pending sign-in', actions: ['cancel' as const],
        }));
    }
    async getInventory(workspaceId: string): Promise<CapabilityInventory> { return (await this.snapshot(workspaceId)).view; }
    private async paged(method: string, field = 'data', params: Obj = {}, epoch = this.lifecycleEpoch): Promise<Obj[]> {
        const rows: Obj[] = [];
        const seen = new Set<string>();
        let cursor: string | undefined;
        do {
            const response = obj(await this.requestAt(epoch,method, { ...params, ...(cursor ? { cursor } : {}) }));
            if (!Array.isArray(response[field]))
                throw new Error('invalid list');
            rows.push(...requiredList(response[field]));
            cursor = typeof response.nextCursor === 'string' ? response.nextCursor : undefined;
            if (cursor && seen.has(cursor))
                throw new Error('repeated cursor');
            if (cursor)
                seen.add(cursor);
            if (seen.size > 100)
                throw new Error('inventory too large');
        } while (cursor);
        return rows;
    }
    private async snapshot(workspaceId: string): Promise<Snapshot> {
        const epoch = this.lifecycleEpoch;
        const targets = new Map<string, Target>();
        const known = new Set<string>();
        const down = (reason: string): Snapshot => ({ view: this.unavailable(workspaceId, reason), targets, known });
        if (this.paused) return down('Capability inventory is paused while the account or runtime changes');
        if (!this.options.runtime.ready())
            return down('Unavailable — runtime not running');
        const policy = await this.options.policy.forWorkspace(workspaceId);
        if (!policy.ok)
            return down(policy.reason);
        const start = this.generation;
        try {
            const facts: CapabilityFact[] = [];
            const add = (fact: CapabilityFact, extra: Omit<Target, 'fact'> = {}) => { facts.push(fact); targets.set(key(fact.kind, fact.id), { fact, ...extra }); };
            const base = (kind: CapabilityFact['kind'], id: string, name: string): CapabilityFact => ({ kind, id, display_name: name, source: 'local', version: 'Not reported', dependencies: [], installed: true, enabled: true, actions: [] });
            const failures: string[] = [];
            const read = async <T>(source: string, load: () => Promise<T>, fallback: T): Promise<T> => {
                try { const value = await load(); known.add(source); return value; }
                catch { this.assertEpoch(epoch); failures.push(`${source} unavailable — Refresh to retry`); return fallback; }
            };
            const config = await read('config', async () => {
                const config = requiredObject(requiredObject(await this.requestAt(epoch,'config/read', { includeLayers: false })).config);
                if (config.mcp_servers !== undefined) for (const server of Object.values(requiredObject(config.mcp_servers))) requiredObject(server);
                return config;
            }, {} as Obj);
            const sandbox = await this.options.policy.capabilitySandboxAvailable();
            for (const [id, name] of [['exec', 'Run commands'], ['read', 'Read files'], ['write', 'Write files']]) {
                const fact = base('built_in', id!, name!);
                fact.version = this.options.runtimeVersion;
                fact.dependencies = policy.value.reach.lines.map(x => `${x.label}: ${x.value}`);
                if (sandbox !== true)
                    fact.unavailable = sandbox === false ? 'Local sandbox unavailable on this device' : 'Local sandbox not yet checked — open a Task to check';
                if (id === 'write' && policy.value.settings.find(x => x.name === 'sandbox')?.value === 'read_only')
                    fact.unavailable = 'Blocked by Workspace policy (read-only sandbox)';
                add(fact);
            }
            const apps = await read('app catalog', () => this.paged('app/list','data',{},epoch), [] as Obj[]);
            const installedApps = await read('installed apps', async () => {
                const apps = requiredList(requiredObject(await this.requestAt(epoch,'app/installed', {})).apps);
                if (apps.some(app => typeof app.id !== 'string' || typeof app.enabled !== 'boolean')) throw new Error('invalid installed app state');
                return apps;
            }, [] as Obj[]);
            for (let n = 0; n < apps.length; n += 100)
                await read('app details', async () => requiredList(requiredObject(await this.requestAt(epoch,'app/read', { appIds: apps.slice(n, n + 100).map(x => x.id), includeTools: false })).apps), null);
            const allApps = [...apps, ...installedApps.filter(installed => !apps.some(app => app.id === installed.id))];
            for (const app of allApps) {
                const id = str(app.id, '');
                if (!id)
                    continue;
                const installed = installedApps.find(x => x.id === id);
                const fact = base('app', id, str(app.name, id));
                fact.source = 'Runtime app catalog';
                fact.version = str(obj(app.appMetadata).version);
                fact.installed = !!installed;
                fact.enabled = installed ? installed.enabled === true : app.isEnabled === true;
                fact.connection = app.isAccessible === true ? 'connected' : 'not-connected';
                // The hosted catalog reports accessibility, not which authenticated connection was used.
                // Do not infer authentication or silently select a connection from public/no-auth access.
                fact.unavailable = 'Runtime does not expose a verified connection identity or endpoint for this app';
                const catalogEntry = apps.some(item => item.id === id);
                fact.actions = !catalogEntry ? ['disable'] : known.has('installed apps') ? ['enable', 'disable', 'connect'] : ['connect'];
                if (!catalogEntry) { fact.connection = 'unknown'; fact.unavailable = 'Installed app catalog metadata unavailable; disable remains available'; }
                if (!known.has('installed apps')) { fact.stateUnknown = true; fact.unavailable = 'Installed app state unavailable'; }
                add(fact, { configKey: `apps.${JSON.stringify(id)}.enabled`, installUrl: typeof app.installUrl === 'string' ? app.installUrl : undefined });
            }
            const servers = obj(config.mcp_servers);
            for (const [name, raw] of Object.entries(servers)) {
                const server = obj(raw);
                const fact = base('mcp_server', name, name);
                fact.enabled = server.enabled !== false;
                fact.local = typeof server.command === 'string';
                fact.host = host(server.url);
                fact.source = fact.local ? 'local — Runs on this device outside the Task sandbox' : origin(server.url);
                fact.connection = 'unknown';
                fact.actions = ['enable', 'disable', 'remove', this.logins.get(name)?.workspaceId === workspaceId && this.logins.get(name)?.entryId === name ? 'cancel' : 'connect'];
                let managementBlock = (server.http_headers_helper != null || (!fact.local && (!fact.host || !/^https?:\/\//.test(str(server.url, '')))) || (fact.local && fact.host)) ? 'MCP transport is unknown; local execution and endpoint policy cannot be verified' : undefined;
                if (managementBlock) fact.unavailable = managementBlock;
                const permitted = !managementBlock && !policyRefusal('mcp_server', policy.value) && (!fact.local || policy.value.settings.some(x => String(x.name) === 'allow_local_mcp_servers' && x.value === 'allowed')) && (!fact.host || hostAllowed(fact.host, policy.value.reach.domains));
                // Status discovery can start servers. Never discover a disallowed endpoint or local process.
                if (permitted && fact.enabled && (fact.local || fact.host)) {
                    if (this.paused) throw new Error('capabilities paused');
                    try {
                    const status = (await this.paged('mcpServerStatus/list', 'data', { serverName: name, detail: 'toolsAndAuthOnly', mcpAdmission:this.admissionPolicy(policy.value,true) },epoch)).find(x => x.name === name);
                    if (status) {
                        fact.version = str(obj(status.serverInfo).version);
                        const auth = String(status.authStatus).toLowerCase().replace(/_/g, '');
                        fact.connection = auth === 'notloggedin' ? 'not-connected' : auth === 'oauth' || auth === 'bearertoken' || auth === 'unsupported' ? 'connected' : 'unknown';
                        if (status.runtimeStatus === 'authenticationRequired')
                            fact.connection = 'expired';
                        if (status.toolsError)
                            fact.unavailable = 'Runtime could not discover this server’s tools';
                        if (Object.keys(obj(status.tools)).length === 0)
                            fact.unavailable = 'No callable tools reported by runtime';
                    }
                    } catch(error) { managementBlock = this.admissionRefusal(error) ?? managementBlock; fact.unavailable=managementBlock ?? 'Runtime could not verify this server identity and policy'; }
                }
                if (this.expired.has(name)) fact.connection = 'expired';
                add(fact, { configKey: `mcp_servers.${JSON.stringify(name)}`, serverName:name, managementBlock });
            }
            const catalog = await read('plugin catalog', async () => pluginResponse(await this.requestAt(epoch,'plugin/list', {})), {} as Obj);
            const installed = await read('installed plugins', async () => pluginResponse(await this.requestAt(epoch,'plugin/installed', {})), {} as Obj);
            for (const [source, response] of [['plugin catalog',catalog], ['installed plugins',installed]] as const) {
                if (Array.isArray(response.marketplaceLoadErrors) && response.marketplaceLoadErrors.length > 0) {
                    known.delete(source); failures.push(`${source} incomplete — some marketplaces could not be read; Refresh to retry`);
                }
            }
            const installedPluginIds = new Set(list(installed.marketplaces).flatMap(market => list(market.plugins)).map(plugin => plugin.id));
            const marketplaces = [...list(installed.marketplaces), ...list(catalog.marketplaces)];
            const seen = new Set<string>();
            for (const market of marketplaces)
                for (const plugin of list(market.plugins)) {
                    const id = str(plugin.id, '');
                    if (!id || seen.has(id))
                        continue;
                    seen.add(id);
                    const remote = typeof market.path !== 'string';
                    const params = { pluginName: remote ? plugin.remotePluginId : plugin.name, ...(remote ? { remoteMarketplaceName: market.name } : { marketplacePath: market.path }) };
                    const fact = base('plugin', id, str(obj(plugin.interface).displayName, str(plugin.name, id)));
                    fact.source = str(market.name, 'Runtime marketplace');
                    fact.version = str(plugin.localVersion, str(plugin.version));
                    fact.installed = plugin.installed === true;
                    fact.enabled = plugin.enabled === true;
                    const installedStateKnown = known.has('installed plugins') || installedPluginIds.has(id);
                    fact.actions = installedStateKnown ? (fact.installed ? ['uninstall', fact.enabled ? 'disable' : 'enable'] : ['install']) : [];
                    if (!installedStateKnown) fact.unavailable = 'Installed plugin state unavailable';
                    let admissions: Obj[] | null = null;
                    let managementBlock: string | undefined;
                    try {
                        if (typeof params.pluginName !== 'string' || !params.pluginName) throw new Error('runtime did not report remote plugin identity');
                        const detail = obj(obj(await this.requestAt(epoch,'plugin/read', params)).plugin);
                        fact.dependencyRefs = [...list(detail.apps).map(x => ({kind:'app' as const,id:str(x.id, '')})), ...(Array.isArray(detail.mcpServers) ? detail.mcpServers.filter((x): x is string => typeof x === 'string').map(name=>({kind:'mcp_server' as const,id:`${id}::${name}`})) : [])];
                        fact.dependencies = [...list(detail.apps).map(x => `${str(x.name)} — ${apps.some(a => a.id === x.id && a.isAccessible === true) ? 'Connection status requires verification' : 'Not connected'}`), ...(Array.isArray(detail.mcpServers) ? detail.mcpServers.map(x => `MCP: ${str(x)}`) : [])];
                        const declared = Array.isArray(detail.mcpServers) ? detail.mcpServers : [];
                        admissions = Array.isArray(detail.mcpServerAdmissions) ? list(detail.mcpServerAdmissions) : detail.mcpServerAdmissions === undefined && declared.length === 0 ? [] : null;
                        if (admissions && declared.some(name=>!admissions!.some(a=>a.name===name))) admissions = null;
                        fact.requires_local_confirmation = admissions === null || admissions.some(a=>a.transport==='stdio');
                        if (admissions === null) fact.unavailable = 'Plugin MCP transport and endpoint admission is unknown; the runtime must inspect the actual bundle before installation or enablement';
                        else for (const admission of admissions) {
                            if (!['stdio','http'].includes(String(admission.transport)) || (admission.transport==='http' && !host(admission.httpOrigin))) managementBlock = 'Plugin MCP transport is unknown; execution.allow_local_mcp_servers and allowed_domains cannot be verified';
                        }

                        for (const name of (Array.isArray(detail.mcpServers) ? detail.mcpServers : [])) {
                            if (typeof name !== 'string') continue;
                            const dependency = base('mcp_server', `${id}::${name}`, name);
                            dependency.source = `Plugin: ${fact.display_name}`;
                            dependency.extensionOwned = true;
                            dependency.installed = fact.installed;
                            dependency.enabled = fact.enabled;
                            dependency.connection = 'unknown';
                            const admission = admissions?.find(a=>a.name===name);
                            dependency.local = admission?.transport === 'stdio';
                            dependency.host = admission?.transport === 'http' ? host(admission.httpOrigin) : undefined;
                            if (dependency.local) dependency.source += ' — Runs on this device outside the Task sandbox';
                            if (dependency.host) dependency.source = origin(admission?.httpOrigin);

                            dependency.unavailable = 'Plugin server connection has not been verified';
                            // Unknown catalog metadata is not authority: the runtime guard resolves
                            // the exact installed source/transport and checks policy before probing.
                            if (fact.installed && fact.enabled && !policyRefusal('mcp_server',policy.value) && !policyRefusal('plugin',policy.value)) {
                                if (this.paused) throw new Error('capabilities paused');
                                try {
                                    const status=(await this.paged('mcpServerStatus/list','data',{serverName:name,expectedPluginId:id,mcpAdmission:this.admissionPolicy(policy.value,true),detail:'toolsAndAuthOnly'},epoch)).find(x=>x.name===name && x.pluginId===id);
                                    if (status) {
                                        dependency.host=host(status.httpOrigin) ?? dependency.host;
                                        dependency.local=!dependency.host;
                                        dependency.source=dependency.host?origin(status.httpOrigin ?? admission?.httpOrigin):`Plugin: ${fact.display_name} — Runs on this device outside the Task sandbox`;
                                        const auth=String(status.authStatus).toLowerCase().replace(/_/g,'');
                                        dependency.connection=auth==='notloggedin'?'not-connected':['oauth','bearertoken','unsupported'].includes(auth)?'connected':'unknown';
                                        dependency.version=str(obj(status.serverInfo).version);
                                        dependency.unavailable=status.toolsError?'Runtime could not discover this server’s tools':Object.keys(obj(status.tools)).length===0?'No callable tools reported by runtime':undefined;
                                        if(status.runtimeStatus==='authenticationRequired'||this.expired.has(name))dependency.connection='expired';
                                        if(dependency.host)dependency.actions=['connect'];
                                    } else dependency.unavailable='Runtime server identity does not match this plugin; no fallback was used';
                                } catch(error) { dependency.unavailable=this.admissionRefusal(error) ?? 'Runtime could not verify the plugin server identity and policy'; }
                            }
                            const pending = this.logins.get(name);
                            if (pending?.entryId === dependency.id && pending.workspaceId === workspaceId) dependency.actions = ['cancel'];
                            add(dependency,{serverName:name,pluginId:id});
                        }
                        if (list(detail.hooks).length) managementBlock = 'Plugin hooks run outside the Task sandbox; execution is not enabled';
                    }
                    catch {
                        managementBlock = 'Plugin dependencies could not be read';
                    }
                    if (plugin.availability === 'DISABLED_BY_ADMIN' || plugin.installPolicy === 'NOT_AVAILABLE')
                        managementBlock = 'Blocked by runtime managed plugin policy';
                    if (managementBlock) fact.unavailable = managementBlock;
                    else if ((admissions !== null || (fact.dependencyRefs?.length ?? 0) > 0) && fact.installed && fact.enabled && fact.dependencyRefs?.every(dep=>facts.some(item=>item.id===dep.id && item.kind===dep.kind && item.connection==='connected' && !item.unavailable))) fact.unavailable=undefined;
                    if (!installedStateKnown) { fact.stateUnknown = true; fact.unavailable = 'Installed plugin state unavailable'; }
                    add(fact, { pluginParams: params, configKey: `plugins.${JSON.stringify(id)}.enabled`, admissions, managementBlock });
                }
            const skills = await read('skills', async () => {
                const groups = requiredList(requiredObject(await this.requestAt(epoch,'skills/list', {})).data);
                for (const group of groups) { requiredList(group.skills); if (group.errors !== undefined && !Array.isArray(group.errors)) throw new Error('invalid skill errors'); }
                return groups;
            }, [] as Obj[]);
            if (skills.some(group => Array.isArray(group.errors) && group.errors.length > 0)) {
                failures.push('Skill discovery incomplete — resolve runtime skill configuration and Refresh to retry');
                known.delete('skills');
            }
            for (const group of skills)
                for (const skill of list(group.skills)) {
                    const path = str(skill.path, '');
                    const id = createHash('sha256').update(path).digest('hex');
                    const fact = base('skill', id, str(obj(skill.interface).displayName, str(skill.name)));
                    fact.enabled = skill.enabled === true;
                    const pluginId = typeof skill.pluginId === 'string' ? skill.pluginId : undefined;
                    fact.source = pluginId ? `Plugin: ${pluginId}` : 'local';
                    fact.extensionOwned = !!pluginId;
                    fact.actions = [fact.enabled ? 'disable' : 'enable'];
                    fact.dependencyRefs = list(obj(skill.dependencies).tools).map(x => ({kind:x.type === 'app' ? 'app' : x.type === 'mcp' ? 'mcp_server' : 'unknown',id:x.type === 'mcp' && pluginId ? `${pluginId}::${str(x.value)}` : str(x.value)}));
                    fact.dependencies = fact.dependencyRefs.map(x => `${x.kind}: ${x.id}`);
                    add(fact, { skillPath: path });
                }
            const account = await read('provider session', async () => obj(obj(await this.requestAt(epoch,'account/read', { refreshToken: false })).account), {} as Obj);
            const provider = unavailableProvider();
            if (known.has('provider session')) provider.accountType = account.type === 'apiKey' ? 'API key' : account.type === 'chatgpt' ? 'ChatGPT' : Object.keys(account).length ? 'Other' : 'Not signed in';
            const stale = start !== this.generation || !this.options.runtime.ready();
            const entries = facts.map(x => entryFromFact(x, facts, policy.value));
            for (const pending of this.pendingEntries(workspaceId)) if (!entries.some(x => x.kind === pending.kind && x.id === pending.id)) entries.push(pending);
            return { targets, known, view: { workspaceId, refreshedAt: new Date().toISOString(), available: !stale, stale, reason: stale ? 'Runtime changed during refresh — refresh again' : failures.length ? failures.join('; ') : null, entries, provider } };
        }
        catch {
            return down('Unavailable — runtime inventory could not be read; Refresh to retry');
        }
    }
    /** Stop admitting changes before identity/runtime transitions; resolve pending local flows. */
    async quiesce(): Promise<boolean> {
        this.paused = true;
        const epoch = this.lifecycleEpoch;
        this.generation += 1;
        const cleanup = this.queue.then(async () => {
            let resolved = this.unresolvedLoginStarts.size === 0;
            for (const [name, attempt] of this.logins) {
                if (epoch !== this.lifecycleEpoch) return false;
                try {
                    const result = obj(await this.options.runtime.request('mcpServer/oauth/cancel', {name, loginId:attempt.id}));
                    if (['cancelled','completed','failed'].includes(String(result.status))) this.logins.delete(name);
                    else resolved = false;
                } catch { resolved = false; }
            }
            return resolved;
        });
        this.queue = cleanup.catch(() => undefined);
        return cleanup;
    }
    clearConnectionTracking(): void { this.lifecycleEpoch += 1; this.logins.clear(); this.unresolvedLoginStarts.clear(); this.completedLogins.clear(); this.expired.clear(); this.generation += 1; }
    runtimeReset(): void { this.clearConnectionTracking(); this.paused = false; }
    runtimeUnavailable(): void { this.paused = true; this.clearConnectionTracking(); }
    resume(): void { this.paused = false; }
    async manage(input: CapabilityInput): Promise<CapabilityResult> {
        if (this.paused) return {ok:false,reason:'Capability changes are paused while the account or runtime changes',inventory:this.unavailable(input.workspaceId,'Capability changes are paused')};
        // Serialize config read/modify/write sequences. Re-read policy for every action.
        const epoch = this.lifecycleEpoch;
        const run = this.queue.then(() => this.change(input,epoch));
        this.queue = run.catch(() => undefined);
        return run;
    }
    private async change(input: CapabilityInput, epoch: number): Promise<CapabilityResult> {
        const fail = async (reason: string): Promise<CapabilityResult> => ({ ok: false, reason, inventory: await this.getInventory(input.workspaceId) });
        const stale = (): CapabilityResult => ({ok:false,reason:'The account or runtime changed; start this action again',inventory:this.unavailable(input.workspaceId,'Runtime changed; refresh the current inventory')});
        if (epoch !== this.lifecycleEpoch || this.paused) return stale();
        if (!this.options.runtime.ready())
            return fail('Unavailable — runtime not running');
        // Cancelling an exact attempt is revocation, not permission to use a tool.
        // It must remain possible after policy tightens or the policy service fails.
        if (input.action === 'cancel' && input.kind === 'mcp_server') {
            const pending = [...this.logins].find(([,attempt])=>attempt.entryId===input.id);
            const serverName = pending?.[0]; const attempt = pending?.[1];
            if (!attempt || attempt.workspaceId !== input.workspaceId) return fail('No pending runtime-owned sign-in is known for this Workspace');
            try {
                const result = obj(await this.requestAt(epoch,'mcpServer/oauth/cancel', {name:serverName,loginId:attempt.id}));
                if (['cancelled','completed','failed'].includes(String(result.status))) this.logins.delete(serverName!);
                return {ok:result.status==='cancelled',reason:result.status==='cancelled'?'Runtime sign-in cancelled before credentials were stored.':result.status==='completed'?'Sign-in completed before cancellation; credentials were not revoked.':'Runtime could not confirm cancellation.',inventory:await this.getInventory(input.workspaceId)};
            } catch { return fail('Runtime could not confirm cancellation'); }
        }
        const reducesAccess = ['disable','remove','uninstall'].includes(input.action);
        let p = await this.options.policy.forWorkspace(input.workspaceId);
        if (epoch !== this.lifecycleEpoch || this.paused) return stale();
        if (!p.ok)
            return fail(p.reason);
        const blocked = policyRefusal(input.kind, p.value);
        if (blocked && !reducesAccess)
            return fail(blocked);
        const current = await this.snapshot(input.workspaceId);
        if (!current.view.available)
            return { ok: false, reason: current.view.reason, inventory: current.view };
        const target = current.targets.get(key(input.kind, input.id));
        p = await this.options.policy.forWorkspace(input.workspaceId);
        if (epoch !== this.lifecycleEpoch || this.paused) return stale();
        if (!p.ok)
            return fail(p.reason);
        const latestBlock = policyRefusal(input.kind, p.value) ?? (target?.pluginId || target?.fact.extensionOwned ? policyRefusal('plugin', p.value) : null);
        if (latestBlock && !reducesAccess)
            return fail(latestBlock);
        try {
            if (input.action === 'add') {
                if (!current.known.has('config')) return fail('MCP configuration unavailable; absence of this server cannot be verified');
                if (target)
                    return fail('An MCP server with this name already exists');
                if (input.command) {
                    if (!p.value.settings.some(x => String(x.name) === 'allow_local_mcp_servers' && x.value === 'allowed'))
                        return fail('Blocked by Workspace policy (execution.allow_local_mcp_servers is false)');
                    if (input.confirmation !== LOCAL_MCP_CONFIRMATION)
                        return fail(LOCAL_MCP_CONFIRMATION + ' Confirmation required.');
                }
                else if (!input.url || !hostAllowed(new URL(input.url).hostname, p.value.reach.domains))
                    return fail(`Host ${input.url ? new URL(input.url).hostname : 'unknown'} is not on this Workspace's allowed list`);
                await this.write(epoch,`mcp_servers.${JSON.stringify(input.id)}`, input.command ? { command: input.command, args: input.args ?? [], enabled: true } : { url: input.url, enabled: true });
                await this.requestAt(epoch,'config/mcpServer/reload');
            }
            else {
                if (!target || !target.fact.actions.includes(input.action))
                    return fail('That action is not available for this capability');
                if (!reducesAccess && target.managementBlock) return fail(target.managementBlock);
                if (reducesAccess) await this.resolveOwnedLogins(epoch, input, target);
                if (input.action === 'connect') {
                    if (input.kind === 'app') {
                        if (!target.installUrl)
                            return fail('The runtime did not provide a hosted app sign-in URL');
                        const url = new URL(target.installUrl);
                        if (url.protocol !== 'https:' || url.username || url.password)
                            return fail('The runtime did not provide a safe hosted sign-in URL');
                        this.assertEpoch(epoch);
                        await this.options.openBrowser(url.toString());
                        return { ok: false, reason: 'Provider-hosted sign-in opened in your browser. Refresh to check the runtime status. Closing this view does not cancel provider authorization or remove credentials.', inventory: await this.getInventory(input.workspaceId) };
                    }
                    if (input.kind !== 'mcp_server' || !target.fact.host)
                        return fail('OAuth sign-in is unavailable for this server');
                    if (!hostAllowed(target.fact.host, p.value.reach.domains))
                        return fail(`Host ${target.fact.host} is not on this Workspace's allowed list`);
                    const serverName=target.serverName ?? input.id;
                    if (this.unresolvedLoginStarts.has(serverName)) return fail('Runtime sign-in startup state is uncertain; restart the runtime before another sign-in');
                    this.assertEpoch(epoch);
                    this.unresolvedLoginStarts.add(serverName);
                    let result: Obj;
                    try { result = obj(await this.requestAt(epoch,'mcpServer/oauth/login', { name: serverName, timeoutSecs: 120, ...(target.pluginId?{expectedPluginId:target.pluginId}:{}),mcpAdmission:this.admissionPolicy(p.value,true) },true)); }
                    catch (error) {
                        // A returned JSON-RPC refusal (or locally unsent request) is definitive.
                        // Disconnect/timeout or malformed success remains ambiguous and requires stop.
                        if (error instanceof RpcResponseError || error instanceof NotReadyError || error instanceof QueueFullError) this.unresolvedLoginStarts.delete(serverName);
                        throw error;
                    }
                    if (typeof result.loginId !== 'string')
                        return fail('The runtime did not provide a cancellable sign-in identifier');
                    this.unresolvedLoginStarts.delete(serverName);
                    const completed = this.completedLogins.get(key(serverName,result.loginId));
                    if (completed !== undefined) return {ok:false,reason:completed?'Runtime sign-in completed before browser handoff; refreshed state is shown.':'Runtime sign-in ended before browser handoff; no pending sign-in is claimed.',inventory:await this.getInventory(input.workspaceId)};
                    this.logins.set(serverName, {id:result.loginId,workspaceId:input.workspaceId,entryId:input.id,pluginId:target.pluginId});
                    if (this.paused) {
                        const cancelled=obj(await this.revokeAt(epoch,serverName,result.loginId));
                        if(['cancelled','completed','failed'].includes(String(cancelled.status)))this.logins.delete(serverName);
                        return fail('Account or runtime is changing; no browser handoff was opened.');
                    }

                    try {
                        this.assertEpoch(epoch);
                        await this.options.openBrowser(str(result.authorizationUrl, ''));
                    }
                    catch {
                        const cancelled = obj(await this.requestAt(epoch,'mcpServer/oauth/cancel', { name: serverName, loginId: result.loginId }));
                        if (['cancelled','completed','failed'].includes(String(cancelled.status)))
                            this.logins.delete(serverName);
                        return fail('The browser could not open. Refresh to check the runtime sign-in state.');
                    }
                    return { ok: false, reason: 'Sign-in opened in your browser; authentication is not yet confirmed. You can cancel this runtime-owned sign-in.', inventory: await this.getInventory(input.workspaceId) };
                }
                else if (input.action === 'install') {
                    const admission = this.pluginAdmission(target,p.value,input.confirmation);
                    if (typeof admission === 'string') return fail(admission);
                    await this.requestAt(epoch,'plugin/install', {...target.pluginParams, skipAuthentication: true, mcpAdmission:admission});
                }
                else if (input.action === 'uninstall')
                    await this.requestAt(epoch,'plugin/uninstall', { pluginId: input.id });
                else if (input.action === 'remove') {
                    await this.write(epoch,target.configKey!, null);
                    await this.requestAt(epoch,'config/mcpServer/reload');
                }
                else {
                    const enabled = input.action === 'enable';
                    if (enabled && input.kind === 'plugin') {
                        const admission = this.pluginAdmission(target,p.value,input.confirmation);
                        if (typeof admission === 'string') return fail(admission);
                        await this.requestAt(epoch,'plugin/install',{...target.pluginParams,skipAuthentication:true,mcpAdmission:admission});
                    }

                    if (enabled && target.fact.local && !p.value.settings.some(x => String(x.name) === 'allow_local_mcp_servers' && x.value === 'allowed'))
                        return fail('Blocked by Workspace policy (execution.allow_local_mcp_servers is false)');
                    if (enabled && target.fact.host && !hostAllowed(target.fact.host, p.value.reach.domains))
                        return fail(`Host ${target.fact.host} is not on this Workspace's allowed list`);
                    if (enabled && input.kind === 'plugin') { /* Runtime install admission already applied. */ }
                    else if (input.kind === 'skill')
                        await this.requestAt(epoch,'skills/config/write', { path: target.skillPath, enabled });
                    else
                        await this.write(epoch,target.configKey! + (input.kind === 'mcp_server' ? '.enabled' : ''), enabled);
                    if (input.kind === 'mcp_server')
                        await this.requestAt(epoch,'config/mcpServer/reload');
                }
            }
            const refreshed = await this.snapshot(input.workspaceId);
            const inventory = refreshed.view;
            const actual = inventory.entries.find(x => x.kind === input.kind && x.id === input.id);
            const sourceKnown = refreshed.known.has(input.kind === 'app' ? 'installed apps' : input.kind === 'plugin' ? 'installed plugins' : input.kind === 'skill' ? 'skills' : 'config');
            const verified = inventory.available && sourceKnown && actual?.state_known !== false && (input.action === 'remove' ? refreshed.known.has('config') && !actual : input.action === 'uninstall' ? refreshed.known.has('installed plugins') && !actual?.installed : input.action === 'disable' ? actual?.enabled === false : input.action === 'enable' ? actual?.enabled === true : actual?.installed === true);
            return { ok: verified, reason: verified ? null : 'Runtime did not confirm the requested state; review the refreshed inventory', inventory };
        }
        catch (error) {
            if (epoch !== this.lifecycleEpoch) return stale();
            return fail((error instanceof PendingLoginCleanupError ? error.message : this.admissionRefusal(error)) ?? 'The runtime refused or could not complete this capability change. No success was confirmed.');
        }
    }
    private async resolveOwnedLogins(epoch: number, input: CapabilityInput, target: Target): Promise<void> {
        const owned = [...this.logins].filter(([name, a]) => input.kind === 'plugin' ? a.pluginId === input.id : input.kind === 'mcp_server' && name === (target.serverName ?? input.id) && a.entryId === input.id);
        // Never cancel another Workspace's attempt; do not disable a shared capability under it either.
        if (owned.some(([, a]) => a.workspaceId !== input.workspaceId)) throw new PendingLoginCleanupError('The capability has a pending sign-in owned by another Workspace; resolve it there before changing access');
        // An ambiguous start cannot safely be attributed to a plugin after a lost reply.
        if (this.unresolvedLoginStarts.size && (input.kind === 'plugin' || this.unresolvedLoginStarts.has(target.serverName ?? input.id))) throw new PendingLoginCleanupError('Pending sign-in startup is unresolved; restart the runtime before changing access');
        for (const [name, a] of owned) {
            const result = obj(await this.requestAt(epoch, 'mcpServer/oauth/cancel', {name, loginId:a.id}));
            if (!['cancelled','completed','failed'].includes(String(result.status))) throw new PendingLoginCleanupError('Runtime could not confirm resolution of the pending sign-in; access was not changed');
            this.logins.delete(name);
        }
    }
    private assertEpoch(epoch: number): void {
        if(epoch !== this.lifecycleEpoch || this.paused || !this.options.runtime.ready()) throw new Error('Capability lifecycle changed');
    }
    private async requestAt(epoch: number, method: string, params?: unknown, allowPausedCompletion=false): Promise<unknown> {
        this.assertEpoch(epoch);
        const result=await this.options.runtime.request(method,params);
        if (allowPausedCompletion) { if(epoch !== this.lifecycleEpoch || !this.options.runtime.ready()) throw new Error('Capability lifecycle changed'); }
        else this.assertEpoch(epoch);
        return result;
    }
    private async revokeAt(epoch:number,name:string,loginId:string):Promise<unknown> {
        if(epoch!==this.lifecycleEpoch || !this.options.runtime.ready()) throw new Error('Capability lifecycle changed');
        const result=await this.options.runtime.request('mcpServer/oauth/cancel',{name,loginId});
        if(epoch!==this.lifecycleEpoch) throw new Error('Capability lifecycle changed');
        return result;
    }
    private admissionPolicy(policy: PolicyView, localConfirmed: boolean): Obj {
        return {allowTools:!policyRefusal('mcp_server',policy),allowLocalServers:policy.settings.some(x=>String(x.name)==='allow_local_mcp_servers'&&x.value==='allowed'),localConfirmed,allowedDomains:policy.reach.domains};
    }
    private admissionRefusal(error: unknown): string | null {
        if (!(error instanceof RpcResponseError)) return null;
        const data=obj(obj(error.data).inquelloCapabilityAdmission);
        switch(data.code) {
            case 'tools_denied': return 'Blocked by Workspace policy (tools not allowed)';
            case 'local_servers_denied': return 'Blocked by Workspace policy (execution.allow_local_mcp_servers is false)';
            case 'local_confirmation_required': return LOCAL_MCP_CONFIRMATION+' Confirmation required; review the plugin and confirm explicitly.';
            case 'host_not_allowed': return typeof data.host==='string' && /^[a-zA-Z0-9.:[\]-]{1,253}$/.test(data.host) ? `Host ${data.host} is not on this Workspace's allowed list` : "Blocked by Workspace policy (allowed_domains)";
            case 'unknown_transport': return 'MCP transport is unknown; local execution and endpoint policy cannot be verified';
            case 'hooks_not_allowed': return 'Plugin hooks run outside the Task sandbox; execution is not enabled';
            case 'source_mismatch': return 'Runtime server identity does not match the selected source; no fallback was used';
            case 'inspection_unavailable': return 'Runtime could not safely inspect the actual plugin or server before admission';
            default:return null;
        }
    }
    private pluginAdmission(target: Target, policy: PolicyView, confirmation?: string): Obj | string {
        if (target.managementBlock) return target.managementBlock;
        const allowTools = !policyRefusal('mcp_server',policy);
        const allowLocalServers = policy.settings.some(x=>String(x.name)==='allow_local_mcp_servers' && x.value==='allowed');
        const localConfirmed = confirmation === LOCAL_MCP_CONFIRMATION;
        for (const a of target.admissions ?? []) {
            if (!allowTools) return policyRefusal('mcp_server',policy)!;
            if (a.transport==='stdio' && !allowLocalServers) return 'Blocked by Workspace policy (execution.allow_local_mcp_servers is false)';
            if (a.transport==='stdio' && !localConfirmed) return LOCAL_MCP_CONFIRMATION+' Confirmation required.';
            if (a.transport==='http' && !hostAllowed(host(a.httpOrigin) ?? '',policy.reach.domains)) return `Host ${host(a.httpOrigin) ?? 'unknown'} is not on this Workspace's allowed list`;
        }
        // The runtime applies these constraints again to the actual resolved bundle,
        // before enablement, refresh or provider installation, closing catalog TOCTOU.
        return {allowTools,allowLocalServers,localConfirmed,allowedDomains:policy.reach.domains};
    }
    private async write(epoch: number, keyPath: string, value: unknown): Promise<void> {
        await this.requestAt(epoch,'config/batchWrite', { edits: [{ keyPath, value, mergeStrategy: 'replace' }], reloadUserConfig: true });
    }
}
