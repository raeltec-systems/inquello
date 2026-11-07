/** Isolated real child processes, never the production runtime or credentials. */
import fs from 'node:fs';
import path from 'node:path';
import {afterAll,describe,expect,it} from 'vitest';
import {inspectNative,inspectorsQuiescent} from '../src/main/runtime/data-inspector';
import {tempDir,removeTempDirs} from './helpers';
afterAll(removeTempDirs);
const timing={timeoutMs:1000,terminateMs:400,closeMs:1000,maxBytes:1024};
function child(source:string){const root=tempDir('inspector-child'),binary=path.join(root,'inspect');fs.writeFileSync(binary,`#!${process.execPath}\n${source}`,{mode:0o700});return{root,binary};}
// Extensionless executable/shebang and Unix signal semantics are not Windows evidence.
describe.skipIf(process.platform==='win32')('Unix real inspector processes',()=>{
it('waits for actual delayed SIGTERM close before rejecting',async()=>{
 const c=child(`const fs=require('node:fs');process.on('SIGTERM',()=>setTimeout(()=>{fs.writeFileSync(process.env.CLOSED,'closed');process.exit(0)},180));setInterval(()=>{},100);`);
 const closed=path.join(c.root,'closed');const pending=inspectNative(c.binary,{...process.env,CLOSED:closed},{},timing);
 expect(inspectorsQuiescent()).toBe(false);await expect(pending).rejects.toThrow('unavailable');expect(fs.readFileSync(closed,'utf8')).toBe('closed');expect(inspectorsQuiescent()).toBe(true);
});
it('escalates a child ignoring SIGTERM and waits for close',async()=>{const c=child(`process.on('SIGTERM',()=>{});setInterval(()=>{},100);`);await expect(inspectNative(c.binary,process.env,{},timing)).rejects.toThrow('unavailable');expect(inspectorsQuiescent()).toBe(true);});
it.each(['success','nonzero','oversize'] as const)('settles %s only after child close',async mode=>{const c=child(mode==='success'?`process.stdout.write('{"available":true}');`:mode==='nonzero'?`process.exit(7);`:`process.stdout.write('x'.repeat(2048));setInterval(()=>{},100);`);const pending=inspectNative(c.binary,process.env,{},timing);if(mode==='success')await expect(pending).resolves.toEqual({available:true});else await expect(pending).rejects.toThrow('unavailable');expect(inspectorsQuiescent()).toBe(true);});
it('input serialization failure still waits for child close',async()=>{const c=child(`setInterval(()=>{},100);`);const input:{self?:unknown}={};input.self=input;await expect(inspectNative(c.binary,process.env,input,timing)).rejects.toThrow('unavailable');expect(inspectorsQuiescent()).toBe(true);});
it('spawn failure settles after close without leaking the inspector gate',async()=>{await expect(inspectNative('/nonexistent/isolated-inquello-inspector',process.env,{},timing)).rejects.toThrow('unavailable');expect(inspectorsQuiescent()).toBe(true);});

});
