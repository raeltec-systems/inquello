/** Real PolicyService + PermissionMediator; only native/service I/O is fixture data. */
import {describe,it,expect,vi} from 'vitest';
import {PolicyService,PermissionMediator} from '../src/main/policy';
import type {OrganiseRuntime} from '../src/main/organise';
import {recordingLogger} from './helpers';
const principal='11111111-1111-4111-8111-111111111111',task='22222222-2222-4222-8222-222222222222',workspace='33333333-3333-4333-8333-333333333333',requestId='44444444-4444-4444-8444-444444444444';
function setup(mode:'allow'|'deny'|'expired'|'policy-race'|'consume-reject'|'logout'){
 let signedIn=true,revision=1,used=false,decided=false;
 const command=['/usr/bin/touch','output/allowed.txt'];
 const evaluation={decision:'prompt',controllingRule:{prefix:['/usr/bin/touch'],decision:'prompt',note:null},source:{kind:'workspace_policy',revision:1,behaviour:null,label:'Workspace rule'},cannotAsk:false,command,commandText:command.join(' '),analysis:'Write one fictional file',destination:'Task output',consequence:'One use',ruleText:'Prompt'};
 const record={requestId,taskId:task,workspaceId:workspace,origin:'runtime',label:'Permission to act',evaluation,createdAt:1,expiresAt:600001,status:'pending',revision:1,decision:null,used:false};
 const request=vi.fn(async(method:string,params?:unknown):Promise<unknown>=>{
  if(method==='inquello/broadMode/read')return{workspaceId:workspace};
  if(method==='inquello/policy/effective')return{task:{}};
  if(method==='inquello/permissions/request')return{request:record};
  if(method==='inquello/permissions/decide'){
   if(decided)throw Object.assign(new Error('not pending'),{data:{inquello:{kind:'request_not_pending'}}});decided=true;
   if(mode==='policy-race')revision++;
   if(mode==='logout')signedIn=false;
   const outcome=mode==='expired'?'expired':(params as {outcome:string}).outcome;
   return{request:{...record,decision:{outcome,actorKind:'human',actorRef:principal,decidedAt:2,label:null}}};
  }
  if(method==='inquello/tasks/consumePermission'){
   if(mode==='consume-reject'||used)throw new Error('permission already used or expired');
   used=true;return{accepted:true};
  }
  throw new Error('unexpected '+method);
 });
 const runtime:OrganiseRuntime={ready:()=>true,instance:()=>1,request:request as OrganiseRuntime['request']};
 const mediator=new PermissionMediator({runtime,logger:recordingLogger(),newId:()=>requestId,setTimer:()=>0,clearTimer:()=>undefined});
 const service=new PolicyService({runtime,permissions:mediator,identity:{principalId:()=>signedIn?principal:null,snapshot:()=>({sharedService:'available'}),withAccess:async fn=>signedIn?fn('access'):null},organise:{syncPrincipal:async()=>{},getWorkspaces:async()=>({signedIn:true,sharedService:'available',workspaces:[{workspaceId:workspace,name:'Workspace',source:'service'}],engagementCreation:{enabled:true}})},service:{executionPolicy:async()=>({workspace_id:workspace,policy_revision:String(revision),authorization_epoch:'1',execution:null})},logger:recordingLogger(),taskFolders:null,sandboxProbeTarget:null});
 return{service,request,command,mediator};
}
describe('bound runtime PolicyService permission consumption',()=>{
 it.each(['allow','deny','expired','policy-race','consume-reject','logout'] as const)('%s uses real mediator and never skips current authority or one-use consumption',async mode=>{
  const x=setup(mode);const pending=x.service.askRuntimePermission(task,x.command);
  await vi.waitFor(()=>expect(x.mediator.waiting(requestId)).toBe(true));
  if(mode==='expired')await x.mediator.expire(requestId);
  else await x.service.decidePermission({operationId:requestId,requestId,choice:mode==='deny'?'deny':'run'});
  expect(await pending).toBe(mode==='allow'?'allowed':mode==='expired'?'expired':'denied');
  const consumes=x.request.mock.calls.filter(c=>c[0]==='inquello/tasks/consumePermission');
  expect(consumes).toHaveLength(mode==='allow'||mode==='consume-reject'?1:0);
  if(mode==='allow'){
   expect(consumes[0]?.[1]).toMatchObject({taskId:task,requestId,command:x.command,workspacePolicy:{policyRevision:1}});
   await expect(x.service.decidePermission({operationId:requestId,requestId,choice:'run'})).resolves.toMatchObject({ok:false});
   expect(x.request.mock.calls.filter(c=>c[0]==='inquello/tasks/consumePermission')).toHaveLength(1);
  }
  expect(x.request.mock.calls.some(c=>c[0]==='inquello/tools/exec')).toBe(false);
 });
});
