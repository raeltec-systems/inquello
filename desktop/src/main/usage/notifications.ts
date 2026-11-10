/** Work completion refreshes observations, not private identity/route authority. */
export function notifySettledWork(
 method:string, params:unknown, pending:Promise<unknown>,
 notifications:{usageChanged(privateScope:boolean):void;environmentChanged(privateScope:boolean):void},
 schedule:(callback:()=>void)=>unknown=setImmediate,
):void {
 if(method!=='inquello/tools/exec'&&method!=='inquello/permissions/review')return;
 const probe=method==='inquello/tools/exec'&&!!params&&typeof params==='object'&&'sandboxProbeTarget' in params;
 // Next turn: PolicyService must first settle its cached sandbox observation.
 const settled=()=>{schedule(()=>{if(probe)notifications.environmentChanged(false);else notifications.usageChanged(false);});};
 void pending.then(settled,settled);
}
