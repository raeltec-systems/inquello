/** Preserve phase assertions and cleanup outcomes without exposing raw error data. */
async function settleSmokePhase(body,cleanup,stage){
  let result;
  try{result=await body();}
  catch{result={ok:false,missing:[],events:[],primaryFailure:stage()};}
  let cleanupErrors;
  try{cleanupErrors=await cleanup();}
  catch{cleanupErrors=['cleanup-handler-failed'];}
  return {...result,ok:result.ok&&cleanupErrors.length===0,cleanupErrors};
}
module.exports={settleSmokePhase};
