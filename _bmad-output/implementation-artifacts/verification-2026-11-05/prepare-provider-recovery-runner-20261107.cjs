const fs=require('node:fs');const dir=__dirname;let s=fs.readFileSync(dir+'/run-docker-verification.cjs','utf8');
const oldBinary="const binary=mode==='suite'?'C:/Windows/System32/cmd.exe':process.execPath;";
const oldArgs="const args=mode==='suite'?['/d','/c','pnpm test -- --maxWorkers=1']:['desktop/scripts/run-seeded-smoke.cjs',...(mode==='visual'?['--visual-only']:[])];";
if(!s.includes(oldBinary)||!s.includes(oldArgs))throw Error('Runner changed');
s=s.replace(oldBinary,"const binary=process.execPath;").replace(oldArgs,"const args=mode==='suite'?['D:/Toolchains/npm-global/node_modules/pnpm/bin/pnpm.cjs','test','--maxWorkers=1']:['desktop/scripts/run-seeded-smoke.cjs',...(mode==='visual'?['--visual-only']:[])];");
fs.writeFileSync(dir+'/run-docker-provider-recovery-20261107.cjs','// Same owned fixture guards; direct pnpm entry avoids Node 24.22 cmd argument quoting. Pass test flags without the extra positional --.\n'+s,{flag:'wx'});
let ps=fs.readFileSync(dir+'/resume-provider-recovery-final-20261107.ps1','utf8').replaceAll('run-docker-verification.cjs','run-docker-provider-recovery-20261107.cjs').replaceAll('suite provider-recovery-final-20261107','suite provider-recovery-final-direct-20261107').replaceAll('smoke provider-recovery-final-20261107','smoke provider-recovery-final-direct-20261107');
fs.writeFileSync(dir+'/resume-provider-recovery-direct-20261107.ps1',ps,{flag:'wx'});console.log('Created direct pnpm runner with unchanged fixture ownership validation.');
