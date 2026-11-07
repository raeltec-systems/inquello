import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { RpcConnection } from '../src/main/runtime/rpc';
import { recordingLogger } from './helpers';
const key='sk-ant-SENTINEL-private-handoff';
function setup(){const input=new PassThrough(),output=new PassThrough(),logger=recordingLogger();let wire='';output.on('data',b=>{wire+=String(b);});const rpc=new RpcConnection(input,output,{logger,onFatal(){}});return{rpc,input,output,logger,wire:()=>wire};}
describe('dedicated private credential RPC',()=>{
 it('refuses general RPC use of privateAuth',async()=>{const h=setup();await expect(h.rpc.request('inquello/routes/privateAuth',{apiKey:key})).rejects.toThrow('private route handoff');expect(h.wire()).toBe('');});
 it('bounds secrets before writing',async()=>{const h=setup();await expect(h.rpc.privateRouteAuth({apiKey:'x'.repeat(8000)})).rejects.toThrow('unavailable');expect(h.wire()).toBe('');});
 it('returns only accepted and keeps sentinel out of diagnostics',async()=>{const h=setup();const pending=h.rpc.privateRouteAuth({routeId:'claude-api-key',accountRef:'account',generation:1,apiKey:key});expect(h.wire()).toContain(key);h.input.write(JSON.stringify({id:1,result:{accepted:true,apiKey:key}})+'\n');expect(await pending).toEqual({accepted:true});h.input.write(key+' broken JSON\n');expect(JSON.stringify(h.logger.messages)).not.toContain(key);});
 it('scrubs runtime error details from private callers',async()=>{const h=setup();const pending=h.rpc.privateRouteAuth({apiKey:key});h.input.write(JSON.stringify({id:1,error:{code:-1,message:key,data:{apiKey:key}}})+'\n');await expect(pending).rejects.toThrow('Private route handoff refused');expect(JSON.stringify(h.logger.messages)).not.toContain(key);});
 it('does not queue private keys behind backpressure',async()=>{const input=new PassThrough(),output=new PassThrough({highWaterMark:1}),logger=recordingLogger();const rpc=new RpcConnection(input,output,{logger,onFatal(){}});rpc.notify('harmless',{});await expect(rpc.privateRouteAuth({apiKey:key})).rejects.toThrow('unavailable');expect(rpc.queuedCount).toBe(0);});
});
