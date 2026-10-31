import {afterEach,describe,expect,it,vi} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {taskBootstrap} from '../src/main/tasks/bootstrap';
const principal='11111111-1111-4111-8111-111111111111',workspace='22222222-2222-4222-8222-222222222222';
const dirs:string[]=[];afterEach(()=>{for(const d of dirs.splice(0))fs.rmSync(d,{recursive:true,force:true});});
function setup(packaged=false){const root=fs.mkdtempSync(path.join(os.tmpdir(),'inquello-task-bootstrap-'));dirs.push(root);fs.writeFileSync(path.join(root,'.inquello-fictional-audit-session'),'fictional audit only');const request=vi.fn(async(_method:string,_params?:unknown)=>({accepted:true}));const env={INQUELLO_FICTIONAL_AUDIT_SESSION:JSON.stringify({principalId:principal,workspaceId:workspace,isolatedRoot:root})};return{root,request,env,run:taskBootstrap({env,packaged,userData:root,runtime:{ready:()=>true,instance:()=>1,request:request as never},identity:{principalId:()=>principal}})};}
describe('trusted fictional-data bootstrap',()=>{
 it('is off in packaged builds even with an environment assertion',async()=>{const x=setup(true);await x.run(workspace);expect(x.request).not.toHaveBeenCalled();});
 it('binds only native connection identity plus exact isolated root; no principal payload',async()=>{const x=setup();await x.run(workspace);expect(x.request).toHaveBeenCalledWith('inquello/tasks/bootstrap',{workspaceId:workspace,isolatedRoot:x.root});await x.run(workspace);expect(x.request).toHaveBeenCalledTimes(2);});
 it('refuses other Workspaces and missing/symlink markers',async()=>{const x=setup();await expect(x.run(principal)).rejects.toThrow();fs.unlinkSync(path.join(x.root,'.inquello-fictional-audit-session'));await expect(x.run(workspace)).rejects.toThrow();fs.writeFileSync(path.join(x.root,'other'),'marker');fs.symlinkSync(path.join(x.root,'other'),path.join(x.root,'.inquello-fictional-audit-session'));await expect(x.run(workspace)).rejects.toThrow();expect(x.request).not.toHaveBeenCalled();});
});

describe('current service session bootstrap',()=>{
 const session=(revision:string)=>({session_id:workspace,revision,principal:{principal_id:principal,revision:'1'}} as never);
 it('uses genuine service binding even in a packaged build and advances generation on session change',async()=>{
  const x=setup(true);let revision='1';const run=taskBootstrap({env:x.env,packaged:true,userData:x.root,runtime:{ready:()=>true,instance:()=>1,request:x.request as never},identity:{principalId:()=>principal},currentSession:async()=>session(revision)});
  await run(workspace);expect(x.request).toHaveBeenLastCalledWith('inquello/tasks/bootstrap',{workspaceId:workspace,isolatedRoot:x.root,realSession:{sessionId:workspace,principalRevision:'1',sessionRevision:'1',generation:1}});
  revision='2';await run(workspace);expect(x.request.mock.calls.at(-1)?.[1]).toMatchObject({realSession:{sessionRevision:'2',generation:2}});
 });
 it('a late older session response cannot replace the newer bootstrap',async()=>{
  const x=setup();let resolve!:(value:never)=>void,calls=0;
  const run=taskBootstrap({env:{},packaged:false,userData:x.root,runtime:{ready:()=>true,instance:()=>1,request:x.request as never},identity:{principalId:()=>principal},currentSession:async()=>++calls===1?await new Promise<never>(r=>{resolve=r;}):session('2')});
  const old=run(workspace);await run(workspace);resolve(session('1'));await expect(old).rejects.toThrow();expect(x.request).toHaveBeenCalledTimes(1);
 });
});
