const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root='D:/Projects/inquello',folder=__dirname;
const log=fs.openSync(path.join(folder,'provider-recovery-electron-final-20261107.log'),'wx');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(path.join(root,'desktop/node_modules/electron/dist/electron.exe'),[path.join(folder,'provider-recovery-electron-20261107.cjs')],{cwd:root,env,windowsHide:true,stdio:['ignore',log,log]});
child.on('error',error=>{console.log(error.message);process.exitCode=1;});
child.on('exit',(code,signal)=>{fs.closeSync(log);console.log(JSON.stringify({exitCode:code,signal}));process.exitCode=code??1;});
