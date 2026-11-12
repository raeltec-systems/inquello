/** Development launcher (spec-dev-mode-real-model-testing): one command to try
 * features with real model providers on the owner's machine.
 *
 * It starts the local development topology (synthetic identity provider and a
 * fresh shared-service database) with a seeded Workspace, opens the app visibly
 * in development mode on the persistent profile under D:\Inquello\dev\profile,
 * and stops the topology (which drops its database) when the app closes. If the
 * topology stops first, it says so and closes the app.
 * It never enters a provider credential and never sends a Task: keys are
 * entered in Settings. Needs a debug build (`codex-app-server`, `codex-cli`,
 * `inquello-dev-topology`), `pnpm run build`, and the administrative database
 * URL in INQUELLO_DEV_DATABASE_URL or INQUELLO_TEST_DATABASE_URL.
 * Extra arguments go to Electron (for example --remote-debugging-port=9333);
 * the app refuses smoke and owned-profile flags in development mode.
 */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),readline=require('node:readline');
const {spawn}=require('node:child_process');
const desktop=path.resolve(__dirname,'..'),root=path.dirname(desktop);
const suffix=process.platform==='win32'?'.exe':'';
/** The app gets the service config and seed, never database URLs, provider credentials or test fixtures. */
function appEnv(config,seed){
  const env={...process.env};
  for(const name of Object.keys(env)){
    const upper=name.toUpperCase();
    if(/DATABASE_URL$|^PGPASSWORD$|^RESEND_API_KEY$|^INQUELLO_(?:SMOKE_SEED|QUOTA_FIXTURE|VISUAL_FIXTURE|FICTIONAL_AUDIT_SESSION|FICTIONAL_PAID_SESSION|ONBOARDING_FIXTURE|ONBOARDING_RUN|ONBOARDING_RESUME|PROVIDER_DEV_CONFIG|DEV_PROFILE|DEV_RUN_ID|DEVELOPMENT_MODE|FIXTURE_APP_SERVER_BIN)$/.test(upper)
      ||(/(_API_KEY|_SECRET|_TOKEN)$/.test(upper)&&upper.split('_').some(part=>['OPENAI','ANTHROPIC','CLAUDE','CODEX','CHATGPT'].includes(part))))delete env[name];
  }
  delete env.ELECTRON_RUN_AS_NODE;
  return{...env,INQUELLO_SERVICE_CONFIG:config,INQUELLO_DEV_SEED:seed};
}
/** The topology's first line must be its service configuration (the desktop's INQUELLO_SERVICE_CONFIG file). */
function readyConfig(line){
  let value=null;try{value=JSON.parse(line);}catch{/* refused below */}
  if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.service_url!=='string'||typeof value.issuer_url!=='string')throw new Error('The development topology did not print its service configuration first; nothing was opened.');
  return line;
}
function exited(child,ms){return new Promise(resolve=>{
  if(child.exitCode!==null||child.signalCode!==null)return resolve(true);
  const timer=setTimeout(()=>{child.removeListener('exit',done);resolve(false);},ms),done=()=>{clearTimeout(timer);resolve(true);};
  child.once('exit',done);
});}
async function stopTopology(topology){
  // A topology that already exited closes its stdin: ignore the EPIPE instead of crashing the launcher.
  topology.stdin.on('error',()=>{});
  topology.stdin.end();
  if(await exited(topology,15000))return true;
  // Killed outright, its database stays; the next launch's --drop-stale removes it.
  topology.kill();await exited(topology,5000);return false;
}
/** Closes the app's window, as the person would; kills it only if it is still open after ten seconds. */
function closeApp(electron,platform=process.platform){
  if(electron.exitCode!==null||electron.signalCode!==null)return;
  if(platform==='win32'){const close=spawn('taskkill',['/PID',String(electron.pid)],{stdio:'ignore',windowsHide:true});close.once('error',()=>electron.kill());}
  else electron.kill('SIGTERM');
  const timer=setTimeout(()=>{if(electron.exitCode===null&&electron.signalCode===null)electron.kill();},10000);electron.once('exit',()=>clearTimeout(timer));timer.unref?.();
}
/** If the topology stops while the app runs (not after Ctrl+C, which reaches both), say so plainly and close the app. Returns a function that stops watching (call it before stopping the topology on purpose). */
function closeAppWhenTopologyStops(topology,electron,options={}){
  const log=options.log??(message=>console.error(message)),close=options.close??closeApp,expected=options.expected??(()=>false);
  const stopped=(code)=>{if(expected()||electron.exitCode!==null||electron.signalCode!==null)return;log(`The development topology stopped unexpectedly (code ${code??'none'}), so Inquello is closing. Run pnpm run dev again.`);close(electron);};
  topology.once('exit',stopped);
  return()=>topology.removeListener('exit',stopped);
}
async function main(){
  // Ctrl+C before the app opens stops the topology; once the app is open it reaches the app too, which closes, and the topology then stops below.
  let topology=null,electron=null,interrupted=false;
  process.on('SIGINT',()=>{interrupted=true;if(!electron&&topology)void stopTopology(topology);});
  if(!process.env.INQUELLO_DEV_DATABASE_URL&&!process.env.INQUELLO_TEST_DATABASE_URL)throw new Error('Set INQUELLO_DEV_DATABASE_URL (or dot-source .tmp/story121-env.ps1) before starting development mode.');
  if(process.env.INQUELLO_TEST_DATABASE_URL&&process.env.INQUELLO_DEV_DATABASE_URL)throw new Error('Ambiguous database configuration: clear the unused database variable.');
  const base=process.platform==='win32'?'D:\\Inquello\\dev':path.join(os.homedir(),'.inquello-dev');
  const run=path.join(base,'run');fs.mkdirSync(run,{recursive:true});
  const seed=path.join(run,'seed.json'),config=path.join(run,'config.json'),policyFile=path.join(run,'policy.json');
  for(const file of [seed,config])fs.rmSync(file,{force:true});
  fs.copyFileSync(path.join(root,'engine/codex-rs/inquello-protocol/fixtures/workspace/policy.json'),policyFile);
  topology=spawn(process.env.INQUELLO_DEV_TOPOLOGY_BIN??path.join(root,`engine/codex-rs/target/debug/inquello-dev-topology${suffix}`),
    ['--exit-on-stdin-eof','--drop-stale','--seed-workspace','Development workspace','--seed-out',seed,'--seed-policy',policyFile],
    {env:process.env,stdio:['pipe','pipe','inherit'],windowsHide:true});
  const line=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('The development topology did not become ready within 60 seconds.')),60000);
    readline.createInterface({input:topology.stdout}).once('line',text=>{clearTimeout(timer);resolve(text);});
    topology.once('error',error=>{clearTimeout(timer);reject(new Error(`The development topology could not start: ${error.message}`));});
    topology.once('exit',code=>{clearTimeout(timer);reject(new Error(interrupted?'Stopped before Inquello opened.':`The development topology exited before it was ready (code ${code}).`));});
  }).then(readyConfig).catch(async error=>{await stopTopology(topology);throw error;});
  if(interrupted){await stopTopology(topology);throw new Error('Stopped before Inquello opened.');}
  fs.writeFileSync(config,line);
  if(!fs.existsSync(seed)){await stopTopology(topology);throw new Error('The development topology wrote no seed file.');}
  console.log('Development topology ready; opening Inquello in development mode. Close the app window to stop.');
  electron=spawn(path.join(desktop,`node_modules/electron/dist/electron${suffix}`),['.','--development',...process.argv.slice(2)],{cwd:desktop,env:appEnv(config,seed),stdio:'inherit'});
  const unwatch=closeAppWhenTopologyStops(topology,electron,{expected:()=>interrupted});
  const code=await new Promise(resolve=>{electron.once('error',()=>resolve(1));electron.once('exit',(exitCode)=>resolve(exitCode??1));});
  unwatch();
  const lost=topology.exitCode!==null||topology.signalCode!==null;
  const stopped=await stopTopology(topology);
  fs.rmSync(config,{force:true});
  console.log(lost?'The development topology had stopped before the app closed; the next launch removes anything it left.':stopped?'Development topology stopped; its database was dropped.':'The development topology was killed; its database is removed by the next launch.');
  process.exitCode=code;
}
module.exports={readyConfig,stopTopology,closeAppWhenTopologyStops};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
