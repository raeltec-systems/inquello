/** DIAGNOSTIC ONLY: isolated synthetic quota reproduction. Not Epic acceptance. No provider credentials or model calls. */
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { randomUUID, X509Certificate } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import https from 'node:https';
import type {AddressInfo} from 'node:net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { smokeCatalogArgs } from '../src/main/runtime/smoke-catalog';
import { RpcResponseError } from '../src/main/runtime/errors';
import { UsageService } from '../src/main/usage/service';
import schemaStamp from '../src/protocol/schema-stamp.json';
import { loadServiceConfig, SERVICE_CONFIG_ENV, type ServiceConfig } from '../src/main/identity/config';
import { headlessOpener } from '../src/main/identity/headless-opener';
import { IssuerClient, SharedServiceClient, httpsTransport } from '../src/main/identity/service-client';
import { IdentitySession } from '../src/main/identity/session';
import { CredentialVault } from '../src/main/identity/vault';
import { OrganiseService } from '../src/main/organise';
import { PermissionMediator, PolicyService } from '../src/main/policy';
import { AppServerRuntime, resolveAppServerBinary, runtimeChildEnv } from '../src/main/runtime';
import { fakeSafeStorage } from './identity-fakes';
import { removeTempDirs, removeGuestTaskStorage, tempDir } from './helpers';

// Witness-local logger deliberately never prints raw service or runtime errors.
const recordingLogger = () => ({info: (_message: string) => {}, warn: (_message: string) => {}, error: (_message: string) => {}});

const desktop = path.resolve(__dirname, '..');
const topologyBinary =
  process.env.INQUELLO_DEV_TOPOLOGY_BIN ?? path.join(desktop, '..', 'engine', 'codex-rs', 'target', 'debug', process.platform === 'win32' ? 'inquello-dev-topology.exe' : 'inquello-dev-topology');
const appServer = resolveAppServerBinary({ env: process.env, isPackaged: false, resourcesPath: '', appPath: desktop });
const databaseConfigured = Boolean(process.env.INQUELLO_TEST_DATABASE_URL || process.env.INQUELLO_DEV_DATABASE_URL);


let topology: ChildProcess | undefined;
let ownedRoot = '';
let fixtureServer: https.Server | undefined;
let fixtureEndpoint = '';
let fixtureCertificate: number[] = [];
let fixtureRequests = 0;
// Existing TLS pattern: providers-units.test.ts makeCa/fakeAnthropic, scoped to our temp root.
async function startLoopbackFixture(root:string):Promise<void> {
  const dir=path.join(root,'fixture-tls');fs.mkdirSync(dir);
  const run=(...args:string[])=>{try{execFileSync('openssl',args,{cwd:dir,stdio:'pipe',timeout:10_000});}catch{throw new Error('Owned synthetic TLS certificate generation failed');}};
  run('req','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:prime256v1','-nodes','-keyout','ca.key','-out','ca.pem','-days','1','-subj','/CN=Inquello test CA','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign');
  run('req','-newkey','ec','-pkeyopt','ec_paramgen_curve:prime256v1','-nodes','-keyout','server.key','-out','server.csr','-subj','/CN=127.0.0.1');
  fs.writeFileSync(path.join(dir,'ext.cnf'),'subjectAltName=IP:127.0.0.1\nbasicConstraints=CA:FALSE\n');
  run('x509','-req','-in','server.csr','-CA','ca.pem','-CAkey','ca.key','-CAcreateserial','-out','server.pem','-days','1','-extfile','ext.cnf');
  fixtureCertificate=Array.from(new X509Certificate(fs.readFileSync(path.join(dir,'ca.pem'))).raw);
  fixtureServer=https.createServer({key:fs.readFileSync(path.join(dir,'server.key')),cert:fs.readFileSync(path.join(dir,'server.pem'))},(request,response)=>{
    fixtureRequests++;request.resume();response.writeHead(503);response.end();
  });
  await new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Owned TLS fixture listen timed out')),5_000);
    fixtureServer!.once('error',()=>{clearTimeout(timer);reject(new Error('Owned TLS fixture failed'));});
    fixtureServer!.listen(0,'127.0.0.1',()=>{clearTimeout(timer);resolve();});
  });
  fixtureEndpoint=`https://127.0.0.1:${(fixtureServer.address() as AddressInfo).port}/v1/messages`;
}
async function stopLoopbackFixture():Promise<void> {
  const server=fixtureServer;if(!server)return;
  if(!server.listening){fixtureServer=undefined;return;}
  await new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Owned TLS fixture did not close')),5_000);
    server.close(error=>{clearTimeout(timer);error?reject(new Error('Owned TLS fixture close failed')):resolve();});
    server.closeAllConnections();
  });
  fixtureServer=undefined;
}
let config: ServiceConfig;
let seed: { workspace_id: string; invite_id: string };
let runtime: AppServerRuntime;
let identity: IdentitySession;
let organise: OrganiseService;
let policy: PolicyService;
let probeTarget = '';
// Dedicated control Workspace only. The ordinary smoke stays reviewer-off.
const QUOTA_EXECUTION = {automatic_permission_review:true,command_rules:[{prefix:['/usr/bin/true'],decision:'prompt'}]};
let diagnosticPhase: 'setup'|'prepare'|'save-defaults'|'refuse'|'post-refusal-usage'|'clear' = 'setup';
function safeRpcDiagnostic(error:unknown, method:string):string {
  const allowed=['classification_unknown','fixture_unavailable','settings_required','settings_incompatible','authority_unknown','stale_authority','not_found','invalid','permission_required','reviewer_not_available','route_unavailable','store_unavailable','unauthenticated'];
  const raw=error instanceof RpcResponseError?(error.data as {inquello?:{kind?:unknown}}|null)?.inquello?.kind:null;
  const kind=typeof raw==='string'&&allowed.includes(raw)?raw:'unclassified';
  const code=error instanceof RpcResponseError&&Number.isSafeInteger(error.rpcCode)&&error.rpcCode>=-2147483648&&error.rpcCode<=2147483647?error.rpcCode:'unknown';
  const label=['inquello/usage/read','inquello/usage/set','inquello/policy/effective','inquello/task/read','inquello/session/setPrincipal'].includes(method)?method:'other';
  return `phase=${diagnosticPhase}; method=${label}; rpcCode=${code}; kind=${kind}`;
}
const bootstrapAttempts = new Set<string>();
const targetAttempts: Array<{id:string;expected:'completed'|'failed'}> = [];
async function measuredRequest<T>(method:string,params?:unknown):Promise<T> {
  if(method!=='inquello/tools/exec') {
    try { return await runtime.request<T>(method,params); }
    catch(error) { console.info(safeRpcDiagnostic(error,method)); throw error; }
  }
  const p=params as {taskId:string;command:unknown;sandboxProbeTarget?:unknown};
  const bootstrap=Array.isArray(p.command)&&p.command.length===0&&p.sandboxProbeTarget===probeTarget;
  const target=Array.isArray(p.command)&&p.command.length===3&&p.command[0]==='/bin/sh'&&p.command[1]==='-c'&&['exit 0','exit 7'].includes(p.command[2])&&p.sandboxProbeTarget===undefined;
  if(!bootstrap&&!target)throw new Error('Unexpected synthetic quota command');
  type Ledger={usage:{attempts:Array<{snapshot:{attempt_id:string};status:string}>}};
  const before=await runtime.request<Ledger>('inquello/usage/read',{taskId:p.taskId});
  const response=await runtime.request<T>(method,params);
  const after=await runtime.request<Ledger>('inquello/usage/read',{taskId:p.taskId});
  const old=new Set(before.usage.attempts.map(row=>row.snapshot.attempt_id));
  const added=after.usage.attempts.filter(row=>!old.has(row.snapshot.attempt_id));
  expect(added.length).toBe(1);
  if(bootstrap){expect(added[0].status).toBe('completed');bootstrapAttempts.add(added[0].snapshot.attempt_id);}
  else targetAttempts.push({id:added[0].snapshot.attempt_id,expected:(p.command as string[])[2]==='exit 7'?'failed':'completed'});
  return response;
}


async function startTopology(dir: string): Promise<void> {
  if (!fs.existsSync(topologyBinary)) throw new Error(`build the dev topology first: ${topologyBinary} is missing`);
  const seedFile = path.join(dir, 'seed.json');
  const executionFile = path.join(dir, 'quota-execution.json');
  fs.writeFileSync(executionFile, JSON.stringify(QUOTA_EXECUTION));
  topology = spawn(topologyBinary, ['--exit-on-stdin-eof', '--seed-workspace', 'Synthetic Quota Diagnostic Co', '--seed-out', seedFile, '--seed-execution', executionFile], {
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  const lines = readline.createInterface({ input: topology.stdout! });
  const line = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the topology printed nothing')), 60_000);
    lines.once('line', (text) => { clearTimeout(timer); resolve(text); });
    topology!.once('exit', () => { clearTimeout(timer); reject(new Error('Synthetic topology exited before readiness')); });
    topology!.once('error', () => { clearTimeout(timer); reject(new Error('Synthetic topology failed to start')); });
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
  if (!child) return;
  const ended = () => child.exitCode !== null || child.signalCode !== null || child.pid === undefined;
  if (ended()) { topology = undefined; return; }
  const waitForExit = (ms: number): Promise<boolean> => new Promise(resolve => {
    if (ended()) { resolve(true); return; }
    const finish = (value: boolean) => { clearTimeout(timer); child.removeListener('exit', onExit); resolve(value); };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(false), ms);
    child.once('exit', onExit);
  });
  // Only this witness's spawned child; never enumerate or terminate user processes.
  child.stdin?.end();
  if (!(await waitForExit(10_000))) {
    child.kill();
    if (!(await waitForExit(5_000))) throw new Error('Owned synthetic topology did not exit; profile retained');
  }
  topology = undefined;
}

const ok = <T,>(result: { ok: true; value: T } | { ok: false; reason: string }): T => {
  if (!result.ok) throw new Error('Synthetic service operation refused');
  return result.value;
};

// Explicitly opt in: these witnesses require a copied fixture runtime and synthetic service DB.
describe.runIf(process.env.INQUELLO_EPIC1_DIAGNOSTICS === '1')('diagnostic-only quota against the current real service-backed authority', () => {
  beforeAll(async () => {
    if (!databaseConfigured || !process.env.INQUELLO_APP_SERVER) throw new Error('Requires synthetic topology database and copied native server override');
    const dir = tempDir('epic1-quota-diagnostic');
    ownedRoot=dir;
    fs.writeFileSync(path.join(dir,'.inquello-fictional-audit-session'),'explicit isolated quota fixture');
    await startLoopbackFixture(dir);
    await startTopology(dir);
    const runtimeHome = path.join(dir, 'runtime-home');
    const workingStore = path.join(dir, 'working', 'working.sqlite');
    probeTarget = path.dirname(workingStore);
    fs.mkdirSync(runtimeHome, { recursive: true, mode: 0o700 });
    fs.mkdirSync(path.dirname(workingStore), { recursive: true, mode: 0o700 });
    runtime = new AppServerRuntime({
      command: appServer.path,
    commandArgsPrefix: ['--disable-plugin-startup-tasks-for-tests', ...smokeCatalogArgs(true, false, desktop)],
      env: runtimeChildEnv(process.env, { serviceConfigEnv: SERVICE_CONFIG_ENV, codexHome: runtimeHome, workingStore }),
      clientInfo: { name: 'inquello_desktop', title: 'Inquello', version: '0.0.0-test' },
      schemaStamp,
      stderrLogPath: path.join(dir, 'logs', 'app-server-stderr.log'),
      logger: recordingLogger(),
      onServerRequest: async (method, params) => {
        if (method === 'inquello/context/authorize') return organise?.authorizeContext(params) ?? { available: false, snapshot: null, serviceEngagementIds: [] };
        if (method === 'inquello/tasks/authority') return { workspacePolicy: await policy?.startPolicy((params as { workspaceId: string }).workspaceId) ?? null };
        return undefined;
      },
    });
    await runtime.start();
    const transport = httpsTransport(config.ca);
    const service = new SharedServiceClient(config.serviceUrl, transport);
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
    const organiseRuntime = { ready: () => runtime.state === 'ready', instance: () => runtime, request: <T,>(method: string, params?: unknown) => measuredRequest<T>(method, params) };
    organise = new OrganiseService({ runtime: organiseRuntime, identity, service, logger: recordingLogger() });
    policy = new PolicyService({ runtime: organiseRuntime, identity, organise, service, logger: recordingLogger(), taskFolders: path.join(dir, 'tasks'), sandboxProbeTarget: path.dirname(workingStore), permissions: new PermissionMediator({ runtime: organiseRuntime, logger: recordingLogger(), newId: randomUUID }) });
  }, 120_000);

  afterAll(async () => {
    const failures: string[] = [];
    let runtimeStopped = false, topologyStopped = false, fixtureStopped = false;
    try { await runtime?.stop(); runtimeStopped = true; }
    catch { failures.push('runtime-stop'); }
    finally {
      try { await stopTopology(); topologyStopped = true; }
      catch { failures.push('topology-stop'); }
      finally {
        try { await stopLoopbackFixture(); fixtureStopped = true; }
        catch { failures.push('fixture-stop'); }
        // Never erase profiles underneath a child whose exit was not established.
        if (runtimeStopped && topologyStopped && fixtureStopped) {
          try { await removeGuestTaskStorage(); }
          catch { failures.push('guest-cleanup'); }
          // Retain locators if guest cleanup failed, so the owner can retry safely.
          if (!failures.length) {
            try { removeTempDirs(); }
            catch { failures.push('host-cleanup'); }
          }
        }
      }
    }
    if (failures.length) throw new Error('Synthetic witness cleanup failed: ' + failures.join(','));
  });

  it('preserves three local attempts and refuses synthetic quota with zero provider calls', async () => {
    let taskId = '';
    const usage = new UsageService({ identity, policy, runtime: {ready: () => runtime.state === 'ready', instance: () => runtime, request: <T,>(method: string, params?: unknown) => measuredRequest<T>(method, params)} });
    const request = async <T,>(method: string, params: unknown): Promise<T> => {
      try { return await runtime.request<T>(method, params); }
      catch (error) {
        const allowed = ['classification_unknown','fixture_unavailable','settings_required','settings_incompatible','authority_unknown','stale_authority','not_found','invalid','permission_required','reviewer_not_available','route_unavailable','store_unavailable','unauthenticated'];
        const rawKind = error instanceof RpcResponseError ? (error.data as {inquello?:{kind?:unknown}} | null)?.inquello?.kind : null;
        const kind = typeof rawKind === 'string' && allowed.includes(rawKind) ? rawKind : 'unclassified';
        const code = error instanceof RpcResponseError && Number.isSafeInteger(error.rpcCode) && error.rpcCode >= -2147483648 && error.rpcCode <= 2147483647 ? error.rpcCode : 'unknown';
        // No raw exception, RPC payload, account, Task ID, provider output or credentials.
        throw new Error(`Synthetic quota RPC failed [rpcCode=${code}; kind=${kind}]`);
      }
    };
    const select = async (routeId: string, model: string, expectedRevision: number) => {
      const configured = await request<{route:{revision:number;enabled:boolean;credentialPresent:boolean}}>('inquello/routes/configure', {operationId:randomUUID(),expectedRevision:0,configuration:{routeId,deployment:routeId==='claude-api-key'?'anthropic-direct':'openai-api',model,apiVersion:routeId==='claude-api-key'?'2026-10-21':'responses-v1',accountRef:randomUUID(),region:null}});
      expect(configured.route.enabled).toBe(false);
      expect(configured.route.credentialPresent).toBe(false);
      return request<{revision:number}>('inquello/routes/task/set',{operationId:randomUUID(),expectedRevision,taskId,routeId,configurationRevision:configured.route.revision});
    };
    const saveDefaults = async () => {
      const before = ok(await usage.forTask(taskId));
      expect(before.capabilities.available).toBe(true);
      const after = ok(await usage.set({taskId,operationId:randomUUID(),expectedRevision:before.usage.settings?.revision??0,routeRevision:before.capabilities.routeRevision,reasoning:'default',speed:'default'}));
      expect(after.usage.settings?.route_revision).toBe(after.capabilities.routeRevision);
    };
    await organise.syncPrincipal();
    expect(await request('inquello/tasks/bootstrap',{workspaceId:seed.workspace_id,isolatedRoot:ownedRoot})).toMatchObject({accepted:true});
    const initialConfiguration={routeId:'claude-api-key',deployment:'anthropic-direct',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',accountRef:identity.principalId(),region:null};
    expect(await request('inquello/routes/configure',{operationId:randomUUID(),expectedRevision:0,configuration:initialConfiguration})).toMatchObject({route:{revision:1,credentialPresent:false}});
    expect(await request('inquello/fixture/taskTransport',{workspaceId:seed.workspace_id,configurationRevision:1,routeId:'claude-api-key',endpoint:fixtureEndpoint,certificate:fixtureCertificate,failBeforeSampling:true})).toMatchObject({accepted:true,providerCalls:0});
    const initialPolicy=await policy.startPolicy(seed.workspace_id);
    expect(initialPolicy).not.toBeNull();
    const operationId=randomUUID();
    type Run={taskId:string;status:string;threadId:string|null};
    let run=await request<Run>('inquello/tasks/start',{operationId,workspaceId:seed.workspace_id,engagementId:null,folderId:null,request:'Fictional quota validation only. No customer data.',routeId:'claude-api-key',configurationRevision:1,reasoning:'default',speed:'default',workspacePolicy:initialPolicy});
    taskId=run.taskId;
    expect(typeof taskId).toBe('string');expect(run.threadId).not.toBeNull();
    const deadline=Date.now()+30_000;
    while(!['failed','setup-failed','completed','cancelled','uncertain'].includes(run.status)&&Date.now()<deadline){
      await new Promise(resolve=>setTimeout(resolve,50));
      run=await request<Run>('inquello/tasks/reconcile',{operationId});
    }
    expect(run.status).toBe('failed');
    expect(fixtureRequests).toBe(0);
    // Native start reservation?not a renderer assertion?established trusted Synthetic.
    const initialAttempts=ok(await usage.forTask(taskId)).usage.attempts;
    expect(initialAttempts.every(row=>row.snapshot.operation_kind==='human-requested-model'&&['failed','cancelled','uncertain'].includes(row.status))).toBe(true);
    const selected=await request<{revision:number}>('inquello/routes/task/read',{taskId});
    await saveDefaults();
    for (const exit of ['0','7','0']) expect((await policy.runTool(taskId,['/bin/sh','-c',`exit ${exit}`],{timeoutMs:30_000})).ok).toBe(true);
    const retained = ok(await usage.forTask(taskId)).usage.attempts;
    expect(targetAttempts).toHaveLength(3);
    expect(bootstrapAttempts.size).toBeGreaterThanOrEqual(1);
    expect(retained.length).toBe(initialAttempts.length+targetAttempts.length+bootstrapAttempts.size);
    for(const previous of initialAttempts)expect(retained.find(row=>row.snapshot.attempt_id===previous.snapshot.attempt_id)).toEqual(previous);
    for(const target of targetAttempts)expect(retained.find(row=>row.snapshot.attempt_id===target.id)?.status).toBe(target.expected);
    for(const id of bootstrapAttempts)expect(retained.find(row=>row.snapshot.attempt_id===id)?.status).toBe('completed');
    expect(retained.filter(row=>!initialAttempts.some(old=>old.snapshot.attempt_id===row.snapshot.attempt_id)).every(row=>row.snapshot.operation_kind==='local-tool')).toBe(true);
    await select('codex-responses','fixture-model-20261030',selected.revision);
    const workspacePolicy = await policy.reviewPolicy(taskId);
    expect(workspacePolicy).not.toBeNull();
    // Service wire omits absent optional fields; native compares JSON values structurally.
    // This must match the handler's replacement EXACTLY, not merely enable review.
    expect(JSON.parse(JSON.stringify(workspacePolicy!.execution))).toEqual(QUOTA_EXECUTION);
    const fixture = (phase: string) => request<{accepted:boolean;providerCalls:number;retainedAttempts?:number;refused?:boolean}>('inquello/fixture/messagesTurn',{scenario:'usage-limit',phase,taskId,workspacePolicy});
    try {
      diagnosticPhase='prepare';
      expect(await fixture('prepare')).toMatchObject({accepted:true,providerCalls:0});
      diagnosticPhase='save-defaults';
      await saveDefaults();
      expect(await policy.reviewPolicy(taskId)).toEqual(workspacePolicy);
      diagnosticPhase='refuse';
      const refused = await fixture('refuse');
      expect(refused).toMatchObject({accepted:true,refused:true,providerCalls:0,retainedAttempts:retained.length});
      diagnosticPhase='post-refusal-usage';
      const afterResult=await usage.forTask(taskId);
      if(!afterResult.ok){
        const code=['unavailable','changed','conflict'].includes(afterResult.code)?afterResult.code:'unclassified';
        throw new Error(`Synthetic usage refused [phase=${diagnosticPhase}; code=${code}]`);
      }
      const after=afterResult.value;
      for (const previous of retained) expect(after.usage.attempts.find(row=>row.snapshot.attempt_id===previous.snapshot.attempt_id)).toEqual(previous);
      expect(after.usage.attempts).toHaveLength(retained.length+1);
      expect(after.usage.attempts.filter(row=>row.snapshot.operation_kind==='automated-permission-review')).toMatchObject([{status:'refused'}]);
      expect(after.limits.status).toBe('exhausted');
      expect(fixtureRequests).toBe(0);
      expect(await policy.reviewPolicy(taskId)).toEqual(workspacePolicy);
    } finally { diagnosticPhase='clear'; await fixture('clear'); expect(fixtureRequests).toBe(0); }
  }, 180_000);
});
