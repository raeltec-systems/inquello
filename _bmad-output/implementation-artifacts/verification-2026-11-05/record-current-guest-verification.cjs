const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root='D:/Projects/inquello',out=root+'/_bmad-output/implementation-artifacts/verification-2026-11-05';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const path=out+'/progress-repair-final-candidate-manifest.json',m=read(path);
for(const f of m.files)assert.equal(hash(root+'/'+f.path),f.sha256,'Source drift: '+f.path);
const receipt=root+'/.tmp/guest-activation-verified-20261105.json',guest=read(receipt);assert.equal(guest.installedVerification,'PASS');assert.equal(guest.manifest.sourceArchiveSha256,'9e8f47c61315ccf013a4fbb0616418de2d5c7de69c731ce1e855eff8ce4deeb3');
const runs=[];
for(const [tag,dir]of [['current-guest-clean-1','jfwj3K'],['current-guest-clean-2','b7DUR0']]){
 const log=out+'/visual-smoke-docker-'+tag+'.log',phase='D:/Inquello/tmp/inquello-seeded-smoke-'+dir+'/visual',lines=fs.readFileSync(log,'utf8').trim().split(/\r?\n/),result=JSON.parse(lines.at(-1));
 assert.equal(result.ok,true);assert.deepEqual(result.cleanupErrors,[]);
 const events=fs.readFileSync(phase+'/smoke.stdout.log','utf8').split(/\r?\n/).flatMap(x=>{try{return[JSON.parse(x)]}catch{return[]}});
 const fixture=read(phase+'/synthetic-journey-state.json');assert.equal(fixture.totalCalls,5);assert.equal(fixture.invalidCalls,0);assert.equal(fixture.heldCancelled,true);assert.equal(fixture.heldTimedOut,false);assert.deepEqual(fixture.contextMatches,[true,true,true,true]);
 const journey=events.find(x=>x.event==='visual-conversation');assert.equal(journey.ok,true);
 const stat=fs.statSync(log);runs.push({tag,status:'passed',phase,log,logSha256:hash(log),logFileElapsedSeconds:(stat.mtimeMs-stat.birthtimeMs)/1000,fixture,handshake:events.find(x=>x.event==='handshake'),journey,readerJump:events.find(x=>x.event==='visual-reader-jump'),captures:fs.readdirSync(phase+'/captures').filter(x=>x.endsWith('.png')).map(name=>({path:phase+'/captures/'+name,sha256:hash(phase+'/captures/'+name)}))});
}
m.updated=new Date().toISOString();m.status='Focused 282-test gate, current native/desktop builds and two sequential unchanged clean visual journeys passed; full acceptance gates remain open.';
m.currentGuest={receipt,receiptSha256:hash(receipt),sourceArchiveSha256:guest.manifest.sourceArchiveSha256,installedVerification:guest.installedVerification};
m.currentBuilds=[{log:out+'/fixture-build-current-guest.log',passed:true,elapsed:'2m57s',binary:'D:/Inquello/cache/fixture-20261105/debug/codex-app-server.exe',sha256:hash('D:/Inquello/cache/fixture-20261105/debug/codex-app-server.exe')},{log:out+'/desktop-build-current-guest.log',passed:true}];
m.cleanVisualRuns=runs;m.visualInspection={actualWindowsImages:true,firstRun:['03-followup-conversation-synthetic.png','04-interrupted-conversation-synthetic.png','06-resumed-conversation-synthetic.png'],secondRun:['03-followup-conversation-synthetic.png','04a-readable-composer-narrow-synthetic.png','06-resumed-conversation-synthetic.png'],finding:'Retained follow-up/resume answers readable, explicit interruption/Resume, Finished/worked-for retained, narrow composer readable with no overlapping controls. Synthetic not-qualified provider label remains truthful.'};
m.open=['Full desktop suite on the final candidate remains required; earlier independent baseline failures are not dismissed.','Full 18-report seeded smoke on the final candidate remains required.','Real-provider qualification and conditional SQLite writer-contention residual remain open.'];
m.validationLimitations=['Two clean synthetic journeys do not establish live provider qualification or universal absence of intermittent failures.','Original final-1 composite observation failure code was not retained; separate deterministic usage regression was repaired without claiming that exact historical cause.'];
m.ownedExecution='No active owned process. Build/visual chain PID 34904 completed exit 0, runtime 495.85s.';
fs.writeFileSync(path,JSON.stringify(m,null,2)+'\n');console.log(JSON.stringify({runs:runs.map(x=>({tag:x.tag,elapsed:x.logFileElapsedSeconds,phase:x.phase})),manifest:path}));
