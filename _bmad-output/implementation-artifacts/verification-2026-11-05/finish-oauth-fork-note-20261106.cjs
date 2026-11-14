const fs=require('node:fs');
const file='D:/Projects/inquello/FORK-CUT.md',text=fs.readFileSync(file,'utf8');
const before='Candidate Linux RPC, lint, final source-matched desktop suite and seeded smoke remain separate gates recorded in the continuation evidence; these bounded tests are not a formal isolation proof.';
const after='The final source also passes the original Linux and Windows RPC regression, package formatting and all-target rmcp Clippy. The lint correction uses equivalent PoisonError method references without suppressions or behavior changes. Final desktop suite and seeded smoke are recorded separately in the continuation evidence; these bounded tests are not a formal isolation proof.';
if(text.split(before).length!==2)throw Error('Fork note did not match exactly');
fs.writeFileSync(file,text.replace(before,after));
