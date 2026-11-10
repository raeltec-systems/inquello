/** Source-owned bounded projection. Never hand-edit generated protocol bindings. */
export interface UsageChoices { reasoning: string; speed: string }
export interface UsageSettings { revision:number; route_revision:number; choices:UsageChoices }
export interface Consumption { input_tokens:number|null; output_tokens:number|null; cache_read_tokens:number|null; cache_write_tokens:number|null; cost:string|null; currency:string|null; provenance:string|null }
export interface UsageAttempt {
  snapshot:{attempt_id:string;task_id:string;run_id:string;operation_kind:'human-requested-model'|'automated-permission-review'|'local-tool';route_id:string|null;model:string|null;api_version:string|null;configuration_revision:number;route_revision:number;settings_revision:number;requested:UsageChoices;effective:UsageChoices;started_at_ms:number};
  status:'running'|'completed'|'failed'|'cancelled'|'uncertain'|'refused';ended_at_ms:number|null;elapsed_ms:number|null;output_ref:string|null;usage:Consumption;
}
export interface TaskUsageView {taskId:string;usage:{settings:UsageSettings|null;attempts:UsageAttempt[]};capabilities:{reasoning:string[];speeds:string[];routeRevision:number;available:boolean;reason:string};limits:{source:string;status:'unknown'|'unsupported'|'exhausted'|'available'|'unavailable';reason:string;nextAction:string}}
export interface SetUsageInput {taskId:string;operationId:string;expectedRevision:number;routeRevision:number;reasoning:string;speed:string}
export type UsageResult = {ok:true;value:TaskUsageView}|{ok:false;reason:string;code:'unavailable'|'changed'|'conflict'};
function bad():never {throw new Error('Usage information unavailable');}
export function object(v:unknown):Record<string,unknown> {if(!v||typeof v!=='object'||Array.isArray(v))return bad();return v as Record<string,unknown>;}
export function identifier(v:unknown):string {if(typeof v!=='string'||!/^[a-zA-Z0-9._:-]{1,128}$/.test(v)||v.startsWith('sk-'))return bad();return v;}
export function uuid(v:unknown):string {if(typeof v!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v))return bad();return v;}
export function integer(v:unknown):number {if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)return bad();return v;}
function text(v:unknown,max=1024):string {if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))return bad();return v;}
const nullable=<T>(v:unknown,parse:(v:unknown)=>T):T|null=>v===null?null:parse(v);
const choices=(v:unknown):UsageChoices=>{const r=object(v);return{reasoning:identifier(r.reasoning),speed:identifier(r.speed)};};
function vocabulary<T extends string>(v:unknown,values:readonly T[]):T {if(typeof v!=='string'||!values.includes(v as T))return bad();return v as T;}
/** Explicit projection drops prompts, credentials, events and native account/runtime IDs. */
export function parseTaskUsage(value:unknown,principal?:string):TaskUsageView {
 const v=object(value),taskId=uuid(v.taskId),u=object(v.usage),c=object(v.capabilities),l=object(v.limits);
 const settings=u.settings===null?null:(()=>{const s=object(u.settings);return{revision:integer(s.revision),route_revision:integer(s.route_revision),choices:choices(s.choices)};})();
 if(!Array.isArray(u.attempts)||u.attempts.length>100)return bad();
 const attempts=u.attempts.map((row):UsageAttempt=>{
  const a=object(row),s=object(a.snapshot),usage=object(a.usage);if(uuid(s.task_id)!==taskId||(principal!==undefined&&s.principal_id!==principal))return bad();
  const cost=nullable(usage.cost,v=>{const s=text(v,64);if(!/^\d+(\.\d+)?$/.test(s))return bad();return s;});
  const currency=nullable(usage.currency,v=>{const s=text(v,3);if(!/^[A-Z]{3}$/.test(s))return bad();return s;});
  const provenance=nullable(usage.provenance,v=>text(v,128));if(cost!==null&&(!currency||!provenance))return bad();
  const kind=vocabulary(s.operation_kind,['human-requested-model','automated-permission-review','local-tool'] as const);
  const result:UsageAttempt={snapshot:{attempt_id:uuid(s.attempt_id),task_id:taskId,run_id:identifier(s.run_id),operation_kind:kind,route_id:nullable(s.route_id,identifier),model:nullable(s.model,identifier),api_version:nullable(s.api_version,identifier),configuration_revision:integer(s.configuration_revision),route_revision:integer(s.route_revision),settings_revision:integer(s.settings_revision),requested:choices(s.requested),effective:choices(s.effective),started_at_ms:integer(s.started_at_ms)},status:vocabulary(a.status,['running','completed','failed','cancelled','uncertain','refused'] as const),ended_at_ms:nullable(a.ended_at_ms,integer),elapsed_ms:nullable(a.elapsed_ms,integer),output_ref:nullable(a.output_ref,v=>text(v,256)),usage:{input_tokens:nullable(usage.input_tokens,integer),output_tokens:nullable(usage.output_tokens,integer),cache_read_tokens:nullable(usage.cache_read_tokens,integer),cache_write_tokens:nullable(usage.cache_write_tokens,integer),cost,currency,provenance}};
  if(result.ended_at_ms!==null&&result.ended_at_ms<result.snapshot.started_at_ms)return bad();
  if(kind==='local-tool'&&[result.usage.input_tokens,result.usage.output_tokens,result.usage.cache_read_tokens,result.usage.cache_write_tokens].some(n=>n!==null))return bad();
  return result;
 });
 const list=(v:unknown):string[]=>{if(!Array.isArray(v)||v.length>32)return bad();const a=v.map(identifier);if(new Set(a).size!==a.length)return bad();return a;};
 if(typeof c.available!=='boolean')return bad();
 const capabilities={reasoning:list(c.reasoning),speeds:list(c.speeds),routeRevision:integer(c.routeRevision),available:c.available,reason:text(c.reason)};
 if(capabilities.available&&(!capabilities.reasoning.length||!capabilities.speeds.length))return bad();
 return{taskId,usage:{settings,attempts},capabilities,limits:{source:text(l.source,128),status:vocabulary(l.status,['unknown','unsupported','exhausted','available','unavailable'] as const),reason:text(l.reason),nextAction:text(l.nextAction)}};
}
