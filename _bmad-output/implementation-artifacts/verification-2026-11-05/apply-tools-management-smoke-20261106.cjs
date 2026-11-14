
const fs=require('node:fs'),root='D:/Projects/inquello/';
function edits(file,changes){let s=fs.readFileSync(root+file,'utf8');for(const [a,b] of changes){if(s.split(a).length!==2)throw Error('Nonunique patch '+file+' '+a);s=s.replace(a,b);}fs.writeFileSync(root+file,s);}
edits('desktop/src/main/main.ts',[
 ["const navigationSmoke =", "const toolsManagementSmoke = !app.isPackaged && process.argv.includes('--smoke-tools-management');\nlet toolsManagementOk = false;\nconst navigationSmoke ="],
 ["|| visualSmoke || onboardingSmoke;","|| visualSmoke || onboardingSmoke || toolsManagementSmoke;"],
 ["  if (visualSmoke) {",`  if (toolsManagementSmoke) {
    if (!identity || !organise || !capabilities || !runtime) throw new Error('Tools management services unavailable');
    const {probeToolsManagement}=await import('./smoke-probe');
    const report=await probeToolsManagement(contents,{identity,organise,capabilities,seedFile:process.env.INQUELLO_SMOKE_SEED??null,
      runtimeHome:governedRoots(app.getPath('userData'))['runtime-home'],
      restartRuntime:async()=>{await stopRuntime();await startRuntime();},
      runtimeRequest:<T,>(method:string,params?:unknown)=>runtime!.request<T>(method,params)});
    toolsManagementOk=report.ok;process.stdout.write(JSON.stringify({event:'tools-management',...report})+'\\n');return;
  }
  if (visualSmoke) {`],
 ["  if (visualSmoke) return handshakeOk", "  if (toolsManagementSmoke) return handshakeOk && toolsManagementOk && exit?.exitCode === 0 && !exit.killed ? 0 : 1;\n  if (visualSmoke) return handshakeOk"]
]);
edits('desktop/scripts/run-seeded-smoke.cjs',[
 ["const isolatedPhase=onboardingOnly?", "const toolsOnly=process.argv.includes('--tools-only');\nif(toolsOnly&&process.argv.slice(2).some(arg=>arg!=='--tools-only'))throw new Error('Tools management is an exclusive owned smoke phase');\nconst isolatedPhase=toolsOnly?'tools':onboardingOnly?"],
 ["isolatedPhase==='visual'?'visual-conversation':'quota'", "isolatedPhase==='visual'?'visual-conversation':isolatedPhase==='tools'?'tools-management':'quota'"],
 ["[...normalRequired,'quota','visual-conversation']", "[...normalRequired,'quota','visual-conversation','tools-management']"],
 ["const quota=phase==='quota',visual=phase==='visual',onboarding=phase==='onboarding';", "const quota=phase==='quota',visual=phase==='visual',onboarding=phase==='onboarding',tools=phase==='tools';"],
 ["if(quota)policy.execution=", "if(tools)policy.execution={sandbox:'workspace_write',approvals:['on_request'],network:'allowed',allowed_domains:['127.0.0.1'],mcp_tools:'allowed',extensions:'denied',allow_local_mcp_servers:false};\n  if(quota)policy.execution="],
 ["quota?'Synthetic quota audit':visual?'Mupeta & Partners':'Synthetic recovery audit'", "tools?'Synthetic tools setup':quota?'Synthetic quota audit':visual?'Mupeta & Partners':'Synthetic recovery audit'"],
 ["['.',onboarding?'--smoke-onboarding'", "['.',tools?'--smoke-tools-management':onboarding?'--smoke-onboarding'"],
 ["const expected=onboarding?['onboarding']", "const expected=tools?['tools-management']:onboarding?['onboarding']"],
 ["  const observed=[...normal.events,...(quota?.events??[]),...(visual?.events??[])];", "  const tools=navigationOnly?null:normal.cleanupErrors.length||quota.cleanupErrors.length||visual.cleanupErrors.length?skipped:await launch('tools');\n  const observed=[...normal.events,...(quota?.events??[]),...(visual?.events??[]),...(tools?.events??[])];"],
 ["quota?.ok===true&&visual?.ok===true", "quota?.ok===true&&visual?.ok===true&&tools?.ok===true"],
 ["phases:{normal,quota,visual}", "phases:{normal,quota,visual,tools}"]
]);
