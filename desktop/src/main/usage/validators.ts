import {OperationError,type PayloadValidator} from '../security/operations';
import {object,uuid,integer,identifier,type SetUsageInput} from './types';
function fields(args:readonly unknown[],keys:string[]):Record<string,unknown>{if(args.length!==1)throw new Error();const r=object(args[0]);if(Object.keys(r).length!==keys.length||keys.some(k=>!Object.hasOwn(r,k)))throw new Error();return r;}
const safe=<T>(parse:(a:readonly unknown[])=>T):PayloadValidator<T>=>args=>{try{return parse(args);}catch{throw new OperationError('Invalid Task usage request');}};
export const usageReadPayload=safe(args=>{const r=fields(args,['taskId']);return{taskId:uuid(r.taskId)};});
export const usageSetPayload=safe<SetUsageInput>(args=>{const r=fields(args,['taskId','operationId','expectedRevision','routeRevision','reasoning','speed']);return{taskId:uuid(r.taskId),operationId:uuid(r.operationId),expectedRevision:integer(r.expectedRevision),routeRevision:integer(r.routeRevision),reasoning:identifier(r.reasoning),speed:identifier(r.speed)};});
