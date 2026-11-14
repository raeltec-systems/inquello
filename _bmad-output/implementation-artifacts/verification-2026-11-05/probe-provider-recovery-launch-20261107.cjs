const {spawnSync}=require('node:child_process');
const env={...process.env,PATH:'D:\\Toolchains\\npm-global;C:\\Program Files\\Git\\usr\\bin;C:\\Program Files\\PostgreSQL\\18\\bin;'+process.env.PATH};
console.log(JSON.stringify({node:process.version,nodePath:process.execPath,comspec:env.COMSPEC,ComSpec:env.ComSpec}));
for(const command of ['pnpm --version','pnpm test -- --help']){
const r=spawnSync('C:/Windows/System32/cmd.exe',['/d','/c',command],{cwd:'D:/Projects/inquello/desktop',env,encoding:'utf8',timeout:30000,windowsHide:true});console.log(JSON.stringify({command,status:r.status,error:r.error?.message,stdout:r.stdout?.slice(0,2500),stderr:r.stderr?.slice(0,1000)}));}

for(const args of [['--version'],['test','--','--help']]){const r=spawnSync(process.execPath,['D:/Toolchains/npm-global/node_modules/pnpm/bin/pnpm.cjs',...args],{cwd:'D:/Projects/inquello/desktop',env,encoding:'utf8',timeout:30000,windowsHide:true});console.log(JSON.stringify({directPnpmArgs:args,status:r.status,error:r.error?.message,stdout:r.stdout?.slice(0,3000),stderr:r.stderr?.slice(0,1000)}));}
