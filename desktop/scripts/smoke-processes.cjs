/** Ownership-bounded cleanup for synthetic Electron launches only. */
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');

function windowsTree(pid,identities) {
  if(!Number.isSafeInteger(pid)||pid<=0||identities&&(!Array.isArray(identities)||identities.length>4096||identities.some(id=>!Number.isSafeInteger(id)||id<=0)))throw new Error('Owned process identity invalid');
  const script=`$ErrorActionPreference='Stop';$all=@(Get-CimInstance Win32_Process);$ids=[System.Collections.Generic.HashSet[int]]::new();${(identities??[pid]).map(id=>`[void]$ids.Add(${id});`).join('')}${identities?'':'do{$changed=$false;foreach($p in $all){if($ids.Contains([int]$p.ParentProcessId)-and !$ids.Contains([int]$p.ProcessId)){[void]$ids.Add([int]$p.ProcessId);$changed=$true}}}while($changed);'}$rows=@($all|Where-Object{$ids.Contains([int]$_.ProcessId)}|ForEach-Object{@{pid=[int]$_.ProcessId;created=$_.CreationDate.ToUniversalTime().Ticks.ToString();executable=$_.ExecutablePath}});ConvertTo-Json -Compress -InputObject $rows`;
  const raw=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:5000,windowsHide:true});
  const rows=JSON.parse(raw);
  if(!Array.isArray(rows)||rows.some(row=>!Number.isSafeInteger(row.pid)||typeof row.created!=='string'))throw new Error('Owned process identity unavailable');
  return rows;
}
const same=(a,b)=>a.pid===b.pid&&a.created===b.created;
const exited=child=>child.exitCode!==null||child.signalCode!==null||child.pid===undefined;
const absent=error=>error&&error.code==='ESRCH';

/** Injected OS adapters allow unit tests without touching any real process. */
function createOwnedProcessGuard(child,options={}) {
  const platform=options.platform??process.platform;
  const readTree=options.readWindowsTree??windowsTree;
  const canonicalExecutable=options.canonicalExecutable??(file=>fs.realpathSync.native(file).toLowerCase());
  const taskkill=options.taskkill??(pid=>execFileSync('taskkill.exe',['/PID',String(pid),'/T','/F'],{stdio:'pipe',timeout:5000,windowsHide:true}));
  const killGroup=options.killGroup??((pid,signal)=>process.kill(-pid,signal));
  const sleep=options.sleep??(ms=>new Promise(resolve=>setTimeout(resolve,ms)));
  const now=options.now??Date.now;
  const pid=child.pid;
  let initial;
  if(platform==='win32'&&pid!==undefined) {
    const rows=readTree(pid);initial=rows.find(row=>row.pid===pid);
    if(!initial||typeof initial.executable!=='string'||typeof options.executable!=='string'||canonicalExecutable(initial.executable)!==canonicalExecutable(options.executable))throw new Error('Owned Electron creation identity unavailable');
  }
  async function stop(cleanRuntimeExit=false) {
    if(pid===undefined)return;
    if(exited(child)) {
      if(cleanRuntimeExit)return;
      throw new Error('Electron parent exited without verified runtime shutdown; descendants unresolved');
    }
    let captured;
    if(platform==='win32') {
      captured=readTree(pid);
      if(captured.length>4096)throw new Error('Owned Electron tree exceeds verification bound');
      const current=captured.find(row=>row.pid===pid);
      if(!current||!same(initial,current)||typeof current.executable!=='string'||canonicalExecutable(current.executable)!==canonicalExecutable(initial.executable)||exited(child))throw new Error('Owned Electron identity changed; descendants unresolved');
      // Never kill the parent first: /T resolves its descendants while it exists.
      try{taskkill(pid);}catch{throw new Error('Owned Electron tree termination failed; descendants unresolved');}
    } else {
      // Launcher creates a fresh detached session/process group for this child.
      try{killGroup(pid,'SIGTERM');}catch(error){if(!absent(error))throw new Error('Owned Electron group termination failed');}
    }
    const deadline=now()+5000;
    let escalated=false;
    while(true) {
      let treeGone;
      if(platform==='win32') {
        // Query captured identities directly, including reparented grandchildren,
        // in ONE bounded OS call. A reused PID is not an owned survivor.
        const remaining=readTree(pid,captured.map(owned=>owned.pid));
        treeGone=!remaining.some(row=>captured.some(owned=>same(owned,row)));
      } else {
        try{killGroup(pid,0);treeGone=false;}catch(error){if(!absent(error))throw new Error('Owned Electron group verification failed');treeGone=true;}
      }
      if(exited(child)&&treeGone)return;
      if(now()>=deadline) {
        if(platform!=='win32'&&!escalated) {
          escalated=true;
          try{killGroup(pid,'SIGKILL');}catch(error){if(!absent(error))throw new Error('Owned Electron group force-stop failed');}
          // One bounded final observation window, not an unbounded retry loop.
          const finalDeadline=now()+5000;
          while(now()<finalDeadline) {
            await sleep(100);
            try{killGroup(pid,0);}catch(error){if(absent(error)&&exited(child))return;if(!absent(error))throw new Error('Owned Electron group verification failed');}
          }
        }
        throw new Error('Owned Electron descendants did not terminate within bound');
      }
      await sleep(100);
    }
  }
  return{stop};
}
module.exports={createOwnedProcessGuard};
