import type {ModelCatalog,ModelBinding,RouteView,TaskRouteView} from '../src/main/routes/types';
export const modelBindingId=(revision:number,routeId='claude-api-key')=>`00000000-0000-4000-8000-${String(revision+(routeId==='codex-responses'?1000:0)).padStart(12,'0')}`;
/** Isolated renderer fixture metadata; never a production catalog. */
export function modelCatalog(routes:Array<Pick<RouteView,'routeId'|'provider'|'configuration'|'revision'|'verification'|'enabled'|'gate'>>):ModelCatalog {
 const bindings:ModelBinding[]=routes.filter(r=>r.configuration!==null).map(r=>({bindingId:modelBindingId(r.revision,r.routeId),provider:r.provider,name:r.configuration!.model,routeId:r.routeId as ModelBinding['routeId'],configurationRevision:r.revision,state:'active',stateRevision:1,accountAccess:'unknown',qualification:r.verification==='not_verified'?'unqualified':'synthetic-only',available:r.enabled,reason:r.gate}));
 return{catalogVersion:'c'.repeat(64),choices:bindings.map((b,index)=>({choiceId:(index?'b':'a').repeat(64),provider:b.provider,name:b.name,accountAccess:'unknown',qualification:'Exact qualification required'})),bindings};
}

/** Complete trusted metadata for test Tasks explicitly declared to have no earlier executions. */
export function taskRouteView(view:Omit<TaskRouteView,'disclosureBindings'>):TaskRouteView {return{...view,disclosureBindings:view.selected&&view.configurationRevision!==null?[{routeId:view.selected.routeId as ModelBinding['routeId'],configurationRevision:view.configurationRevision,active:!view.staleConfiguration}]:[]};}

/** Isolated no-history Task authority declaration for tests of other boundaries. */
export async function taskBindingFixture(_taskId:string){return{routeId:'codex-responses',configurationRevision:1,disclosureBindings:[{routeId:'codex-responses',configurationRevision:1,active:true}]};}
