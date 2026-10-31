import {afterEach,describe,expect,it,vi} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {taskBootstrap} from '../src/main/tasks/bootstrap';
const principal='11111111-1111-4111-8111-111111111111',workspace='22222222-2222-4222-8222-222222222222';
const dirs:string[]=[];afterEach(()=>{for(const d of dirs.splice(0))fs.rmSync(d,{recursive:true,force:true});});
function setup(packaged=false){const root=fs.mkdtempSync(path.join(os.tmpdir(),'inquello-task-bootstrap-'));dirs.push(root);fs.writeFileSync(path.join(root,'.inquello-fictional-audit-session'),'fictional audit only');const request=vi.fn(async()=>({accepted:true}));const env={INQUELLO_FICTIONAL_AUDIT_SESSION:JSON.stringify({principalId:principal,workspaceId:workspace,isolatedRoot:root})};return{root,request,env,run:taskBootstrap({env,packaged,userData:root,runtime:{ready:()=>true,instance:()=>1,request:request as never},identity:{principalId:()=>principal}})};}
describe('trusted fictional-data bootstrap',()=>{
 it('is off in packaged builds even with an environment assertion',async()=>{const x=setup(true);await x.run(workspace);expect(x.request).not.toHaveBeenCalled();});
 it('binds only native connection identity plus exact isolated root; no principal payload',async()=>{const x=setup();await x.run(workspace);expect(x.request).toHaveBeenCalledWith('inquello/tasks/bootstrap',{workspaceId:workspace,isolatedRoot:x.root});await x.run(workspace);expect(x.request).toHaveBeenCalledTimes(2);});
 it('refuses other Workspaces and missing/symlink markers',async()=>{const x=setup();await expect(x.run(principal)).rejects.toThrow();fs.unlinkSync(path.join(x.root,'.inquello-fictional-audit-session'));await expect(x.run(workspace)).rejects.toThrow();fs.writeFileSync(path.join(x.root,'other'),'marker');fs.symlinkSync(path.join(x.root,'other'),path.join(x.root,'.inquello-fictional-audit-session'));await expect(x.run(workspace)).rejects.toThrow();expect(x.request).not.toHaveBeenCalled();});
});
