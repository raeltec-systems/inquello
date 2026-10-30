import type {OrganiseIdentity,OrganiseRuntime} from '../organise';
import type {PolicyService} from '../policy/service';
import {inquelloRefusal} from '../policy/permissions';
import {parseTaskUsage,uuid,type SetUsageInput,type UsageResult} from './types';
export interface UsageServiceOptions {runtime:OrganiseRuntime;identity:Pick<OrganiseIdentity,'principalId'>;policy:Pick<PolicyService,'inspectEnvironment'>;onChanged?():void}
const unavailable=():UsageResult=>({ok:false,code:'unavailable',reason:'Usage information unavailable. Refresh when the runtime and private Task authority are available.'});
export class UsageService {
 private epoch=0;
 constructor(private readonly options:UsageServiceOptions){}
 invalidate():void{this.epoch++;}
 private async request(taskId:string,input?:SetUsageInput):Promise<UsageResult>{
  const principal=this.options.identity.principalId(),runtime=this.options.runtime.instance(),epoch=this.epoch;
  const current=()=>!!principal&&principal===this.options.identity.principalId()&&runtime===this.options.runtime.instance()&&epoch===this.epoch&&this.options.runtime.ready();
  try{
   uuid(taskId);if(!current())return unavailable();
   const authority=await this.options.policy.inspectEnvironment(taskId);if(!authority.ok||!current())return unavailable();
   const raw=await this.options.runtime.request(input?'inquello/usage/set':'inquello/usage/read',input??{taskId});
   if(!current())return{ok:false,code:'changed',reason:'The private Task session changed. Refresh before continuing.'};
   const view=parseTaskUsage(raw,principal!);if(view.taskId!==taskId)return unavailable();
   if(input)this.options.onChanged?.();
   return{ok:true,value:view};
  }catch(error){const kind=inquelloRefusal(error)?.kind;if(current()&&(kind==='revision_conflict'||kind==='operation_conflict'))return{ok:false,code:'conflict',reason:'Task settings or route changed first. Your draft is preserved; refresh and explicitly save again.'};return unavailable();}
 }
 forTask(taskId:string):Promise<UsageResult>{return this.request(taskId);}
 set(input:SetUsageInput):Promise<UsageResult>{return this.request(input.taskId,input);}
}
