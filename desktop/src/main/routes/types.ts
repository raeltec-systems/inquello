/** Source-owned presentation contract. Genuine runtime schema generation remains required. */
export type RouteId = 'codex-responses' | 'claude-api-key';
export interface RouteConfiguration { routeId: RouteId; deployment: string; model: string; apiVersion: string; accountRef: string; region: string | null }
export interface RouteView {
  routeId: string; provider: string; configurable: boolean; configuration: RouteConfiguration | null; endpoint: string | null;
  revision: number; credentialPresent: boolean; adapterSupported: boolean; verification: 'not_verified' | 'verified_for_synthetic' | 'verified_for_real_data';
  enabled: boolean; gate: string | null; limits: string[]; evidence: string[]; executionFlow: string; inferenceFlow: string; connectorFlow: string;
}
export interface ModelDisclosureBinding {routeId:RouteId;configurationRevision:number;active:boolean}
export interface TaskRouteView { disclosureBindings:ModelDisclosureBinding[]; taskId: string; workspaceId: string; revision: number; configurationRevision: number | null; staleConfiguration: boolean; selected: RouteView | null }
export type RouteResult<T> = { ok: true; value: T } | { ok: false; reason: string; code?:'conflict'|'refused' };
export interface ConfigureRouteInput { operationId: string; expectedRevision: number; routeId: RouteId; deployment: string; model: string; apiVersion: string; region: string | null }
export interface SelectRouteInput { operationId: string; expectedRevision: number; taskId: string; routeId: RouteId; configurationRevision: number }
export interface ModelChoice {choiceId:string;provider:string;name:string;accountAccess:string;qualification:string}
export interface ModelBinding {bindingId:string;provider:string;name:string;routeId:RouteId;configurationRevision:number;state:'active'|'revoked'|'legacy-superseded';stateRevision:number;accountAccess:string;qualification:string;available:boolean;reason:string|null}
export interface ModelCatalog {catalogVersion:string;choices:ModelChoice[];bindings:ModelBinding[]}
export interface ResolveModelInput {operationId:string;catalogVersion:string;choiceId:string}
export interface BindingStateInput {operationId:string;bindingId:string;expectedRevision:number;state:'active'|'revoked'}
export interface SelectModelInput {operationId:string;taskId:string;expectedRevision:number;bindingId:string}
export type PendingModelOperation = {kind:'resolve';input:ResolveModelInput}|{kind:'select';input:SelectModelInput}|{kind:'state';input:BindingStateInput};
export function parsePendingModelOperation(value:unknown):PendingModelOperation|null {if(value===null)return null;const r=record(value),input=record(r.input);const uuid=(value:unknown)=>{const s=text(value);if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(s))throw new Error('Invalid model operation reference');return s;};const operationId=uuid(input.operationId);if(r.kind==='resolve')return{kind:'resolve',input:{operationId,catalogVersion:opaque(input.catalogVersion),choiceId:opaque(input.choiceId)}};if(r.kind==='select')return{kind:'select',input:{operationId,taskId:uuid(input.taskId),bindingId:uuid(input.bindingId),expectedRevision:revision(input.expectedRevision)}};if(r.kind==='state'&&(input.state==='active'||input.state==='revoked'))return{kind:'state',input:{operationId,bindingId:uuid(input.bindingId),expectedRevision:revision(input.expectedRevision),state:input.state}};throw new Error('Invalid pending model operation');}
export const record = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid route response'); return v as Record<string, unknown>; };
const text = (v: unknown): string => { if (typeof v !== 'string' || v.length > 4096) throw new Error('Invalid route text'); return v; };
const bool = (v: unknown): boolean => { if (typeof v !== 'boolean') throw new Error('Invalid route state'); return v; };
export const revision = (v: unknown): number => { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) throw new Error('Invalid route revision'); return v; };
const nullable = (v: unknown) => v === null ? null : text(v);
const strings = (v: unknown) => { if (!Array.isArray(v) || v.length > 100) throw new Error('Invalid route list'); return v.map(text); };
const opaque=(v:unknown):string=>{const s=text(v);if(!/^[a-f0-9]{64}$/.test(s))throw new Error('Invalid cached model identifier');return s;};
export function parseModelBinding(v:unknown):ModelBinding {const r=record(v),state=text(r.state);if(!['active','revoked','legacy-superseded'].includes(state)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(text(r.bindingId)))throw new Error('Invalid model binding');const b:ModelBinding={bindingId:text(r.bindingId),provider:text(r.provider),name:text(r.name),routeId:routeId(r.routeId),configurationRevision:revision(r.configurationRevision),state:state as ModelBinding['state'],stateRevision:revision(r.stateRevision),accountAccess:text(r.accountAccess),qualification:text(r.qualification),available:bool(r.available),reason:nullable(r.reason)};if(b.available&&(b.state!=='active'||b.qualification==='unqualified'||b.reason!==null))throw new Error('Inconsistent model availability');return b;}
export function parseModelCatalog(v:unknown):ModelCatalog {const r=record(v);if(!Array.isArray(r.choices)||r.choices.length>129||!Array.isArray(r.bindings)||r.bindings.length>1024)throw new Error('Invalid cached model catalog');const choices=r.choices.map(v=>{const c=record(v);return{choiceId:opaque(c.choiceId),provider:text(c.provider),name:text(c.name),accountAccess:text(c.accountAccess),qualification:text(c.qualification)};});const bindings=r.bindings.map(parseModelBinding);if(new Set(choices.map(c=>c.choiceId)).size!==choices.length||new Set(bindings.map(b=>b.bindingId)).size!==bindings.length)throw new Error('Duplicate cached model');return{catalogVersion:opaque(r.catalogVersion),choices,bindings};}
export const routeId = (v: unknown): RouteId => { if (v !== 'codex-responses' && v !== 'claude-api-key') throw new Error('Unsupported route'); return v; };
export function parseRoute(v: unknown): RouteView {
  const r = record(v), c = r.configuration === null ? null : record(r.configuration);
  const verification = text(r.verification);
  if (!['not_verified', 'verified_for_synthetic', 'verified_for_real_data'].includes(verification)) throw new Error('Unknown route evidence');
  const out: RouteView = {
    routeId: text(r.routeId), provider: text(r.provider), configurable: bool(r.configurable), configuration: c ? {routeId: routeId(c.routeId), deployment: text(c.deployment), model:text(c.model), apiVersion:text(c.apiVersion), accountRef:text(c.accountRef), region:nullable(c.region)} : null,
    endpoint: nullable(r.endpoint), revision: revision(r.revision), credentialPresent:bool(r.credentialPresent), adapterSupported:bool(r.adapterSupported), verification:verification as RouteView['verification'], enabled:bool(r.enabled), gate:nullable(r.gate), limits:strings(r.limits), evidence:strings(r.evidence), executionFlow:text(r.executionFlow), inferenceFlow:text(r.inferenceFlow), connectorFlow:text(r.connectorFlow),
  };
  if (out.enabled && (!out.configuration || !out.credentialPresent || !out.adapterSupported || out.verification === 'not_verified' || !out.evidence.length || out.gate !== null)) throw new Error('Inconsistent route eligibility');
  if (out.configuration && out.configuration.routeId !== out.routeId) throw new Error('Mismatched route');
  return out;
}
export function parseRoutes(v: unknown): RouteView[] { const r=record(v); if(!Array.isArray(r.routes) || r.routes.length>20) throw new Error('Invalid route catalog'); const routes=r.routes.map(parseRoute); if(new Set(routes.map(x=>x.routeId)).size!==routes.length) throw new Error('Duplicate route'); return routes; }
export function parseModelDisclosureBindings(value:unknown,currentRoute?:string,currentRevision?:number|null):ModelDisclosureBinding[] {
 if(!Array.isArray(value)||value.length>1024)throw new Error('Model disclosure dependencies unavailable');
 const refs=value.map(value=>{const b=record(value);const ref={routeId:routeId(b.routeId),configurationRevision:revision(b.configurationRevision),active:bool(b.active)};if(ref.configurationRevision<1)throw new Error('Invalid disclosure binding');return ref;});
 if(new Set(refs.map(ref=>JSON.stringify([ref.routeId,ref.configurationRevision]))).size!==refs.length)throw new Error('Incomplete model disclosure dependencies');if(currentRoute!==undefined){const id=routeId(currentRoute),revisionValue=revision(currentRevision);if(revisionValue<1||!refs.some(ref=>ref.routeId===id&&ref.configurationRevision===revisionValue))throw new Error('Incomplete model disclosure dependencies');}else if(currentRevision!=null)throw new Error('Incomplete model disclosure dependencies');
 return refs;
}
export function parseTaskRoute(v:unknown):TaskRouteView {
 const r=record(v),selected=r.selected===null?null:parseRoute(r.selected),configurationRevision=r.configurationRevision===null?null:revision(r.configurationRevision);
 const task={taskId:text(r.taskId),workspaceId:text(r.workspaceId),revision:revision(r.revision),configurationRevision,staleConfiguration:bool(r.staleConfiguration),selected};
 if((selected===null)!==(configurationRevision===null)||selected&&selected.revision!==configurationRevision||task.staleConfiguration&&selected?.enabled)throw new Error('Inconsistent Task model selection');
 return{...task,disclosureBindings:parseModelDisclosureBindings(r.disclosureBindings,selected?.routeId,configurationRevision)};
}

/** Human-safe presentation; native qualification diagnostics stay in main/native records. */
export function savedModelReason(selected:RouteView|null,stale=false,historyUnavailable=false):string|null {if(!selected)return 'Choose a model for this conversation.';if(historyUnavailable)return 'A model used by retained work is unavailable. Earlier conversation content cannot currently be shown.';if(stale)return 'This saved model is unavailable. Revalidate an eligible saved model in Settings or choose another model.';if(!selected.credentialPresent)return `Connect ${selected.provider} to use this saved model.`;return selected.enabled?null:'This saved model is not qualified for the current work. Review its availability in Settings.';}
