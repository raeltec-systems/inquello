/** Real packaged-runtime route/storage/privacy/secret boundary. No provider inference call.
 * Missing native binary is a failed collection gate, deliberately not a passing skip.
 * The Messages TLS fixture/turn suite is in the native adapter/core tests.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppServerRuntime, resolveAppServerBinary, runtimeChildEnv, writeRuntimeConfig } from '../src/main/runtime';
import schemaStamp from '../src/protocol/schema-stamp.json';
import { recordingLogger, tempDir, removeTempDirs } from './helpers';
const desktop=path.resolve(__dirname,'..');
const binary=resolveAppServerBinary({env:process.env,isPackaged:false,resourcesPath:'',appPath:desktop});
const principal=randomUUID(),other=randomUUID(),workspace=randomUUID(),accountRef=randomUUID();
const sentinel=`sk-ant-synthetic-${randomUUID()}`;
let runtime:AppServerRuntime,root:string,taskId:string;const logger=recordingLogger();
async function bind(id:string|null){await runtime.request('inquello/session/setPrincipal',{principalId:id});}
beforeAll(async()=>{root=tempDir('routes-runtime');const home=path.join(root,'runtime');fs.mkdirSync(home,{recursive:true});writeRuntimeConfig(home);runtime=new AppServerRuntime({command:binary.path,env:runtimeChildEnv(process.env,{serviceConfigEnv:'INQUELLO_SERVICE_CONFIG',codexHome:home,workingStore:path.join(root,'private','working.sqlite')}),clientInfo:{name:'inquello_desktop',title:'route integration',version:'0.0.0-test'},schemaStamp,logger,stderrLogPath:path.join(root,'stderr.log')});await runtime.start();await bind(principal);const response=await runtime.request<{task:{taskId:string}}>('inquello/task/create',{operationId:randomUUID(),expectedRevision:0,workspaceId:workspace,engagementId:null,folderId:null,title:'Synthetic route fixture'});taskId=response.task.taskId;},30000);
afterAll(async()=>{await runtime?.stop();removeTempDirs();});
describe('real runtime processing routes',()=>{
 it('new private Task has no implicit default',async()=>{expect(await runtime.request('inquello/routes/task/read',{taskId})).toMatchObject({revision:0,selected:null});});
 it('configures pinned Messages separately from selection and credential',async()=>{expect(await runtime.request('inquello/routes/configure',{operationId:randomUUID(),expectedRevision:0,configuration:{routeId:'claude-api-key',deployment:'anthropic-direct',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',accountRef,region:null}})).toMatchObject({route:{enabled:false,credentialPresent:false,verification:'not_verified'}});});
 it('selects, replays receipt and refuses revision conflicts',async()=>{const params={operationId:randomUUID(),expectedRevision:0,taskId,routeId:'claude-api-key',configurationRevision:1};await runtime.request('inquello/routes/task/set',params);expect(await runtime.request('inquello/routes/task/set',params)).toMatchObject({revision:1,receipt:{replayed:true}});await expect(runtime.request('inquello/routes/task/set',{...params,operationId:randomUUID()})).rejects.toThrow();});
 it('other principal gets unknown, never route metadata',async()=>{await bind(other);await expect(runtime.request('inquello/routes/task/read',{taskId})).rejects.toThrow();await bind(principal);});
 it('private sentinel is never in status, traces, SQLite or child environment',async()=>{await runtime.privateRouteAuth({routeId:'claude-api-key',accountRef,generation:1,apiKey:sentinel});const state=await runtime.request('inquello/routes/task/read',{taskId});expect(JSON.stringify(state)).not.toContain(sentinel);expect(state).toMatchObject({selected:{enabled:false,verification:'not_verified',credentialPresent:true}});expect(JSON.stringify(logger.messages)).not.toContain(sentinel);if(process.platform==='linux'&&runtime.pid)expect(fs.readFileSync(`/proc/${runtime.pid}/environ`,'utf8')).not.toContain(sentinel);for(const file of fs.readdirSync(path.join(root,'private')))expect(fs.readFileSync(path.join(root,'private',file)).includes(Buffer.from(sentinel))).toBe(false);});
 it('invalidation removes volatile auth without altering Task route',async()=>{await runtime.request('inquello/routes/invalidate',{routeId:'claude-api-key',generation:2,taskId:null});expect(await runtime.request('inquello/routes/task/read',{taskId})).toMatchObject({revision:1,selected:{credentialPresent:false}});});
 it('public automated actor cannot establish reviewer provenance',async()=>{await expect(runtime.request('inquello/permissions/decide',{operationId:randomUUID(),expectedRevision:1,requestId:randomUUID(),outcome:'allowed',actorKind:'automated_reviewer',actorRef:'forged'})).rejects.toThrow();});
});
