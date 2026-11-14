// Disposable, owned PostgreSQL fixture. No image pulls or shared-service changes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {ensurePrivateDirectory,restrictPrivateFile,isPrivatePath}=require('D:/Projects/inquello/desktop/dist/main/runtime/private-paths.js');
const docker='C:/Program Files/Docker/Docker/resources/bin/docker.exe';
const image='postgres@sha256:3a4264520e121176619f54ff867d12774bc81e95e7b84db58d63bccdb6144b81';
const runId='20261105-'+crypto.randomBytes(4).toString('hex');
const name='inquello-epic1-verify-'+runId,volume=name+'-data';
const root=path.join('D:/Inquello/tmp','epic1-pg-'+runId),port=55318;
const passwordFile=path.join(root,'password.txt'),receiptFile=path.join(root,'ownership.json');
let stage='preflight',receipt={runId,name,volume,root,port,image,passwordFile,createdVolume:false,containerId:null,status:'preparing'};
function call(args,timeout=60000){
 const r=spawnSync(docker,args,{encoding:'utf8',windowsHide:true,timeout,stdio:['ignore','pipe','pipe']});
 if(r.error||r.status!==0)throw new Error('Docker operation failed at '+stage+'; inspect owned resource before retry.');
 return r.stdout.trim();
}
function save(){fs.writeFileSync(receiptFile,JSON.stringify(receipt,null,2));restrictPrivateFile(receiptFile);}
(async()=>{
 try{
  call(['image','inspect',image,'--format','{{.Id}}']);
  if(fs.existsSync(root))throw new Error('Fixture directory already exists.');
  ensurePrivateDirectory(root);
  if(!isPrivatePath(root,'directory'))throw new Error('Fixture directory privacy not verified.');
  fs.writeFileSync(passwordFile,crypto.randomBytes(32).toString('hex')+'\n',{flag:'wx',mode:0o600});
  restrictPrivateFile(passwordFile);
  if(!isPrivatePath(passwordFile,'file'))throw new Error('Fixture password privacy not verified.');
  save();
  stage='create-owned-volume';
  call(['volume','create','--label','com.inquello.epic1.fixture='+runId,volume]);
  receipt.createdVolume=true;save();
  stage='start-owned-container';
  receipt.containerId=call(['run','--detach','--rm','--pull=never','--name',name,
   '--label','com.inquello.epic1.fixture='+runId,
   '--publish','127.0.0.1:'+port+':5432',
   '--mount','type=volume,source='+volume+',target=/var/lib/postgresql',
   '--mount','type=bind,source='+passwordFile+',target=/run/secrets/inquello-test-password,readonly',
   '--env','POSTGRES_PASSWORD_FILE=/run/secrets/inquello-test-password',
   '--env','POSTGRES_USER=inquello_verify','--env','POSTGRES_DB=inquello_test',
   image]);
  receipt.status='starting';save();
  stage='wait-for-ready';
  let ready=false;
  for(let i=0;i<60;i++){
   const r=spawnSync(docker,['exec',name,'pg_isready','-h','127.0.0.1','-U','inquello_verify','-d','inquello_test'],{encoding:'utf8',windowsHide:true,timeout:5000,stdio:['ignore','pipe','pipe']});
   if(r.status===0){ready=true;break}
   await new Promise(r=>setTimeout(r,1000));
  }
  if(!ready)throw new Error('Owned PostgreSQL fixture did not become ready.');
  stage='verify-host-authentication';
  const env={...process.env,PGHOST:'127.0.0.1',PGPORT:String(port),PGUSER:'inquello_verify',PGPASSWORD:fs.readFileSync(passwordFile,'utf8').trim(),PGDATABASE:'inquello_test',PGCONNECT_TIMEOUT:'5',PGOPTIONS:'-c default_transaction_read_only=on'};
  delete env.PGSERVICE;delete env.PGSERVICEFILE;
  const result=spawnSync('C:/Program Files/PostgreSQL/18/bin/psql.exe',['-X','-w','-q','-A','-t','-c',"SELECT current_setting('server_version_num'), EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolcreatedb), current_database()='inquello_test';"],{env,encoding:'utf8',windowsHide:true,timeout:10000,stdio:['ignore','pipe','pipe']});
  delete env.PGPASSWORD;
  if(result.status!==0||result.stdout.trim()!=='180006|t|t')throw new Error('Owned PostgreSQL prerequisites not verified.');
  receipt.status='ready';save();
  console.log(JSON.stringify({status:'ready',name,volume,port,image,receiptFile,postgresql18:true,canCreateDatabase:true,loopbackOnly:true}));
 }catch(e){
  if(fs.existsSync(root)){receipt.status='failed';receipt.failedStage=stage;save();}
  console.error('Fixture preparation failed at '+stage+'. '+e.message+' No unrelated resource was changed.');
  process.exitCode=1;
 }
})();
