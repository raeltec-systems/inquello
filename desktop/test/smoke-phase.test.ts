import {createRequire} from 'node:module';
import {describe,expect,it,vi} from 'vitest';
const require=createRequire(import.meta.url);
const {settleSmokePhase}=require('../scripts/smoke-phase.cjs');
const success={ok:true,missing:[],events:['visual-conversation']};
describe('owned smoke phase outcome preservation',()=>{
  it('retains passing assertions only when cleanup also succeeds',async()=>{
    expect(await settleSmokePhase(async()=>success,async()=>[],()=> 'unused')).toEqual({...success,cleanupErrors:[]});
  });
  it('preserves assertion details and does not misclassify them as cleanup failure',async()=>{
    const failed={ok:false,missing:['visual-conversation'],events:['handshake']};
    expect(await settleSmokePhase(async()=>failed,async()=>[],()=> 'unused')).toEqual({...failed,cleanupErrors:[]});
  });
  it('preserves primary failure stage and cleanup errors without leaking raw error data',async()=>{
    const cleanup=vi.fn(async()=>['topology-stop']);
    const result=await settleSmokePhase(async()=>{throw Error('SECRET RAW FAILURE');},cleanup,()=> 'electron-journey');
    expect(result).toEqual({ok:false,missing:[],events:[],primaryFailure:'electron-journey',cleanupErrors:['topology-stop']});
    expect(cleanup).toHaveBeenCalledOnce();
    expect(JSON.stringify(result)).not.toContain('SECRET');
  });
  it('never reports a passing phase when owned resources remain unresolved',async()=>{
    expect(await settleSmokePhase(async()=>success,async()=>['electron-tree-unresolved'],()=> 'unused'))
      .toEqual({...success,ok:false,cleanupErrors:['electron-tree-unresolved']});
  });
  it('retains the primary stage if the cleanup handler itself unexpectedly rejects',async()=>{
    expect(await settleSmokePhase(async()=>{throw Error('primary');},async()=>{throw Error('cleanup');},()=> 'topology-readiness'))
      .toEqual({ok:false,missing:[],events:[],primaryFailure:'topology-readiness',cleanupErrors:['cleanup-handler-failed']});
  });
});
