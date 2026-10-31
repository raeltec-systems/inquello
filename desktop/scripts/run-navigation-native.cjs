/** Nonzero exact-build witness selection. Listing is not a passing test run. */
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const required=['responses_search_reopen_private_denials','messages_search_reopen_private_denials','responses_search_paginated_and_legacy_old_turn','messages_search_paginated_and_legacy_old_turn',...['responses','messages'].flatMap(route=>['search_final_await_contributors','search_next_cursor_scope_snapshot','search_retained_route_mismatch','search_zero_to_match_final_await','search_stalled_admission_timeout'].map(name=>`${route}_${name}`))];
function verifySelection(output){const selected=new Set(output.split(/\r?\n/).filter(line=>line.endsWith(': test')).map(line=>line.slice(0,-6).split('::').at(-1)));for(const name of required)if(!selected.has(name))throw new Error(`Native search witness not selected: ${name}`);return selected;}
function main(){
 const cwd=path.resolve(__dirname,'../../engine/codex-rs');
 const run=(args,env=process.env)=>{const result=spawnSync('cargo',args,{cwd,env,encoding:'utf8',maxBuffer:64*1024*1024});if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);if(result.error||result.status!==0)throw result.error||new Error('Native verification failed');return result.stdout;};
 run(['build','-p','codex-app-server','--bin','codex-app-server','--features','inference-fixtures']);
 const metadata=JSON.parse(run(['metadata','--format-version','1','--no-deps']));
 const binary=path.join(metadata.target_directory,'debug',`codex-app-server${process.platform==='win32'?'.exe':''}`);
 const args=['test','-p','codex-app-server','--features','inference-fixtures','--test','inquello_authorization_runtime','search_'];
 const selected=verifySelection(run([...args,'--','--list']));
 const output=run([...args,'--','--test-threads=1'],{...process.env,INQUELLO_FIXTURE_APP_SERVER_BIN:binary});
 if(![...output.matchAll(/test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored;/g)].some(m=>Number(m[1])===selected.size&&Number(m[2])===0&&Number(m[3])===0))throw new Error('Native execution was empty, skipped or incomplete');
}
if(require.main===module){try{main();}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={required,verifySelection};
