/** Explicit Windows development pilot. No synthetic issuer, seed, provider or login automation.
 * Owns a fresh database/TLS/profile and retains all three on shutdown for explicit resume.
 */
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {spawn,execFileSync}=require('node:child_process');
const {randomUUID,createHash}=require('node:crypto');
const readline=require('node:readline');
const {createOwnedProcessGuard}=require('./smoke-processes.cjs');
const ISSUER='https://inquello-dev.uk.auth0.com/',CLIENT='lUsBSlvk4B7HGotQQfILudjs7WeKRFU9';
const SERVICE_SHA='9af80fc7ffd3f19655cc6b15a07435bd3243f8a9133b341f6f42a13f8ef27083';
const ENGINE_TREE='4846abe8470db3c1ae45e26d71ad05980a41b348';
const OPENSSL='C:\\Program Files\\Git\\usr\\bin\\openssl.exe',PSQL='C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';
const failure=()=>new Error('Owned Auth0 pilot unavailable; retained state requires operator review');
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function regular(file,max=1048576){if(!path.isAbsolute(file))throw failure();const s=fs.lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||s.size>max||fs.realpathSync(file)!==file)throw failure();return file;}
function parseArgs(args){const out={};for(let i=0;i<args.length;i+=2){const flag=args[i];if(!['--root','--port','--manifest','--resume'].includes(flag)||flag in out||!args[i+1]||args[i+1].startsWith('--'))throw failure();out[flag]=args[i+1];}if(!out['--manifest']||Boolean(out['--root'])===Boolean(out['--resume'])||(!out['--resume']&&!out['--port'])||(out['--resume']&&out['--port']))throw failure();if(out['--port']&&(!/^\d+$/.test(out['--port'])||+out['--port']<1024||+out['--port']>65535||+out['--port']===43821))throw failure();return out;}
function baseEnv(env){const names=new Set(['systemroot','windir','comspec','path','pathext','temp','tmp','userprofile','appdata','localappdata','programdata','programfiles','programfiles(x86)','systemdrive','homedrive','homepath','username','userdomain']);return Object.fromEntries(Object.entries(env).filter(([key,value])=>names.has(key.toLowerCase())&&typeof value==='string'));}
function database(env,name){const raw=env.INQUELLO_TEST_DATABASE_URL;if(!raw||!/^inquello_auth0_[a-f0-9]{32}$/.test(name))throw failure();let u;try{u=new URL(raw);}catch{throw failure();}if(!['postgres:','postgresql:'].includes(u.protocol)||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||!u.username||u.pathname.length<2||u.hash)throw failure();const pg={PGHOST:u.hostname==='[::1]'?'::1':u.hostname,PGPORT:u.port||'5432',PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:decodeURIComponent(u.pathname.slice(1))};if([...u.searchParams.keys()].some(key=>key!=='sslmode')||u.searchParams.getAll('sslmode').length>1)throw failure();if(u.searchParams.has('sslmode')){const mode=u.searchParams.get('sslmode');if(!['disable','allow','prefer','require','verify-ca','verify-full'].includes(mode))throw failure();pg.PGSSLMODE=mode;}u.pathname='/'+name;return {pg,url:u.href};}
function run(binary,args,options={}){try{return execFileSync(binary,args,{stdio:['ignore','pipe','pipe'],timeout:20000,windowsHide:true,...options});}catch{throw failure();}}
function json(file,value){fs.writeFileSync(file,JSON.stringify(value,null,2),{flag:'wx',mode:0o600});}
function normalConfig(root,port){return {service_url:`https://127.0.0.1:${port}`,issuer_url:ISSUER,issuer_label:'Inquello development identity',client_id:CLIENT,ca_path:path.join(root,'tls','ca.pem'),identity_profile:'auth0',issuer_trust:'system',callback_port:43821};}
async function available(port){await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',()=>reject(failure()));server.listen(port,'127.0.0.1',()=>server.close(error=>error?reject(failure()):resolve()));});}
function verifyBuild(repo,manifestFile){const m=JSON.parse(fs.readFileSync(regular(manifestFile),'utf8'));if(m.engineTree!==ENGINE_TREE||hash(regular(m.runtime,536870912))!==String(m.runtimeSha256).toLowerCase()||hash(regular(m.cli,536870912))!==String(m.cliSha256).toLowerCase())throw failure();if(run('git',['rev-parse','HEAD:engine'],{cwd:repo,encoding:'utf8'}).trim()!==ENGINE_TREE||run('git',['status','--porcelain','--','engine'],{cwd:repo,encoding:'utf8'}).trim())throw failure();const service=regular(path.join(repo,'.tmp','story131-serve-production','inquello-service.exe'),536870912);if(hash(service)!==SERVICE_SHA)throw failure();return {...m,service};}
function prepare(root,port,env){
 if(fs.existsSync(root)||!path.isAbsolute(root)||fs.realpathSync(path.dirname(root))!==path.dirname(root))throw failure();
 fs.mkdirSync(root);root=fs.realpathSync(root);
 // Private root ACL, inherited by keys/config/profile. No certificate trust installation.
 const identity=run('whoami.exe',['/user','/fo','csv','/nh'],{encoding:'utf8'}),sid=identity.match(/S-1-5-(?:\d+-)*\d+/)?.[0];if(!sid)throw failure();
 run('icacls.exe',[root,'/inheritance:r','/grant:r',`*${sid}:(OI)(CI)F`]);
 const runId=randomUUID(),name='inquello_auth0_'+runId.replaceAll('-',''),db=database(env,name);
 const state={version:1,runId,databaseName:name,databaseContext:createHash('sha256').update(JSON.stringify([db.pg.PGHOST,db.pg.PGPORT,db.pg.PGUSER,db.pg.PGSSLMODE??null])).digest('hex'),port,root,engineTree:ENGINE_TREE,state:'preparing'};
 json(path.join(root,'pilot.json'),state);
 run(PSQL,['-X','-v','ON_ERROR_STOP=1','-At','-c',`CREATE DATABASE "${name}"`],{env:{...baseEnv(env),...db.pg}});
 const tls=path.join(root,'tls');fs.mkdirSync(tls);const ssl=(...args)=>run(OPENSSL,args,{cwd:tls,env:baseEnv(env)});
 ssl('req','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:prime256v1','-nodes','-keyout','ca.key','-out','ca.pem','-days','7','-subj','/CN=Inquello owned development CA','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign');
 ssl('req','-newkey','ec','-pkeyopt','ec_paramgen_curve:prime256v1','-nodes','-keyout','server.key','-out','server.csr','-subj','/CN=127.0.0.1');
 fs.writeFileSync(path.join(tls,'ext.cnf'),'subjectAltName=IP:127.0.0.1\nbasicConstraints=CA:FALSE\n');
 ssl('x509','-req','-in','server.csr','-CA','ca.pem','-CAkey','ca.key','-CAcreateserial','-out','server.pem','-days','7','-extfile','ext.cnf');
 const configFile=path.join(root,'config.json');json(configFile,normalConfig(root,port));
 json(path.join(root,'serve.json'),{bind:`127.0.0.1:${port}`,database_env:'INQUELLO_PILOT_DATABASE_URL',tls:{cert_chain_path:path.join(tls,'server.pem'),private_key_path:path.join(tls,'server.key')},issuer:{issuer:ISSUER,client_id:CLIENT,redirect_uri:'http://127.0.0.1:43821/callback'},lifetimes:{login_transaction_seconds:600,access_seconds:900,refresh_seconds:3600,session_seconds:86400,id_token_clock_skew_seconds:60,invite_seconds:604800}});
 const profile=path.join(root,'profile');fs.mkdirSync(profile);
 json(path.join(root,'.inquello-dev-profile'),{version:1,runId,profileRoot:profile,configFile,configSha256:hash(configFile),state:'new',profileNonce:randomUUID()});
 state.state='ready';state.configSha256=hash(configFile);state.serveSha256=hash(path.join(root,'serve.json'));state.caSha256=hash(path.join(tls,'ca.pem'));fs.writeFileSync(path.join(root,'pilot.json'),JSON.stringify(state,null,2));return state;
}
function resume(root){if(!path.isAbsolute(root)||fs.realpathSync(root)!==root||!fs.lstatSync(root).isDirectory()||fs.lstatSync(root).isSymbolicLink())throw failure();const s=JSON.parse(fs.readFileSync(regular(path.join(root,'pilot.json')),'utf8'));if(s.version!==1||s.root!==root||s.state!=='ready'||s.engineTree!==ENGINE_TREE||!/^inquello_auth0_[a-f0-9]{32}$/.test(s.databaseName)||s.databaseName!=='inquello_auth0_'+String(s.runId).replaceAll('-','')||!Number.isInteger(s.port)||s.port<1024||s.port>65535||s.port===43821)throw failure();for(const [file,digest]of [['config.json',s.configSha256],['serve.json',s.serveSha256],['tls/ca.pem',s.caSha256]])if(hash(regular(path.join(root,file)))!==digest)throw failure();if(JSON.stringify(JSON.parse(fs.readFileSync(path.join(root,'config.json'),'utf8')))!==JSON.stringify(normalConfig(root,s.port)))throw failure();return s;}
function waitLine(child,predicate,timeout){return new Promise((resolve,reject)=>{const lines=readline.createInterface({input:child.stdout});const timer=setTimeout(()=>finish(failure()),timeout);const finish=(error,value)=>{clearTimeout(timer);lines.close();child.off('exit',exit);child.off('error',errorHandler);error?reject(error):resolve(value);};const exit=()=>finish(failure()),errorHandler=()=>finish(failure());child.once('exit',exit);child.once('error',errorHandler);lines.on('line',line=>{if(line.length>65536)return finish(failure());let value;try{value=JSON.parse(line);}catch{return;}if(predicate(value))finish(null,value);});});}
async function waitExit(child,timeout){if(child.pid===undefined)return true;if(child.exitCode!==null||child.signalCode!==null)return true;return new Promise(resolve=>{const timer=setTimeout(()=>done(false),timeout);const done=value=>{clearTimeout(timer);child.off('exit',exit);resolve(value);};const exit=()=>done(true);child.once('exit',exit);});}
function safeEnd(child){const stream=child?.stdin;if(!stream||stream.destroyed||stream.writableEnded)return;try{stream.end();}catch{/* Fixed cleanup result below remains authoritative. */}}
async function cleanupOwned({service,electron,guard,cleanRuntimeExit},wait=waitExit){const failures=[];if(electron?.pid!==undefined&&!guard)failures.push('owned-electron-identity-unresolved');if(electron&&guard)try{await guard.stop(cleanRuntimeExit);}catch{failures.push('owned-electron-cleanup-unresolved');}if(service){safeEnd(service);if(!await wait(service,20000))failures.push('owned-service-cleanup-unresolved');}return failures;}
async function main(args=process.argv.slice(2),env=process.env){
 const options=parseArgs(args);if(process.platform!=='win32')throw failure();
 const desktop=path.resolve(__dirname,'..'),repo=path.dirname(desktop),build=verifyBuild(repo,path.resolve(options['--manifest']));
 regular(OPENSSL,134217728);regular(PSQL,134217728);
 const root=path.resolve(options['--resume']||options['--root']);let state;
 if(options['--resume'])state=resume(root);
 const port=state?.port??Number(options['--port']);await available(port);await available(43821);
 if(!state)state=prepare(root,port,env);
 const db=database(env,state.databaseName),clean=baseEnv(env);if(state.databaseContext!==createHash('sha256').update(JSON.stringify([db.pg.PGHOST,db.pg.PGPORT,db.pg.PGUSER,db.pg.PGSSLMODE??null])).digest('hex'))throw failure();let service,electron,guard,cleanRuntimeExit=false;
 const record=event=>fs.appendFileSync(path.join(root,'lifecycle.jsonl'),JSON.stringify({at:new Date().toISOString(),...event})+'\n');
 let stopping=false;const stop=()=>{stopping=true;safeEnd(electron);safeEnd(service);};process.once('SIGINT',stop);process.once('SIGTERM',stop);
 try{
  service=spawn(build.service,['serve','--config',path.join(root,'serve.json'),'--exit-on-stdin-eof'],{env:{...clean,INQUELLO_PILOT_DATABASE_URL:db.url},stdio:['pipe','pipe','pipe'],windowsHide:true});
  // Never persist service stderr or session/config contents; fixed readiness only.
  service.on('error',()=>{});service.stdin.on('error',()=>{});service.stderr.resume();service.once('exit',()=>{if(electron)stopping=true;});await waitLine(service,v=>v.service_url===normalConfig(root,port).service_url&&v.deployment==='production'&&v.delivery==='not_configured',60000);
  record({event:'service-ready',pid:service.pid,serviceUrl:normalConfig(root,port).service_url});
  if(stopping)throw failure();
  const electronBinary=path.join(desktop,'node_modules','electron','dist','electron.exe');
  electron=spawn(electronBinary,['.',...(options['--resume']?['--resume-owned-profile']:[])],{cwd:desktop,env:{...clean,INQUELLO_SERVICE_CONFIG:path.join(root,'config.json'),INQUELLO_DEV_PROFILE:path.join(root,'profile'),INQUELLO_DEV_RUN_ID:state.runId,INQUELLO_APP_SERVER:build.runtime,INQUELLO_CODEX_CLI:build.cli},stdio:['pipe','pipe','pipe'],windowsHide:false});
  electron.on('error',()=>{});electron.stdin.on('error',()=>{});electron.stderr.resume();guard=createOwnedProcessGuard(electron,{executable:electronBinary});
  const lines=readline.createInterface({input:electron.stdout});lines.on('line',line=>{try{const v=JSON.parse(line);if(v.event==='runtime-exit'&&v.state==='stopped'&&v.exit?.exitCode===0&&v.exit.killed===false)cleanRuntimeExit=true;}catch{}});
  let evidence,ready=false;await waitLine(electron,v=>{if(v.event==='owned-dev-ready'&&v.runId===state.runId)ready=true;if(v.event==='owned-dev-profile'&&v.runId===state.runId&&v.userData===path.join(root,'profile')&&typeof v.runtimeHome==='string'&&path.relative(v.userData,v.runtimeHome)&&!path.relative(v.userData,v.runtimeHome).startsWith('..')&&!path.isAbsolute(path.relative(v.userData,v.runtimeHome)))evidence=v;return Boolean(evidence&&ready);},60000);
  record(evidence);console.log(JSON.stringify({event:'PILOT_READY',runId:state.runId,root,servicePid:service.pid,electronPid:electron.pid,serviceUrl:normalConfig(root,port).service_url}));
  // Human-driven browser sign-in. No login clicks, tokens, membership helpers or screenshots.
  await new Promise(resolve=>{electron.once('exit',resolve);const timer=setInterval(()=>{if(stopping){clearInterval(timer);resolve();}},500);timer.unref();electron.once('exit',()=>clearInterval(timer));});lines.close();
 }finally{
  const failures=await cleanupOwned({service,electron,guard,cleanRuntimeExit});
  record({event:'pilot-stopped',retained:true,servicePid:service?.pid,electronPid:electron?.pid,cleanupErrors:failures});process.off('SIGINT',stop);process.off('SIGTERM',stop);
  console.log(JSON.stringify({event:'PILOT_STOPPED',root,retained:true,servicePid:service?.pid,electronPid:electron?.pid,cleanupErrors:failures}));if(failures.length)throw failure();
 }
}
module.exports={parseArgs,baseEnv,database,normalConfig,resume,safeEnd,cleanupOwned};
if(require.main===module)main().catch(()=>{console.error('Owned Auth0 pilot unavailable. Inspect public lifecycle evidence; retained data was not deleted.');process.exitCode=1;});
