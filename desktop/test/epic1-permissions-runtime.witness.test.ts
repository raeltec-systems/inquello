/** DIAGNOSTIC ONLY: isolated synthetic permission-denial reproduction. Not Epic acceptance. No provider credentials or model calls. */
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { smokeCatalogArgs } from '../src/main/runtime/smoke-catalog';
import { RpcResponseError } from '../src/main/runtime/errors';
import { taskFiles } from '../src/main/runtime/probe-task-files';
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
let config: ServiceConfig;
let seed: { workspace_id: string; invite_id: string };
let runtime: AppServerRuntime;
let identity: IdentitySession;
let organise: OrganiseService;
let policy: PolicyService;
let currentTaskId: string | null = null;
const knownRequests = new Set<string>();
let targetCommand: string[] = [];
let probeTarget = '';
let sequence = 0;
const trace: Array<{sequence:number;method:string;matchesCurrentTask:boolean;executionKind:'sandbox-probe'|'denied-target'|'unexpected'|null;ok:boolean;code:number|null;kind:string}> = [];
const methodLabels = ['inquello/permissions/request','inquello/permissions/pending','inquello/permissions/decide','inquello/policy/effective','inquello/tools/exec'];
async function tracedRequest<T>(method:string,params?:unknown):Promise<T> {
  const id = ++sequence;
  const p = params as {taskId?:string;requestId?:string;command?:unknown;sandboxProbeTarget?:unknown}|undefined;
  const matchesCurrentTask = !!currentTaskId && (p?.taskId===currentTaskId || (!!p?.requestId && knownRequests.has(p.requestId)));
  const label = methodLabels.includes(method) ? method : null;
  const executionKind = method !== 'inquello/tools/exec' ? null
    : matchesCurrentTask && Array.isArray(p?.command) && p.command.length === 0 && p.sandboxProbeTarget === probeTarget ? 'sandbox-probe'
    : matchesCurrentTask && JSON.stringify(p?.command) === JSON.stringify(targetCommand) && p?.sandboxProbeTarget === undefined ? 'denied-target'
    : 'unexpected';
  try {
    const value = await runtime.request<T>(method,params);
    if(label) trace.push({sequence:id,method:label,matchesCurrentTask,executionKind,ok:true,code:null,kind:'none'});
    return value;
  } catch(error) {
    const allowed=['permission_required','authority_unknown','stale_authority','not_found','invalid','store_unavailable','unauthenticated'];
    const raw=error instanceof RpcResponseError?(error.data as {inquello?:{kind?:unknown}}|null)?.inquello?.kind:null;
    const kind=typeof raw==='string'&&allowed.includes(raw)?raw:'unclassified';
    const code=error instanceof RpcResponseError&&Number.isSafeInteger(error.rpcCode)&&error.rpcCode>=-2147483648&&error.rpcCode<=2147483647?error.rpcCode:null;
    if(label)trace.push({sequence:id,method:label,matchesCurrentTask,executionKind,ok:false,code,kind});
    throw error;
  }
}


async function startTopology(dir: string): Promise<void> {
  if (!fs.existsSync(topologyBinary)) throw new Error(`build the dev topology first: ${topologyBinary} is missing`);
  const seedFile = path.join(dir, 'seed.json');
  topology = spawn(topologyBinary, ['--exit-on-stdin-eof', '--seed-workspace', 'Synthetic Permission Diagnostic Co', '--seed-out', seedFile], {
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
describe.runIf(process.env.INQUELLO_EPIC1_DIAGNOSTICS === '1')('diagnostic-only denial against the current real service-backed authority', () => {
  beforeAll(async () => {
    if (!databaseConfigured || !process.env.INQUELLO_APP_SERVER) throw new Error('Requires synthetic topology database and copied native server override');
    const dir = tempDir('epic1-permissions-diagnostic');
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
    const organiseRuntime = { ready: () => runtime.state === 'ready', instance: () => runtime, request: <T,>(method: string, params?: unknown) => tracedRequest<T>(method, params) };
    organise = new OrganiseService({ runtime: organiseRuntime, identity, service, logger: recordingLogger() });
    policy = new PolicyService({ runtime: organiseRuntime, identity, organise, service, logger: recordingLogger(), taskFolders: path.join(dir, 'tasks'), sandboxProbeTarget: path.dirname(workingStore), permissions: new PermissionMediator({ runtime: organiseRuntime, logger: recordingLogger(), newId: randomUUID, ttlMs: 20_000 }) });
  }, 120_000);

  afterAll(async () => {
    const failures: string[] = [];
    let runtimeStopped = false, topologyStopped = false;
    try { await runtime?.stop(); runtimeStopped = true; }
    catch { failures.push('runtime-stop'); }
    finally {
      try { await stopTopology(); topologyStopped = true; }
      catch { failures.push('topology-stop'); }
      finally {
        // Never erase profiles underneath a child whose exit was not established.
        if (runtimeStopped && topologyStopped) {
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

  it('correlates baseline and concurrent-read Deny receipts with only the current Task pending response', async () => {
    const rules = await policy.permissionSettings();
    expect(rules.userRules).not.toBeNull();
    ok(await policy.setUserRules({operationId:randomUUID(),expectedRevision:rules.userRules!.revision,rules:[{prefix:['/usr/bin/touch'],decision:'prompt',note:null}]}));
    for (const concurrent of [false,true]) {
      const task = ok(await organise.createTask({operationId:randomUUID(),workspaceId:seed.workspace_id,engagementId:null,folderId:null,title:'Synthetic permission diagnostic'}));
      currentTaskId=task.taskId; knownRequests.clear(); trace.length=0;
      const initialAuthority=await policy.reviewPolicy(task.taskId);
      expect(initialAuthority).not.toBeNull();
      const settings=ok(await policy.effectiveThreadSettings(task.taskId));
      const files=taskFiles(settings.folders.working,identity.principalId()!);
      const relative='output/fictional-denied-marker';
      expect(await files.read(relative)).toBeNull();
      const before=ok(await organise.listStates(task.taskId));
      targetCommand=['/usr/bin/touch',relative];
      const started=policy.runTool(task.taskId,targetCommand,{timeoutMs:30_000});
      let terminal: Awaited<typeof started> | undefined;
      const runSettled = Promise.allSettled([started]);
      let background: Promise<PromiseSettledResult<unknown>[]> = Promise.resolve([]);
      let backgroundRejected = false;
      try {
        // Bounded readiness, not a fixed sleep. Main's mediator expires at 20s.
        const deadline=Date.now()+10_000;
        let card: {requestId:string;taskId:string} | undefined;
        while(!card&&Date.now()<deadline){
          const pending=ok(await policy.pendingPermissions(task.taskId));
          card=pending.find(row=>row.taskId===task.taskId);
          if(!card)await new Promise(resolve=>setTimeout(resolve,100));
        }
        expect(!!card).toBe(true);
        if(!card)throw new Error('Synthetic permission request did not become pending');
        knownRequests.add(card.requestId);
        // Mounted Settings and Task panels issue these real read paths; none mutates policy.
        background=concurrent?Promise.allSettled([
          policy.settings(), policy.permissionSettings(), policy.inspectEnvironment(task.taskId),
          policy.reviewPolicy(task.taskId), policy.forTask(task.taskId),
        ]):Promise.resolve([]);
        const receipt=await policy.decidePermission({operationId:randomUUID(),requestId:card.requestId,choice:'deny'});
        expect(receipt.ok).toBe(true);
        if(receipt.ok)expect(receipt.value).toMatchObject({outcome:'denied',text:'Denied: nothing ran.'});
        // This is explicitly the denied Task, never a guessed attribution from aggregate stderr.
        const pendingAfter=await policy.pendingPermissions(task.taskId);
        terminal=await started;
        expect((await background).every(result=>result.status==='fulfilled')).toBe(true);
        expect(terminal).toMatchObject({ok:false,code:'permission-denied',reason:'Denied: nothing ran.'});
        expect(pendingAfter.ok).toBe(true);
        if(pendingAfter.ok)expect(pendingAfter.value).toEqual([]);
        expect(await files.read(relative)).toBeNull();
        // service.ts sandboxAvailable dispatches command:[] plus the exact probe target.
        // Do not mistake that verified sandbox bootstrap for the requested denied command.
        expect(trace.some(row=>row.executionKind==='sandbox-probe'&&row.ok)).toBe(true);
        expect(trace.some(row=>row.executionKind==='denied-target'&&!row.ok&&row.kind==='permission_required')).toBe(true);
        expect(trace.some(row=>row.method==='inquello/tools/exec'&&row.executionKind!=='sandbox-probe'&&row.ok)).toBe(false);
        expect(trace.some(row=>row.executionKind==='unexpected')).toBe(false);
        expect(await policy.reviewPolicy(task.taskId)).toEqual(initialAuthority);
        const after=ok(await organise.listStates(task.taskId));
        const approvals=(view:typeof before)=>view.dimensions.filter(row=>row.dimension==='review'||row.dimension==='approval_marker');
        expect(approvals(after)).toEqual(approvals(before));
      } finally {
        // Settle only our own pending run (the fixed mediator expiry denies by default).
        const settled = await Promise.all([runSettled, background]);
        backgroundRejected = settled.some(group => group.some(result => result.status === 'rejected'));
        console.info(JSON.stringify({scenario:concurrent?'concurrent-read-denial':'baseline-denial',trace}));
      }
      // A primary assertion/rejection wins; background failure matters only if it passed.
      if(backgroundRejected)throw new Error('Synthetic permission background work rejected');
    }
  }, 120_000);
});
