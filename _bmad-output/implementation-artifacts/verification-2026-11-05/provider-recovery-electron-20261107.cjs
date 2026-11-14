const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const root='D:/Projects/inquello',evidence=__dirname;
const output=fs.mkdtempSync('D:/Inquello/tmp/provider-recovery-ui-');
app.setPath('userData',path.join(output,'profile'));
app.on('window-all-closed',()=>{});
let window;
const run=async script=>window.webContents.executeJavaScript(`(async()=>{const wait=async fn=>{for(let n=0;n<100;n++){const value=fn();if(value)return value;await new Promise(r=>setTimeout(r,50));}throw Error('UI assertion timed out');};const button=name=>[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===name);const type=(id,value)=>{const node=document.getElementById(id);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));};${script}})()`);
app.whenReady().then(async()=>{
 const reports=[];
 try{
  for(const mode of ['sync','async']){
   window=new BrowserWindow({width:1280,height:900,show:true,webPreferences:{preload:path.join(evidence,'provider-recovery-electron-preload-20261107.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,additionalArguments:['--fixture-failure='+mode]}});
   const errors=[];window.webContents.on('render-process-gone',()=>errors.push('renderer exited'));
   await window.loadFile(path.join(root,'desktop/dist/renderer/index.html'),{hash:'settings-providers'});
   await run("await wait(()=>document.querySelector('[data-codex-state=\"not-connected\"]'));return true;");
   for(const [provider,id,label,state] of [['claude','provider-claude-key','Store key','stored-unverified'],['codex','provider-codex-key','Connect with API key','connected']]){
    await run(`type('${id}','synthetic-local-only');await wait(()=>button('${label}')?.getAttribute('aria-disabled')!=='true');button('${label}').focus();button('${label}').click();await wait(()=>document.body.textContent.includes('The request did not complete.'));await wait(()=>!button('${label}').hasAttribute('aria-busy'));if(document.getElementById('${id}').value!=='')throw Error('Key field retained');if(button('Refresh provider status').getAttribute('aria-disabled')==='true')throw Error('Refresh remained blocked');if(document.body.textContent.includes('Synthetic private bridge detail'))throw Error('Private error exposed');document.getElementById('${id}').scrollIntoView({block:'center'});return true;`);
    await new Promise(r=>setTimeout(r,100));fs.writeFileSync(path.join(output,mode+'-'+provider+'-failed.png'),(await window.webContents.capturePage()).toPNG());
    await run(`type('${id}','synthetic-local-only');await wait(()=>button('${label}')?.getAttribute('aria-disabled')!=='true');button('${label}').click();await wait(()=>document.querySelector('[data-${provider}-state="${state}"]'));await wait(()=>!button('${label}').hasAttribute('aria-busy'));if(document.getElementById('${id}').value!=='')throw Error('Retry retained key');if(document.body.textContent.includes('The request did not complete.'))throw Error('Stale error');if(window.providerRecoveryFixture.counts()['${provider}']!==2)throw Error('Wrong dispatch count');return true;`);
    reports.push({mode,provider,ok:true,dispatches:2,keyCleared:true,controlsRecovered:true});
   }
   if(errors.length)throw Error('Renderer exited');window.destroy();window=null;
  }
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({ok:true,scope:'Actual production renderer in Electron; synthetic provider bridge, no native credential operation, no external request.',reports},null,2));console.log(JSON.stringify({ok:true,output,reports}));app.exit(0);
 }catch(error){console.log(JSON.stringify({ok:false,output,error:String(error.message),reports}));if(window&&!window.isDestroyed())window.destroy();app.exit(1);}
});
