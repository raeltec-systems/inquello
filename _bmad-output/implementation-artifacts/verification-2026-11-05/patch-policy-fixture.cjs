const fs=require('node:fs');const root='D:/Projects/inquello/desktop/test/';
for(const name of ['tool-bounds-integration','permissions-integration']){
const p=root+name+'.test.ts';let s=fs.readFileSync(p,'utf8');const nl=s.includes('\r\n')?'\r\n':'\n';s=s.replace(/\r\n/g,'\n');
function replace(a,b){if(!s.includes(a))throw Error(name+': missing '+a);s=s.replace(a,b);}
replace('  type ExecutionPolicyRoutes,\n','');
replace('let identity: IdentitySession;','let identity: IdentitySession;\nlet service: SharedServiceClient;');
replace('    const service = new SharedServiceClient(config.serviceUrl, transport);',`    service = new SharedServiceClient(config.serviceUrl, transport);
    // Production binds identity and policy to one service client. Keep the
    // fixture on that same fixed GET, after the actual authenticated membership
    // response; never replace authorization or route an arbitrary callback.
    const executionPolicy = service.executionPolicy.bind(service);
    service.executionPolicy = async (access, workspaceId) => ({
      ...(await executionPolicy(access, workspaceId)), policy_revision: String(revision), execution,
    });`);
s=s.replace('    // The real membership check, with the case\'s execution section.\n','');
replace(`    const routes: ExecutionPolicyRoutes = {
      executionPolicy: async (access, workspaceId) => ({ ...(await service.executionPolicy(access, workspaceId)), policy_revision: String(revision), execution }),
    };
`,'');
s=s.replaceAll('service: routes','service');
if(name==='tool-bounds-integration')replace("    const routes: ExecutionPolicyRoutes = { executionPolicy: async () => ({ workspace_id: seed.workspace_id, policy_revision: String(revision), authorization_epoch: '1', execution: null }) };\n",'');
else replace("      service: { executionPolicy: async () => ({ workspace_id: seed.workspace_id, policy_revision: String(revision), authorization_epoch: '1', execution }) },","      service,");
fs.writeFileSync(p,s.replace(/\n/g,nl));}
