const {contextBridge}=require('electron');
const status={claude:{state:'not-configured',storage:'os-backed'},codex:{state:'not-connected',account:null,credentialStore:'os-keyring'},routes:{'claude-api-key':{authorized:false,reason:'Synthetic fixture'},'codex-inherited':{authorized:false,reason:'Synthetic fixture'}}};
const mode=process.argv.find(x=>x.startsWith('--fixture-failure='))?.split('=')[1];
const calls={claude:0,codex:0};
function mutate(provider){
 calls[provider]++;
 if(calls[provider]===1){if(mode==='sync')throw new Error('Synthetic private bridge detail');return Promise.reject(new Error('Synthetic private bridge detail'));}
 if(provider==='claude'){status.claude.state='stored-unverified';status.routes['claude-api-key'].authorized=true;}
 else{status.codex.state='connected';status.codex.account={type:'apiKey'};status.routes['codex-inherited'].authorized=true;}
 return Promise.resolve({ok:true,status});
}
contextBridge.exposeInMainWorld('inquello',{provider:{getStatus:async()=>status,refreshStatus:async()=>status,setClaudeKey:()=>mutate('claude'),verifyClaudeKey:async()=>({ok:true,status}),removeClaudeKey:async()=>({ok:true,status}),codexLogin:()=>mutate('codex'),codexLogout:async()=>({ok:true,status})}});
contextBridge.exposeInMainWorld('providerRecoveryFixture',{counts:()=>({...calls})});
