/** Story 1.21: real runtime + real seeded policy. No fake RPC replies.
 * Requires database/topology/runtime; provider independence also needs an isolated
 * Linux keyring. Missing prerequisites are skips, never acceptance evidence. */
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import readline from 'node:readline';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import schemaStamp from '../src/protocol/schema-stamp.json';
import { loadServiceConfig, SERVICE_CONFIG_ENV, type ServiceConfig } from '../src/main/identity/config';
import { headlessOpener } from '../src/main/identity/headless-opener';
import { IssuerClient, SharedServiceClient, httpsTransport } from '../src/main/identity/service-client';
import { IdentitySession } from '../src/main/identity/session';
import { CredentialVault } from '../src/main/identity/vault';
import { OrganiseService } from '../src/main/organise';
import { PermissionMediator, PolicyService } from '../src/main/policy';
import { AppServerRuntime, resolveAppServerBinary, runtimeChildEnv, writeRuntimeConfig, RUNTIME_OWNED_CONFIG_ARGS, type AppServerRuntimeOptions } from '../src/main/runtime';
import { CapabilityService } from '../src/main/capabilities/service';
import { CodexAccount } from '../src/main/providers';
import { fakeSafeStorage } from './identity-fakes';
import { recordingLogger, removeTempDirs, tempDir } from './helpers';

const desktop = path.resolve(__dirname, '..');
const topologyBinary =
  process.env.INQUELLO_DEV_TOPOLOGY_BIN ?? path.join(desktop, '..', 'engine', 'codex-rs', 'target', 'debug', process.platform === 'win32' ? 'inquello-dev-topology.exe' : 'inquello-dev-topology');
const appServer = resolveAppServerBinary({ env: process.env, isPackaged: false, resourcesPath: '', appPath: desktop });
const databaseConfigured = Boolean(process.env.INQUELLO_TEST_DATABASE_URL || process.env.INQUELLO_DEV_DATABASE_URL);
const onPath = (name: string) => (process.env.PATH ?? '').split(path.delimiter).some(dir => fs.existsSync(path.join(dir,name)));
const keyringTools = process.platform === 'linux' && ['dbus-run-session','gnome-keyring-daemon','secret-tool'].every(onPath);
let capabilities: CapabilityService;
let service: SharedServiceClient;
let codex: CodexAccount;
let fixture: http.Server;
let fixtureUrl: string;

const PERMISSIVE = {
  sandbox: 'workspace_write', approvals: ['on_request'], network: 'allowed',
  allowed_domains: ['127.0.0.1'], mcp_tools: 'allowed', extensions: 'denied',
  allow_local_mcp_servers: false,
};

let topology: ChildProcess | undefined;
let config: ServiceConfig;
let seed: { workspace_id: string; invite_id: string };
let runtime: AppServerRuntime;
let runtimeOptions: AppServerRuntimeOptions;
let persistedRuntimeHome: string;
let identity: IdentitySession;
let organise: OrganiseService;
let policy: PolicyService;

async function startTopology(dir: string): Promise<void> {
  if (!fs.existsSync(topologyBinary)) throw new Error(`build the dev topology first: ${topologyBinary} is missing`);
  const seedFile = path.join(dir, 'seed.json');
  const executionFile = path.join(dir, 'execution.json');
  fs.writeFileSync(executionFile, JSON.stringify(PERMISSIVE));
  topology = spawn(topologyBinary, ['--exit-on-stdin-eof', '--seed-workspace', 'Synthetic Policy Co', '--seed-out', seedFile, '--seed-execution', executionFile], {
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const lines = readline.createInterface({ input: topology.stdout! });
  const line = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the topology printed nothing')), 60_000);
    lines.once('line', (text) => {
      clearTimeout(timer);
      resolve(text);
    });
    topology!.once('exit', (code) => reject(new Error(`the topology exited (${code})`)));
  });
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, line);
  const loaded = loadServiceConfig({ [SERVICE_CONFIG_ENV]: file });
  if (loaded.kind !== 'configured') throw new Error('the topology line is not a valid config');
  config = loaded.config;
  seed = JSON.parse(fs.readFileSync(seedFile, 'utf8')) as typeof seed;
}

async function stopTopology(): Promise<void> {
  const child = topology;
  topology = undefined;
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.stdin!.end();
  await exited;
}

const ok = <T,>(result: { ok: true; value: T } | { ok: false; reason: string }): T => {
  if (!result.ok) throw new Error(`expected success, got: ${result.reason}`);
  return result.value;
};

describe.skipIf(!databaseConfigured)('capabilities against the real runtime and seeded Workspace', () => {
  beforeAll(async () => {
    const dir = tempDir('policy-int');
    fixture = http.createServer((request,response) => {
      if (request.method !== 'POST') { response.writeHead(405).end(); return; }
      let body = ''; request.on('data', chunk => {body += String(chunk);});
      request.on('end', () => {
        try {
          const message = JSON.parse(body) as {id?: number; method: string};
          if (message.id === undefined) {response.writeHead(202).end();return;}
          const result = message.method === 'initialize' ? {protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'inquello-fixture',version:'1'}} : message.method === 'tools/list' ? {tools:[{name:'fixture_echo',description:'Synthetic fixture only',inputSchema:{type:'object',properties:{}}}]} : {};
          response.writeHead(200, {'content-type':'application/json'}).end(JSON.stringify({jsonrpc:'2.0',id:message.id,result}));
        } catch {response.writeHead(400).end();}
      });
    });
    await new Promise<void>(resolve => fixture.listen(0,'127.0.0.1',resolve));
    fixtureUrl = `http://127.0.0.1:${(fixture.address() as {port:number}).port}/mcp`;
    await startTopology(dir);
    const runtimeHome = path.join(dir, 'runtime-home');
    persistedRuntimeHome = runtimeHome;
    const workingStore = path.join(dir, 'working', 'working.sqlite');
    fs.mkdirSync(runtimeHome, { recursive: true, mode: 0o700 });
    fs.mkdirSync(path.dirname(workingStore), { recursive: true, mode: 0o700 });
    writeRuntimeConfig(runtimeHome);
    const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('DBUS_') && !key.startsWith('XDG_') && key !== 'GNOME_KEYRING_CONTROL'));
    const home = path.join(dir,'home'); fs.mkdirSync(home);
    runtimeOptions = {
      command: keyringTools ? 'dbus-run-session' : appServer.path,
      commandArgsPrefix: keyringTools ? ['--','sh','-c','echo -n testpw | gnome-keyring-daemon --unlock --components=secrets >/dev/null; exec "$0" "$@"',appServer.path,...RUNTIME_OWNED_CONFIG_ARGS] : [...RUNTIME_OWNED_CONFIG_ARGS],
      env: runtimeChildEnv({...environment,HOME:home}, { serviceConfigEnv: SERVICE_CONFIG_ENV, codexHome: runtimeHome, workingStore }),
      clientInfo: { name: 'inquello_desktop', title: 'Inquello', version: '0.0.0-test' },
      schemaStamp,
      stderrLogPath: path.join(dir, 'logs', 'app-server-stderr.log'),
      logger: recordingLogger(),
    };
    runtime = new AppServerRuntime(runtimeOptions);
    await runtime.start();
    const transport = httpsTransport(config.ca);
    service = new SharedServiceClient(config.serviceUrl, transport);
    identity = new IdentitySession({
      config: { kind: 'configured', config },
      vault: new CredentialVault({ safeStorage: fakeSafeStorage('gnome_libsecret'), platform: 'linux', dir: path.join(dir, 'identity') }),
      service,
      issuer: new IssuerClient(config.issuerUrl, transport),
      openBrowser: headlessOpener(transport),
      logger: recordingLogger(),
    });
    expect((await identity.signIn()).ok).toBe(true);
    expect((await identity.withAccess((access) => service.acceptInvite(access, seed.invite_id)))?.workspace_id).toBe(seed.workspace_id);
    const organiseRuntime = { ready: () => runtime.state === 'ready', instance: () => runtime, request: <T,>(method: string, params?: unknown) => runtime.request<T>(method, params) };
    organise = new OrganiseService({ runtime: organiseRuntime, identity, service, logger: recordingLogger() });
    policy = new PolicyService({ runtime: organiseRuntime, identity, organise, service, logger: recordingLogger(), taskFolders: path.join(dir, 'tasks'), sandboxProbeTarget: path.dirname(workingStore), permissions: new PermissionMediator({ runtime: organiseRuntime, logger: recordingLogger(), newId: randomUUID }) });
    capabilities = new CapabilityService({runtime:organiseRuntime,policy,runtimeVersion:'integration-runtime',openBrowser:async () => {throw new Error('no external browser in integration fixtures');}});
    codex = new CodexAccount({runtime:organiseRuntime,openBrowser:async () => {throw new Error('no external login');},logger:recordingLogger()});
  }, 120_000);

  afterAll(async () => {
    if (codex && keyringTools) await codex.logout();
    await runtime?.stop();
    if (fixture) await new Promise<void>((resolve,reject) => fixture.close(error => error ? reject(error) : resolve()));
    await stopTopology();
    removeTempDirs();
  });

  it('lists the actual runtime inventory and refuses plugin install by policy', async () => {
    const view = await capabilities.getInventory(seed.workspace_id);
    expect(view.available, view.reason ?? '').toBe(true);
    expect(view.entries.filter(entry => entry.kind === 'built_in').length).toBeGreaterThan(0);
    const refused = await capabilities.manage({workspaceId:seed.workspace_id,kind:'plugin',id:'not-installed-fixture',action:'install'});
    expect(refused.ok).toBe(false); expect(refused.reason).toContain('extensions not allowed');
  });
  it('adds a fixture HTTP MCP, disables/enables it and removes it through runtime config', async () => {
    const input = {workspaceId:seed.workspace_id,kind:'mcp_server' as const,id:'inquello_http_fixture'};
    try {
      const added = await capabilities.manage({...input,action:'add',url:fixtureUrl});
      expect(added.ok, added.reason ?? '').toBe(true);
      expect(added.inventory.entries.find(e => e.id === input.id)).toMatchObject({installed:true,enabled:true});
      const disabled = await capabilities.manage({...input,action:'disable'});
      expect(disabled.ok, disabled.reason ?? '').toBe(true);
      expect(disabled.inventory.entries.find(e => e.id === input.id)).toMatchObject({enabled:false,callable_now:false,reason_not_callable:'Disabled by you'});
      const enabled = await capabilities.manage({...input,action:'enable'});
      expect(enabled.ok, enabled.reason ?? '').toBe(true);
      expect(enabled.inventory.entries.find(e => e.id === input.id)?.enabled).toBe(true);
    } finally {
      const removed = await capabilities.manage({...input,action:'remove'});
      expect(removed.ok, removed.reason ?? '').toBe(true);
      expect(removed.inventory.entries.some(e => e.id === input.id)).toBe(false);
    }
  }, 120_000);
  it('preserves managed MCP state across restart while enforcing owned credential settings', async () => {
    const input={workspaceId:seed.workspace_id,kind:'mcp_server' as const,id:'restart_fixture'};
    expect((await capabilities.manage({...input,action:'add',url:fixtureUrl})).ok).toBe(true);
    expect((await capabilities.manage({...input,action:'disable'})).ok).toBe(true);
    await runtime.stop();
    const file=writeRuntimeConfig(persistedRuntimeHome);
    fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('cli_auth_credentials_store = "keyring"','cli_auth_credentials_store = "file"').replace('mcp_oauth_credentials_store = "keyring"','mcp_oauth_credentials_store = "file"'));
    writeRuntimeConfig(persistedRuntimeHome);
    runtime=new AppServerRuntime(runtimeOptions);await runtime.start();
    const config=await runtime.request<{config:Record<string,unknown>}>('config/read',{includeLayers:false});
    expect(config.config.cli_auth_credentials_store).toBe('keyring');
    expect(config.config.mcp_oauth_credentials_store).toBe('keyring');
    const inventory=await capabilities.getInventory(seed.workspace_id);
    expect(inventory.entries.find(x=>x.id===input.id)).toMatchObject({installed:true,enabled:false,callable_now:false});
    expect((await capabilities.manage({...input,action:'remove'})).ok).toBe(true);
  },120_000);
  it.skipIf(!keyringTools)('provider sign-in/out changes no Workspace, membership, Engagement, review or policy', async () => {
    const task = ok(await organise.createTask({operationId:randomUUID(),workspaceId:seed.workspace_id,engagementId:null,folderId:null,title:'Provider independence fixture'}));
    const snapshot = async () => ({
      principal:identity.principalId(),
      memberships:await identity.withAccess(access => service.workspaces(access)),
      tree:await organise.getTree(seed.workspace_id),
      states:await organise.listStates(task.taskId),
      execution:await identity.withAccess(access => service.executionPolicy(access,seed.workspace_id)),
    });
    const before = await snapshot();
    const login = await codex.login({type:'apiKey',apiKey:'sk-inquello-capabilities-synthetic-'+randomUUID()});
    expect(login.ok, login.reason ?? '').toBe(true);
    expect((await codex.refresh()).state).toBe('connected');
    expect((await capabilities.getInventory(seed.workspace_id)).provider.accountType).toBe('API key');
    expect(await snapshot()).toEqual(before);
    await codex.logout(); expect((await codex.refresh()).state).toBe('not-connected');
    expect(await snapshot()).toEqual(before);
  });
});
