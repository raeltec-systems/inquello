/** Real spawned stdout regression; no Auth0, network, credentials or Windows profile. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const readline=require('node:readline');
const {waitLine}=require('../scripts/run-auth0-pilot.cjs');
function nextLine(reader,event){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>done(new Error('Expected owned child line unavailable')),5000);const line=text=>{let value;try{value=JSON.parse(text);}catch{return;}if(value.event===event)done(null,value);};const done=(error,value)=>{clearTimeout(timer);reader.off('line',line);error?reject(error):resolve(value);};reader.on('line',line);});}
async function childFixture(t){
 const child=spawn(process.execPath,['-e',`const rl=require('node:readline').createInterface({input:process.stdin});console.log(JSON.stringify({event:'boot'}));rl.on('line',value=>{if(value==='exit')process.exit(0);else console.log(JSON.stringify({event:value}));});rl.on('close',()=>process.exit(0));`],{env:{},stdio:['pipe','pipe','pipe']});
 child.stderr.resume();child.stdin.on('error',()=>{});
 // Exactly the production topology: an existing lifecycle reader plus a temporary gate reader.
 const lifecycle=readline.createInterface({input:child.stdout});
 t.after(async()=>{lifecycle.close();child.stdout.resume();if(!child.stdin.destroyed&&!child.stdin.writableEnded)child.stdin.end();if(child.exitCode===null&&child.signalCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill();resolve();},1000);child.once('exit',()=>{clearTimeout(timer);resolve();});});});
 await nextLine(lifecycle,'boot');return {child,lifecycle};
}
test('readiness completion leaves the existing lifecycle reader receiving later runtime-exit',async t=>{
 const {child,lifecycle}=await childFixture(t),exits=child.listenerCount('exit'),errors=child.listenerCount('error');
 const gate=waitLine(child,v=>v.event==='ready',5000);child.stdin.write('ready\n');assert.equal((await gate).event,'ready');
 assert.equal(child.listenerCount('exit'),exits);assert.equal(child.listenerCount('error'),errors);
 const later=nextLine(lifecycle,'runtime-exit');child.stdin.write('runtime-exit\n');assert.equal((await later).event,'runtime-exit');
});
test('timeout closes only its reader, resumes stdout and removes temporary child listeners',async t=>{
 const {child,lifecycle}=await childFixture(t),exits=child.listenerCount('exit'),errors=child.listenerCount('error');
 await assert.rejects(waitLine(child,()=>false,20),/Owned Auth0 pilot unavailable/);
 assert.equal(child.listenerCount('exit'),exits);assert.equal(child.listenerCount('error'),errors);
 const later=nextLine(lifecycle,'after-timeout');child.stdin.write('after-timeout\n');assert.equal((await later).event,'after-timeout');
});
test('error completion is idempotent against the deadline and leaves lifecycle input flowing',async t=>{
 const {child,lifecycle}=await childFixture(t),exits=child.listenerCount('exit'),errors=child.listenerCount('error');
 const gate=waitLine(child,()=>false,20);child.emit('error',new Error('injected owned transport error'));await assert.rejects(gate,/Owned Auth0 pilot unavailable/);
 await new Promise(resolve=>setTimeout(resolve,40));assert.equal(child.listenerCount('exit'),exits);assert.equal(child.listenerCount('error'),errors);
 const later=nextLine(lifecycle,'after-error');child.stdin.write('after-error\n');assert.equal((await later).event,'after-error');
});
test('actual owned child exit rejects the pending gate and removes temporary listeners',async t=>{
 const {child}=await childFixture(t),exits=child.listenerCount('exit'),errors=child.listenerCount('error');
 const gate=waitLine(child,()=>false,5000);child.stdin.write('exit\n');await assert.rejects(gate,/Owned Auth0 pilot unavailable/);
 assert.equal(child.exitCode,0);assert.equal(child.listenerCount('exit'),exits);assert.equal(child.listenerCount('error'),errors);
});
