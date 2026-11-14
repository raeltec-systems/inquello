const fs=require('fs'),crypto=require('crypto');const root='D:/Projects/inquello',out=root+'/_bmad-output/implementation-artifacts/verification-2026-11-05';
const text=fs.readFileSync(out+'/desktop-full-docker-policy-three-failures-diagnostic.log','utf8');let file='',scenario='';const events=[];
for(const raw of text.split(/\r?\n/)){const line=raw.replace(/\x1b\[[0-9;]*m/g,'');if(line.startsWith('stdout | test/')){const parts=line.split(' > ');file=parts[0].slice(9);scenario=parts.at(-1)}if(line.includes('POLICY_PHASE ')){try{events.push({file,scenario,...JSON.parse(line.slice(line.indexOf('{')))});}catch{}}}
fs.writeFileSync(out+'/policy-three-failures-timeline.json',JSON.stringify(events,null,2),{flag:'wx'});
for(const name of ['tool-bounds-integration','permissions-integration']){const p=root+'/desktop/test/'+name+'.test.ts';fs.copyFileSync(p,out+'/'+name+'-with-diagnostics.ts',fs.constants.COPYFILE_EXCL);fs.copyFileSync(out+'/'+name+'-before-diagnostics.ts',p);console.log(name,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'));}
fs.copyFileSync(root+'/desktop/test/policy-phase-diagnostics.ts',out+'/policy-phase-diagnostics.ts.txt',fs.constants.COPYFILE_EXCL);fs.unlinkSync(root+'/desktop/test/policy-phase-diagnostics.ts');
console.log('TIMELINE_EVENTS',events.length);
console.log('CURL_TIMINGS',JSON.stringify(events.filter(e=>e.detail==='curl'||e.detail==='inquello/permissions/request')));
