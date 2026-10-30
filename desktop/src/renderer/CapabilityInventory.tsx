import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { capabilitiesBridge, KINDS, parseInventory, type CapabilityAction, type CapabilityKind, type CapabilityRequest, type Inventory } from './capabilities-bridge';
import { Button, TextField } from './primitives';

const HEADINGS: Record<CapabilityKind, string> = { built_in: 'Built-in tools', app: 'Apps', mcp_server: 'MCP servers', plugin: 'Plugins', skill: 'Skills' };
const VERBS: Record<CapabilityAction, string> = { install: 'Install', uninstall: 'Uninstall', enable: 'Enable', disable: 'Disable', connect: 'Connect', cancel: 'Cancel sign-in for', remove: 'Remove' };
export const LOCAL_MCP_CONFIRMATION = 'This program runs on this device outside the Task sandbox.';

export function CapabilityInventory({ workspaceId, workspaceName }: { workspaceId: string; workspaceName: string }): ReactElement {
  const bridge = capabilitiesBridge();
  const [storedView, setView] = useState<Inventory | null>(null);
  const view = storedView?.workspaceId === workspaceId ? storedView : null;
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [transport, setTransport] = useState<'remote' | 'local'>('remote');
  const [endpoint, setEndpoint] = useState('');
  const [args, setArgs] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [pendingLocalPlugin, setPendingLocalPlugin] = useState<{request:CapabilityRequest;name:string}|null>(null);
  // A scope owns its own queue. An old Workspace's work cannot block or replace
  // the new Workspace, including when a notification arrives during a mutation.
  const scopeRef = useRef<{
    workspaceId: string; active: boolean; revision: number;
    loading: boolean; mutating: boolean; queued: boolean;
    refresh: () => void;
  } | null>(null);
  useEffect(() => {
    const scope = { workspaceId, active: true, revision: 0, loading: false, mutating: false, queued: false, refresh: () => {} };
    scopeRef.current = scope;
    setView(null); setNotice(null); setFailed(false); setBusy(false);
    setPendingLocalPlugin(null); setName(''); setTransport('remote');
    setEndpoint(''); setArgs(''); setConfirmed(false);
    const drain = async () => {
      if (!bridge || !scope.active || scope.loading || scope.mutating) return;
      scope.queued = false; scope.loading = true;
      const revision = scope.revision;
      try {
        const next = parseInventory(await bridge.getInventory({ workspaceId }));
        if (!scope.active || revision !== scope.revision) return;
        if (!next || next.workspaceId !== workspaceId) { setFailed(true); return; }
        setView(next); setFailed(false);
      } catch { if (scope.active && revision === scope.revision) setFailed(true); }
      finally {
        scope.loading = false;
        if (scope.active && scope.queued) void drain();
      }
    };
    scope.refresh = () => {
      if (!scope.active) return;
      ++scope.revision; scope.queued = true;
      // Known invalidation is stale immediately, not after the next RPC resolves.
      setFailed(true);
      void drain();
    };
    void drain();
    const timer = setInterval(scope.refresh, 30_000);
    const unsubscribe = bridge?.onChanged?.(scope.refresh);
    return () => { scope.active = false; clearInterval(timer); unsubscribe?.(); };
  }, [bridge, workspaceId]);
  const load = () => { if (scopeRef.current?.workspaceId === workspaceId) scopeRef.current.refresh(); };
  const manage = async (request: CapabilityRequest) => {
    const scope = scopeRef.current;
    if (!bridge || !scope?.active || scope.workspaceId !== workspaceId || request.workspaceId !== workspaceId || scope.mutating) return;
    if (request.action !== 'cancel' && (!view?.available || failed || view.stale)) return;
    scope.mutating = true;
    const revision = ++scope.revision;
    setBusy(true); setNotice(null); setFailed(true);
    try {
      const raw = await bridge.manage(request) as { ok?: unknown; reason?: unknown; inventory?: unknown };
      if (!scope.active || scope !== scopeRef.current) return;
      // Keep the same-Workspace operation outcome even when its inventory was
      // invalidated by a notification; the queued refresh owns newer state.
      setNotice(typeof raw?.reason === 'string' ? raw.reason : raw?.ok === true ? 'Runtime state refreshed.' : 'The change could not be verified.');
      if (revision !== scope.revision) return;
      const next = parseInventory(raw?.inventory);
      if (next && next.workspaceId === workspaceId) { setView(next); setFailed(false); }
      else setFailed(true);
      // A successful RPC is not an optimistic inventory update. Only main's reread is displayed.
      setNotice(typeof raw?.reason === 'string' ? raw.reason : raw?.ok === true && next ? 'Runtime state refreshed.' : 'The change could not be verified.');
    } catch {
      if (scope.active && scope === scopeRef.current) {
        setNotice('The change could not be verified. Refresh to check the runtime state.'); setFailed(true);
      }
    } finally {
      scope.mutating = false;
      if (scope.active && scope === scopeRef.current) {
        setBusy(false);
        if (scope.queued) scope.refresh();
      }
    }
  };
  const add = (event: FormEvent) => {
    event.preventDefault();
    if (transport === 'local' && !confirmed) { setNotice(LOCAL_MCP_CONFIRMATION + ' Confirm before adding.'); return; }
    let words: string[] = [];
    if (transport === 'local' && args.trim()) {
      try { const parsed: unknown = JSON.parse(args); if (!Array.isArray(parsed) || !parsed.every(v => typeof v === 'string')) throw new Error(); words = parsed; }
      catch { setNotice('Arguments must be a JSON array of strings.'); return; }
    }
    void manage({ workspaceId, action:'add', kind:'mcp_server', id:name, ...(transport === 'remote' ? {url:endpoint} : {command:endpoint,args:words,confirmation:LOCAL_MCP_CONFIRMATION}) });
  };
  const stale = failed || view?.stale === true;
  const current = view?.available === true && !stale;
  return <section className="specimen-policy" aria-label={`Tools and connections for ${workspaceName}`} data-capabilities-section data-capabilities-loaded={String(view !== null)}>
    <h3 className="specimen-policy-heading">Tools and connections</h3>
    <p>Changes here are governed by this Workspace's policy. Installing a plugin does not connect its apps or grant credentials.</p>
    <Button onPress={() => void load()}>{`Refresh tools and connections for ${workspaceName}`}</Button>
    {!bridge ? <p>Tools and connections are available in the desktop app only.</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {failed ? <p role="status">Inventory unavailable. Previously read entries are not current.</p> : null}
    {view?.reason ? <p role="status">{view.reason}</p> : null}
    {view?.refreshedAt ? <p>{`${stale ? 'Stale inventory — last read' : 'Last refreshed'}: ${view.refreshedAt}`}</p> : null}
    {view ? <>
      <section aria-label="Provider session" data-provider-session>
        <h4>Provider session — separate from your Inquello identity</h4>
        <dl><dt>Provider</dt><dd>{view.provider.provider}</dd><dt>Account type</dt><dd>{view.provider.accountType}</dd><dt>Effective route</dt><dd>{view.provider.effectiveRoute}</dd></dl>
        <ul>{view.provider.limits.map((limit, i) => <li key={i}>{limit}</li>)}</ul>
        <p>Provider sign-in does not change your Workspaces, Engagements, memberships, reviews or policies.</p>
      </section>
      {KINDS.map(kind => <section key={kind} aria-label={HEADINGS[kind]} data-capability-kind={kind}>
        <h4>{HEADINGS[kind]}</h4>
        <ul>{view.entries.filter(entry => entry.kind === kind).map(entry => <li key={entry.id} data-inventory-entry={entry.id}>
          <h5>{entry.display_name}</h5>
          <dl><dt>Source</dt><dd>{entry.source}</dd><dt>Version</dt><dd>{entry.version ?? 'Not reported by runtime'}</dd><dt>Dependencies</dt><dd>{entry.dependencies.length ? entry.dependencies.join('; ') : 'None reported'}</dd><dt>Effective permission</dt><dd>{entry.effective_permission}</dd></dl>
          <p>{entry.state_known === false ? 'Installation state unavailable' : entry.installed ? 'Installed' : 'Available — not installed'}; {entry.state_known === false ? 'Enablement state unavailable' : entry.enabled ? 'Enabled' : 'Disabled'}; {current && entry.callable_now ? 'Callable now' : 'Not callable now'}.</p>
          {entry.reason_not_callable ? <p>{entry.reason_not_callable}</p> : null}
          {entry.next_action ? <p>{`Next action: ${entry.next_action}`}</p> : null}
          {entry.actions.map(action => <Button key={action} pending={busy} disabledReason={!current && action !== 'cancel' ? 'Refresh a current runtime inventory before making changes.' : undefined} onPress={() => { const request={workspaceId,action,kind,id:entry.id}; if(entry.requires_local_confirmation && (action==='install'||action==='enable')) setPendingLocalPlugin({request,name:entry.display_name}); else void manage(request); }}>{`${VERBS[action]} ${entry.display_name}${kind === 'plugin' ? ' plugin' : ''}`}</Button>)}
        </li>)}</ul>
        {!view.entries.some(entry => entry.kind === kind) ? <p>None reported by runtime.</p> : null}
      </section>)}
    </> : null}
    {pendingLocalPlugin?.request.workspaceId === workspaceId ? <section role="alertdialog" aria-label={`Confirm local MCP programs for ${pendingLocalPlugin.name}`}>
      <p>{LOCAL_MCP_CONFIRMATION}</p><p>{`The ${pendingLocalPlugin.name} plugin declares or may contain local MCP programs.`}</p>
      <Button disabledReason={!current ? 'Refresh a current runtime inventory before making changes.' : undefined} onPress={() => {const pending=pendingLocalPlugin;setPendingLocalPlugin(null);void manage({...pending.request,confirmation:LOCAL_MCP_CONFIRMATION});}}>{`Confirm ${pendingLocalPlugin.request.action} ${pendingLocalPlugin.name} plugin`}</Button>
      <Button onPress={() => setPendingLocalPlugin(null)}>Cancel plugin change</Button>
    </section> : null}
    {bridge ? <form onSubmit={add} aria-label="Add MCP server" className="specimen-account-form">
      <h4>Add MCP server</h4>
      <TextField label="MCP server name" value={name} onChange={setName} />
      <label>Connection type <select value={transport} onChange={event => {setTransport(event.target.value === 'local' ? 'local' : 'remote');setEndpoint('');setConfirmed(false);}}><option value="remote">Remote HTTP server</option><option value="local">Local program (stdio)</option></select></label>
      <TextField label={transport === 'remote' ? 'MCP server URL' : 'Program to run'} value={endpoint} onChange={value => {setEndpoint(value);setConfirmed(false);}} />
      {transport === 'local' ? <><TextField label="Program arguments (JSON array)" value={args} onChange={value => {setArgs(value);setConfirmed(false);}} /><label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />{LOCAL_MCP_CONFIRMATION}</label></> : null}
      <Button type="submit" pending={busy} disabledReason={!current ? 'A current runtime inventory is required.' : undefined}>{`Add ${name || 'new'} MCP server`}</Button>
    </form> : null}
  </section>;
}
