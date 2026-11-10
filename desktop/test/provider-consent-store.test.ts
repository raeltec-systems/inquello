import fs from 'node:fs';
import path from 'node:path';
import {afterAll,expect,it,vi} from 'vitest';
import {ConsentStore} from '../src/main/providers/consent-store';
import {fakeSafeStorage} from './identity-fakes';
import {tempDir,removeTempDirs} from './helpers';
const principal='10000000-0000-4000-8000-000000000001',workspace='20000000-0000-4000-8000-000000000001',other='20000000-0000-4000-8000-000000000002';
const pending={schema_version:1,command_epoch:'1',workspace_id:workspace,operation_id:'30000000-0000-4000-8000-000000000001',expected_revision:'0',expected_contract_version:1,expected_contract_digest:'a'.repeat(64),action:'allow' as const};
function options(){return{dir:tempDir('consent-store'),scope:'fictional-service+issuer',safeStorage:fakeSafeStorage('gnome_libsecret'),platform:'linux' as const};}
afterAll(()=>removeTempDirs());
it('restarts with exact encrypted immutable envelope and separate principal/workspace/service scopes',()=>{
 const o=options(),s=new ConsentStore(o);s.save(principal,workspace,pending);
 const file=path.join(o.dir,fs.readdirSync(o.dir)[0]!);expect(fs.readFileSync(file).toString()).not.toContain(pending.operation_id);
 expect(new ConsentStore(o).load(principal,workspace)).toEqual(pending);
 expect(s.load(other,workspace)).toBeNull();expect(s.load(principal,other)).toBeNull();
 expect(new ConsentStore({...o,scope:'another-service'}).load(principal,workspace)).toBeNull();
});
it('rejects a transplanted journal and a mismatched workspace envelope',()=>{
 const o=options(),s=new ConsentStore(o);s.save(principal,workspace,pending);
 const old=fs.readFileSync(path.join(o.dir,fs.readdirSync(o.dir)[0]!));
 s.save(other,workspace,null);const otherFile=fs.readdirSync(o.dir).map(name=>path.join(o.dir,name)).find(file=>!fs.readFileSync(file).equals(old))!;
 fs.writeFileSync(otherFile,old);expect(()=>s.load(other,workspace)).toThrow(/binding mismatch/);
 expect(()=>s.save(principal,other,pending)).toThrow(/binding mismatch/);
});
it('failed atomic replacement retains original pending bytes and removes only its temporary file',()=>{
 const o=options(),s=new ConsentStore(o);s.save(principal,workspace,pending);
 const spy=vi.spyOn(fs,'renameSync').mockImplementation(()=>{throw new Error('owned simulated rename failure');});
 try{expect(()=>s.save(principal,workspace,null)).toThrow();}finally{spy.mockRestore();}
 expect(s.load(principal,workspace)).toEqual(pending);expect(fs.readdirSync(o.dir)).toHaveLength(1);
});
it('refuses plaintext-only storage and malformed ciphertext without discarding pending state',()=>{
 const o=options(),s=new ConsentStore(o);
 const insecure=new ConsentStore({...o,safeStorage:fakeSafeStorage('basic_text')});
 expect(()=>insecure.save(principal,workspace,pending)).toThrow();expect(()=>insecure.load(principal,workspace)).toThrow();
 s.save(principal,workspace,pending);const file=path.join(o.dir,fs.readdirSync(o.dir)[0]!);fs.writeFileSync(file,'malformed');
 expect(()=>s.load(principal,workspace)).toThrow();expect(fs.readFileSync(file,'utf8')).toBe('malformed');
});
