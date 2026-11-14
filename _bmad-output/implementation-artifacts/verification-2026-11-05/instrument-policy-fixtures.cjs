const fs=require('fs'),path=require('path');const root='D:/Projects/inquello',out=root+'/_bmad-output/implementation-artifacts/verification-2026-11-05';
for(const name of ['tool-bounds-integration','permissions-integration']){
 const p=root+'/desktop/test/'+name+'.test.ts';fs.copyFileSync(p,out+'/'+name+'-before-diagnostics.ts',fs.constants.COPYFILE_EXCL);
 let s=fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
 s="import { instrument, retainNativeTimings } from './policy-phase-diagnostics';\n"+s;
 s=s.replace("import { taskFiles } from './task-files';","import { taskFiles as originalTaskFiles } from './task-files';\nconst taskFiles: typeof originalTaskFiles = (...args) => instrument(originalTaskFiles(...args), ['read','write','exists','remove','mkdir'], 'task-files');");
 s=s.replace('    await runtime.start();',"    instrument(runtime, ['start','request'], 'native');\n    await runtime.start();");
 s=s.replace('    identity = new IdentitySession({',"    instrument(service, ['executionPolicy'], 'authenticated-http');\n    identity = new IdentitySession({");
 s=s.replace('  }, 120_000);',"    instrument(policy, ['effectiveThreadSettings','forTask','runTool','setBroadMode','pendingPermissions'], 'policy');\n  }, 120_000);");
 s=s.replace('    await runtime?.stop();',"    retainNativeTimings(runtimeHome, '"+name+"-diagnostic');\n    await runtime?.stop();");
 s=s.replace("      expect(refused).toMatchObject({ ok: false, code: 'command-forbidden' });","      expect(refused, 'resolved program variant: '+program).toMatchObject({ ok: false, code: 'command-forbidden' });");
 fs.writeFileSync(p,s);
}
let launcher=fs.readFileSync(out+'/run-policy-fixture-integrations.cjs','utf8');
launcher=launcher.replace("'--maxWorkers=1']","'--maxWorkers=1','-t','keeps a standard Task|reaches only the listed|applies a rule to the resolved program']");
fs.writeFileSync(out+'/run-policy-failed-diagnostics.cjs',launcher,{flag:'wx'});
