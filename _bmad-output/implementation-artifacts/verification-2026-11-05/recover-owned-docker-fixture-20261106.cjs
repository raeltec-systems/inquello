// Restore only the previously owned disposable PostgreSQL fixture after Docker restart.
const fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {isPrivatePath}=require('D:/Projects/inquello/desktop/dist/main/runtime/private-paths.js');
const file='D:/Inquello/tmp/epic1-pg-20261105-d778fa3f/ownership.json';
if(!isPrivatePath(file,'file'))throw Error('Receipt privacy failed');
const r=JSON.parse(fs.readFileSync(file,'utf8'));
const docker='C:/Program Files/Docker/Docker/resources/bin/docker.exe';
function call(args){const x=spawnSync(docker,args,{encoding:'utf8',timeout:15000,windowsHide:true,stdio:['ignore','pipe','pipe']});if(x.error||x.status!==0)throw Error('Docker check/action failed: '+args[0]);return x.stdout.trim();}
if(r.status!=='ready'||r.runId!=='20261105-d778fa3f'||r.name!=='inquello-epic1-verify-20261105-d778fa3f'||r.volume!==r.name+'-data'||r.port!==55318||r.image!=='postgres@sha256:3a4264520e121176619f54ff867d12774bc81e95e7b84db58d63bccdb6144b81'||path.dirname(r.passwordFile)!==r.root||!isPrivatePath(r.passwordFile,'file'))throw Error('Unexpected ownership receipt');
const names=call(['ps','-a','--format','{{.Names}}']).split(/\r?\n/);
if(names.includes(r.name))throw Error('Container now exists; inspect outcome before another action');
const v=JSON.parse(call(['volume','inspect','--format','{{json .}}',r.volume]));
if(v.Labels?.['com.inquello.epic1.fixture']!==r.runId)throw Error('Volume ownership mismatch');
if(call(['image','inspect','--format','{{.Id}}',r.image])!==r.image.replace('postgres@',''))throw Error('Image mismatch');
const backup=path.join(r.root,'ownership-before-docker-recovery-20261106.json');
fs.copyFileSync(file,backup,fs.constants.COPYFILE_EXCL);
const id=call(['run','--detach','--rm','--pull=never','--name',r.name,'--label','com.inquello.epic1.fixture='+r.runId,'--publish','127.0.0.1:'+r.port+':5432','--mount','type=volume,source='+r.volume+',target=/var/lib/postgresql','--mount','type=bind,source='+r.passwordFile+',target=/run/secrets/inquello-test-password,readonly','--env','POSTGRES_PASSWORD_FILE=/run/secrets/inquello-test-password','--env','POSTGRES_USER=inquello_verify','--env','POSTGRES_DB=inquello_test',r.image]);
r.priorContainerId=r.containerId;r.containerId=id;r.status='starting';r.recoveredAt=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(r,null,2));
(async()=>{let ready=false;
for(let i=0;i<60;i++){const x=spawnSync(docker,['exec',r.name,'pg_isready','-h','127.0.0.1','-U','inquello_verify','-d','inquello_test'],{encoding:'utf8',timeout:5000,windowsHide:true,stdio:['ignore','pipe','pipe']});if(x.status===0){ready=true;break}await new Promise(y=>setTimeout(y,1000));}
if(!ready)throw Error('PostgreSQL readiness incomplete');
const actual=JSON.parse(call(['inspect','--format','{{json .}}',r.name]));
const binds=actual.HostConfig?.PortBindings?.['5432/tcp'];
if(actual.Id!==id||!actual.State?.Running||actual.Config?.Labels?.['com.inquello.epic1.fixture']!==r.runId||binds?.length!==1||binds[0].HostIp!=='127.0.0.1'||binds[0].HostPort!=='55318'||!actual.Mounts?.some(x=>x.Type==='volume'&&x.Name===r.volume&&x.Destination==='/var/lib/postgresql'))throw Error('Recreated fixture identity mismatch');
const env={...process.env,PGHOST:'127.0.0.1',PGPORT:String(r.port),PGUSER:'inquello_verify',PGPASSWORD:fs.readFileSync(r.passwordFile,'utf8').trim(),PGDATABASE:'inquello_test',PGCONNECT_TIMEOUT:'5',PGOPTIONS:'-c default_transaction_read_only=on'};
delete env.PGSERVICE;delete env.PGSERVICEFILE;
const result=spawnSync('C:/Program Files/PostgreSQL/18/bin/psql.exe',['-X','-w','-q','-A','-t','-c',"SELECT current_setting('server_version_num'), EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolcreatedb), current_database()='inquello_test';"],{env,encoding:'utf8',windowsHide:true,timeout:10000,stdio:['ignore','pipe','pipe']});delete env.PGPASSWORD;
if(result.status!==0||result.stdout.trim()!=='180006|t|t')throw Error('PostgreSQL prerequisites not verified');
r.status='ready';fs.writeFileSync(file,JSON.stringify(r,null,2));
if(!isPrivatePath(file,'file')||!isPrivatePath(backup,'file'))throw Error('Receipt privacy changed');
console.log(JSON.stringify({status:'ready',name:r.name,containerId:id,volume:r.volume,port:r.port,preservedVolume:true,pulledImage:false,credentialPrinted:false}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
