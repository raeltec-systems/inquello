const fs=require('node:fs');
const root='D:/Projects/inquello/';
const file=root+'desktop/src/renderer/CapabilityInventory.tsx';let source=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
function replace(before,after){if(!source.includes(before))throw Error('Expected source absent: '+before.slice(0,100));source=source.replace(before,after);}
replace('type Inventory }','type Inventory, type InventoryEntry }');
replace("export const LOCAL_MCP_CONFIRMATION",`// Present the useful member of a paired action using the last authoritative read.
// Unknown state and sole runtime-provided actions are not inferred or replaced.
function inventoryActions(entry: InventoryEntry): CapabilityAction[] {
  if (entry.state_known === false || !entry.actions.includes('enable') || !entry.actions.includes('disable')) return entry.actions;
  return entry.actions.filter(action => action !== (entry.enabled ? 'enable' : 'disable'));
}

export const LOCAL_MCP_CONFIRMATION`);
replace('<ul>{view.entries.filter(entry => entry.kind === kind).map(entry => <li key={entry.id} data-inventory-entry={entry.id}>',`<ul>{view.entries.filter(entry => entry.kind === kind).map(entry => {
          const actions = inventoryActions(entry);
          return <li key={entry.id} data-inventory-entry={entry.id} className="iq-tool-entry">`);
replace('<EntryHeading>{entry.display_name}</EntryHeading>','<EntryHeading className="iq-tool-title">{entry.display_name}</EntryHeading>');
replace('<dl><dt>Source</dt><dd>{entry.source}</dd><dt>Version</dt><dd>{entry.version ?? \'Not reported by runtime\'}</dd><dt>Dependencies</dt><dd>{entry.dependencies.length ? entry.dependencies.join(\'; \') : \'None reported\'}</dd><dt>Effective permission</dt><dd>{entry.effective_permission}</dd></dl>','<dl className="iq-tool-permission"><dt>Effective permission</dt><dd>{entry.effective_permission}</dd></dl>');
replace('{entry.actions.map(action => <Button key={action}',`<div className="iq-tool-actions">{actions.map(action => <Button key={(action === 'enable' || action === 'disable') && !(actions.includes('enable') && actions.includes('disable')) ? 'enablement' : action}`);
replace("}</Button>)}\n        </li>)}</ul>",`}</Button>)}</div>
          <details className="iq-tool-details"><summary>{\`Details for \${entry.display_name}\`}</summary>
            <dl><dt>Source</dt><dd>{entry.source}</dd><dt>Version</dt><dd>{entry.version ?? 'Not reported by runtime'}</dd><dt>Dependencies</dt><dd>{entry.dependencies.length ? entry.dependencies.join('; ') : 'None reported'}</dd></dl>
          </details>
        </li>;})}</ul>`);
fs.writeFileSync(file,source);
fs.appendFileSync(root+'desktop/src/renderer/Shell/shell.css',`\n/* Keep current state and actions readable; reference metadata is available on demand. */
.iq-settings-panel .iq-tool-entry { display:grid; gap:var(--space-2); padding-block:var(--space-4); }
.iq-settings-panel .iq-tool-entry > :is(h4,h5,p,dl) { margin:0; }
.iq-settings-panel .iq-tool-title { font:var(--type-ui); font-weight:600; }
.iq-settings-panel .iq-tool-permission dt { color:var(--text-secondary); }
.iq-settings-panel .iq-tool-actions { display:flex; flex-wrap:wrap; gap:var(--space-2); align-items:flex-start; }
.iq-settings-panel .iq-tool-actions .iq-action { margin:0; }
.iq-settings-panel .iq-tool-details > summary { cursor:pointer; font:var(--type-ui); color:var(--text-secondary); padding-block:var(--space-1); }
.iq-settings-panel .iq-tool-details > summary:focus-visible { outline:2px solid var(--text-primary); outline-offset:3px; border-radius:var(--radius-sm); }
.iq-settings-panel .iq-tool-details[open] > summary { color:var(--text-primary); }
.iq-settings-panel .iq-tool-details > dl { margin:var(--space-2) 0 0; }
@media(max-width:700px) { .iq-settings-panel .iq-tool-entry dl { grid-template-columns:1fr; } .iq-settings-panel .iq-tool-entry dd + dt { margin-top:var(--space-2); } }
`);
console.log('Applied narrow inventory presentation repair.');

const smokeFile=root+'desktop/src/main/smoke-probe.ts';source=fs.readFileSync(smokeFile,'utf8').replace(/\r\n/g,'\n');
replace("    await capture('tools-01-added');\n    stage='disable';",`    await capture('tools-01-added');
    stage='inventory-presentation';
    requireCheck(await ui(\`const entry=row();return !!entry&&!!button(\${JSON.stringify('Disable '+name)},entry)&&![...entry.querySelectorAll('button')].some(node=>node.textContent.trim()===\${JSON.stringify('Enable '+name)});\`),'single-applicable-enablement');
    requireCheck(await ui(\`
      const entry=row(),details=entry?.querySelector('details'),summary=details?.querySelector('summary');
      if(!details||details.open||!summary||visible(details.querySelector('dl'))||!visible(entry.querySelector('.iq-tool-permission')))return false;
      summary.focus();return document.activeElement===summary;
    \`),'reference-details-collapsed');
    await pressKey(contents,'Return');
    requireCheck(await ui(\`return !!(await wait(()=>{const details=row()?.querySelector('details');return details?.open&&visible(details.querySelector('dl'))&&document.activeElement===details.querySelector('summary');},5000));\`),'reference-details-keyboard-open');
    await capture('tools-06-details-expanded');
    await pressKey(contents,'Return');
    requireCheck(await ui(\`return !!(await wait(()=>{const details=row()?.querySelector('details');return details&&!details.open&&document.activeElement===details.querySelector('summary');},5000));\`),'reference-details-keyboard-close');
    stage='disable';`);
replace("if(!disable)return false;disable.click();return !!(await wait(()=>row()?.textContent.includes('Disabled by you')&&button(","if(!disable)return false;disable.focus();disable.click();return !!(await wait(()=>document.activeElement===disable&&row()?.textContent.includes('Disabled by you')&&button(");
replace("if(!enable)return false;enable.click();return !!(await wait(()=>row()?.textContent.includes('Installed; Enabled;')&&button(","if(!enable)return false;enable.focus();enable.click();return !!(await wait(()=>document.activeElement===enable&&row()?.textContent.includes('Installed; Enabled;')&&button(");
replace("      await capture('tools-05-zoomed-form');\n    } finally",`      await capture('tools-05-zoomed-form');
      requireCheck(await ui(\`
        const details=qVisible('.iq-tool-details'),summary=details?.querySelector('summary');if(!summary)return false;
        summary.click();summary.scrollIntoView({block:'start'});
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        return details.open&&document.documentElement.scrollWidth<=document.documentElement.clientWidth;
      \`),'expanded-reference-details-200-percent');
      await capture('tools-07-zoomed-details');
    } finally`);
fs.writeFileSync(smokeFile,source);
console.log('Extended isolated native inventory journey.');
