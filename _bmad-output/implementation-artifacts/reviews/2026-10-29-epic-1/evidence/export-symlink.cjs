const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ExportJournal, exportData, exportedFilePath, governedRoots, loadShippedPolicy, takeInventory } = require('/workspace/inquello/desktop/dist/main/data');
(async () => {
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'inquello-review-symlink-'));
 const root=path.join(base,'app'); fs.mkdirSync(root);
 const roots=governedRoots(root,path.join(root,'logs'));
 fs.mkdirSync(path.join(roots['runtime-home'],'sessions'),{recursive:true});
 const outside=path.join(base,'private-credential.txt'); fs.writeFileSync(outside,'SYNTHETIC_PRIVATE_CREDENTIAL_SENTINEL');
 fs.symlinkSync(outside,path.join(roots['runtime-home'],'sessions','linked-secret.jsonl'));
 const load=loadShippedPolicy();if(!load.ok)throw Error(load.error);
 console.log(JSON.stringify({inventory:takeInventory(load.policy,roots).files.map(({rel,category})=>({rel,category}))}));
 const result=await exportData({policy:load.policy,roots,destination:path.join(base,'export'),attribution:{principal:null,appVersion:'review',runtimeVersion:'review'},journal:new ExportJournal(root)});
 const copied=fs.readFileSync(exportedFilePath(result.path,'runtime-home','sessions/linked-secret.jsonl'),'utf8');
 console.log(JSON.stringify({exportSucceeded:true,privateSentinelCopied:copied==='SYNTHETIC_PRIVATE_CREDENTIAL_SENTINEL',sourceOutsideGovernedRoots:true}));
 fs.rmSync(base,{recursive:true,force:true});
})().catch(error=>{console.error(error);process.exitCode=1});
