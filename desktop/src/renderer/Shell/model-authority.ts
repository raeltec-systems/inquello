import {parseModelDisclosureBindings,type TaskRouteView} from '../../main/routes/types';
export interface ModelAuthorityChange {authority:boolean;taskId?:string;binding?:{routeId:string;configurationRevision:number}}
const bindings=new Map<string,Array<{routeId:string;configurationRevision:number}>>();
/** Presentation-only cache. Main/native retain authority for every result. */
export function rememberTaskModel(view:TaskRouteView){try{if(!view.selected||view.configurationRevision===null)throw new Error();bindings.set(view.taskId,parseModelDisclosureBindings(view.disclosureBindings,view.selected.routeId,view.configurationRevision));}catch{bindings.delete(view.taskId);}}
export function forgetTaskModel(taskId:string){bindings.delete(taskId);}
export function forgetTaskModels(){bindings.clear();}
export function modelAuthorityApplies(change:ModelAuthorityChange|undefined,taskId:string){if(change?.authority===false)return false;if(change?.taskId)return change.taskId===taskId;if(change?.binding){const binding=bindings.get(taskId),changed=change.binding;return !binding||binding.some(ref=>ref.routeId===changed.routeId&&ref.configurationRevision===changed.configurationRevision);}return true;}
