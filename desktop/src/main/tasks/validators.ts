import {requestId,parseAnswers} from './progress';
import {OperationError,type PayloadValidator} from '../security/operations';
import {object,uuid,identifier,integer} from '../usage/types';
import {routeId} from '../routes/types';
import type {TaskCandidateInput,StartTaskInput} from './types';
function fields(a:readonly unknown[],keys:string[]){if(a.length!==1)throw new Error();const r=object(a[0]);if(Object.keys(r).length!==keys.length||keys.some(k=>!Object.hasOwn(r,k)))throw new Error();return r;}
function safe<T>(fn:(a:readonly unknown[])=>T):PayloadValidator<T>{return a=>{try{return fn(a);}catch{throw new OperationError('Invalid private Task request');}};}
const candidate=(r:Record<string,unknown>):TaskCandidateInput=>{const configurationRevision=integer(r.configurationRevision);if(configurationRevision===0)throw new Error();return{workspaceId:uuid(r.workspaceId),routeId:routeId(r.routeId),configurationRevision};};
const keys=['workspaceId','routeId','configurationRevision'];
export const taskPreflightPayload=safe(a=>candidate(fields(a,keys)));
export const taskStartPayload=safe<StartTaskInput>(a=>{const r=fields(a,[...keys,'operationId','engagementId','folderId','request','reasoning','speed']);if(typeof r.request!=='string'||!r.request.trim()||Buffer.byteLength(r.request,'utf8')>131072||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(r.request))throw new Error();return{...candidate(r),operationId:uuid(r.operationId),engagementId:r.engagementId===null?null:uuid(r.engagementId),folderId:r.folderId===null?null:uuid(r.folderId),request:r.request,reasoning:identifier(r.reasoning),speed:identifier(r.speed)};});
export const taskReconcilePayload=safe(a=>{const r=fields(a,['operationId']);return{operationId:uuid(r.operationId)};});

export const taskActivityPayload=safe(a=>{const r=fields(a,['taskId','workspaceId']);return{taskId:uuid(r.taskId),workspaceId:uuid(r.workspaceId)};});
export const taskProgressPayload=safe(a=>{if(a.length!==1)throw new Error();const r=object(a[0]);fields(a,r.resultPage===undefined?['taskId','workspaceId']:['taskId','workspaceId','resultPage']);const base={taskId:uuid(r.taskId),workspaceId:uuid(r.workspaceId)};if(r.resultPage===undefined)return base;const p=object(r.resultPage);if(Object.keys(p).some(k=>!['snapshotId','currentOffset','historyOffset'].includes(k)))throw new Error();const offset=(v:unknown)=>{const n=v===undefined?0:integer(v);if(n>10000000)throw new Error();return n;};const currentOffset=offset(p.currentOffset),historyOffset=offset(p.historyOffset);const snapshotId=p.snapshotId===undefined?undefined:uuid(p.snapshotId);if((currentOffset||historyOffset)&&!snapshotId)throw new Error();return{...base,resultPage:{...(snapshotId?{snapshotId}:{}),currentOffset,historyOffset}};});
export const taskAnswerPayload=safe(a=>{const r=fields(a,['taskId','workspaceId','requestId','answers']);return{taskId:uuid(r.taskId),workspaceId:uuid(r.workspaceId),requestId:requestId(r.requestId),answers:parseAnswers(r.answers)};});

const lifecyclePayload=(kind:'steer'|'stop'|'resume')=>safe(a=>{const r=fields(a,kind==='stop'?['operationId','taskId','workspaceId']:['operationId','taskId','workspaceId','request']);let request:string|null=null;if(kind!=='stop'){if(r.request!==null){if(typeof r.request!=='string'||!r.request.trim()||Buffer.byteLength(r.request,'utf8')>131072||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(r.request))throw new Error();request=r.request;}if(kind==='steer'&&request===null)throw new Error();}return{operationId:uuid(r.operationId),taskId:uuid(r.taskId),workspaceId:uuid(r.workspaceId),request};});
export const taskSteerPayload=lifecyclePayload('steer');
export const taskStopPayload=lifecyclePayload('stop');
export const taskResumePayload=lifecyclePayload('resume');
