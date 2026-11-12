/** Development launcher robustness (spec-dev-mode-real-model-testing, review pass 1). */
import {EventEmitter} from 'node:events';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {describe,expect,it,vi} from 'vitest';
const require=createRequire(import.meta.url);
const script=path.resolve(__dirname,'../scripts/run-dev.cjs');
const {readyConfig,stopTopology,closeAppWhenTopologyStops}=require(script) as {
 readyConfig:(line:string)=>string;
 stopTopology:(topology:unknown)=>Promise<boolean>;
 closeAppWhenTopologyStops:(topology:EventEmitter,electron:unknown,options:{log:(m:string)=>void;close:(e:unknown)=>void;expected?:()=>boolean})=>()=>void;
};
type Child=EventEmitter&{exitCode:number|null;signalCode:string|null;stdin:EventEmitter&{end:()=>void};kill:()=>void};
function child(onEnd?:(self:Child)=>void):Child{
 const self=Object.assign(new EventEmitter(),{exitCode:null as number|null,signalCode:null as string|null,stdin:Object.assign(new EventEmitter(),{end:()=>onEnd?.(self)}),kill:vi.fn()});
 return self;
}

describe('the development launcher',()=>{
 it('opens the app only when the topology\'s first line is its service configuration',()=>{
  const config=JSON.stringify({service_url:'https://127.0.0.1:1',issuer_url:'https://127.0.0.1:2/',issuer_label:'Local',ca_path:'ca.pem',client_id:'x'});
  expect(readyConfig(config)).toBe(config);
  for(const line of ['Starting topology…','','[]','null','{"service_url":"https://x"}','{"service_url":1,"issuer_url":"https://y"}'])expect(()=>readyConfig(line),line).toThrow(/did not print its service configuration first/);
 });

 it('stops a topology that already closed its input without crashing on EPIPE',async()=>{
  const topology=child(self=>{self.stdin.emit('error',Object.assign(new Error('write EPIPE'),{code:'EPIPE'}));self.exitCode=0;self.emit('exit',0);});
  await expect(stopTopology(topology)).resolves.toBe(true);
  expect(topology.kill).not.toHaveBeenCalled();
 });

 it('says so plainly and closes the app when the topology stops while the app runs',()=>{
  const topology=child(),electron=child(),log=vi.fn(),close=vi.fn();
  const unwatch=closeAppWhenTopologyStops(topology,electron,{log,close});
  topology.emit('exit',101);
  expect(log).toHaveBeenCalledWith('The development topology stopped unexpectedly (code 101), so Inquello is closing. Run pnpm run dev again.');
  expect(close).toHaveBeenCalledWith(electron);
  // A deliberate stop after the app closed says nothing.
  const quiet=child(),closedApp=child(),log2=vi.fn(),close2=vi.fn();
  closeAppWhenTopologyStops(quiet,closedApp,{log:log2,close:close2})();
  quiet.emit('exit',0);
  closedApp.exitCode=0;
  expect(log2).not.toHaveBeenCalled();expect(close2).not.toHaveBeenCalled();
  // Ctrl+C reaches the topology too; the app is closing already, so nothing is reported.
  const interrupted=child(),running=child(),log3=vi.fn(),close3=vi.fn();
  closeAppWhenTopologyStops(interrupted,running,{log:log3,close:close3,expected:()=>true});
  interrupted.emit('exit',0xc000013a);
  expect(log3).not.toHaveBeenCalled();expect(close3).not.toHaveBeenCalled();
  unwatch();
 });

 it('reports a setup problem in one plain line, without a stack trace',()=>{
  const env={...process.env};
  for(const name of Object.keys(env))if(/^INQUELLO_(?:DEV|TEST)_DATABASE_URL$/i.test(name))delete env[name];
  const run=spawnSync(process.execPath,[script],{env,encoding:'utf8',timeout:30000});
  expect(run.status).toBe(1);
  expect(run.stderr.trim()).toBe('Set INQUELLO_DEV_DATABASE_URL (or dot-source .tmp/story121-env.ps1) before starting development mode.');
 });
});
