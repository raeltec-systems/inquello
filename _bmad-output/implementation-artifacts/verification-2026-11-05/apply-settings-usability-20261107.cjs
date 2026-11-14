const fs=require('node:fs'),path=require('node:path');
const root='D:/Projects/inquello';
function edit(file,update){const p=path.join(root,file),old=fs.readFileSync(p,'utf8'),next=update(old);if(next===old)throw Error('Unchanged: '+file);fs.writeFileSync(p,next);}
function replace(s,a,b){if(s.split(a).length!==2)throw Error('Expected one occurrence: '+a.slice(0,80));return s.replace(a,b);}
edit('desktop/src/renderer/Settings.tsx',s=>replace(s,"useEffect(()=>{if(current==='tools')heading.current?.focus();},[current]);","// Provider reconnect destinations focus their own exact control.\n useEffect(()=>{if(!focusTarget)heading.current?.focus();},[current,focusTarget]);"));
edit('desktop/src/renderer/Capabilities.tsx',s=>replace(s,'<CapabilityInventory workspaceId={workspace.workspaceId} workspaceName={workspace.name} />','<CapabilityInventory workspaceId={workspace.workspaceId} workspaceName={workspace.name} showHeading={false} />'));
edit('desktop/src/renderer/CapabilityInventory.tsx',s=>{
 s=replace(s,'export function CapabilityInventory({ workspaceId, workspaceName }: { workspaceId: string; workspaceName: string }): ReactElement {','export function CapabilityInventory({ workspaceId, workspaceName, showHeading = true }: { workspaceId: string; workspaceName: string; showHeading?: boolean }): ReactElement {');
 s=replace(s,'<h3 className="specimen-policy-heading">Tools and connections</h3>','{showHeading ? <h3 className="specimen-policy-heading">Tools and connections</h3> : null}');
 const start=s.indexOf('    {bridge ? <form'),end=s.indexOf('    </form> : null}',start)+'    </form> : null}'.length;
 if(start<0||end<start)throw Error('Form not found');
 let form=s.slice(start,end);
 form=replace(form,'className="specimen-account-form"','className="specimen-account-form iq-tools-add"');
 s=s.slice(0,start)+s.slice(end);
 return replace(s,'    {view ? <>',form+'\n    {view ? <>');
});
edit('desktop/src/renderer/Shell/shell.css',s=>s+('\n/* Keep Settings navigation available beside long connection inventories. */\n'+
'@media(min-width:701px) { .iq-settings > nav { position:sticky; top:0; align-self:start; height:100vh; overflow-y:auto; box-sizing:border-box; } }\n'+
'.iq-settings-panel { min-width:0; overflow-wrap:anywhere; }\n'+
'.iq-settings-panel [data-capabilities-section] { max-width:none; }\n'+
'.iq-settings-panel .iq-tools-add { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:var(--space-3); margin-block:var(--space-3); padding:var(--space-4); border:1px solid var(--border-default); border-radius:var(--radius-md); }\n'+
'.iq-settings-panel .iq-tools-add > h4 { margin:0; font:var(--type-ui); font-weight:500; grid-column:1 / -1; }\n'+
'.iq-settings-panel .iq-tools-add > :nth-child(n+4) { grid-column:1 / -1; }\n'+
'.iq-settings-panel .iq-tools-add > label { display:grid; gap:var(--space-1); align-content:start; font:var(--type-ui); }\n'+
'.iq-settings-panel .iq-tools-add select { min-width:0; max-width:100%; min-height:32px; font:inherit; color:var(--text-primary); background:var(--surface-app); border:1px solid var(--border-default); border-radius:var(--radius-md); padding:var(--space-1) var(--space-2); }\n'+
'.iq-settings-panel .iq-tools-add input { min-width:0; }\n'+
'@media(max-width:700px) { .iq-settings-panel .iq-tools-add { grid-template-columns:minmax(0,1fr); } }\n'));
console.log('Settings usability changes applied. Authority and runtime source unchanged.');
