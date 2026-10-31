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
