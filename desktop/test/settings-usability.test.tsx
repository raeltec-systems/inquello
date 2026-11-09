// @vitest-environment jsdom
import {act,cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {Settings} from '../src/renderer/Settings';

function setup() {
 const getInventory=vi.fn(async()=>({workspaceId:'workspace',available:true,stale:false,refreshedAt:'2026-11-07T01:00:00Z',reason:null,entries:[],provider:{provider:'Codex',accountType:'Not signed in',effectiveRoute:'Selected per Task; see Models',limits:[]}}));
 const manage=vi.fn();
 Object.assign(globalThis,{inquello:{policy:{getSettings:vi.fn(async()=>({signedIn:true,environmentLabel:'Local device',capabilities:[],reason:null,workspaces:[{workspaceId:'workspace',name:'Example Workspace',policy:null,reason:'Policy unavailable'}]}))},capabilities:{getInventory,manage}}});
 location.hash='#settings-tools';
 render(<Settings workspaceId="workspace" onBack={vi.fn()} onIdentityChanged={vi.fn()}/>);
 return {getInventory,manage};
}
afterEach(()=>{cleanup();Reflect.deleteProperty(globalThis,'inquello');location.hash='';});

it('keeps adding a connection ahead of the runtime inventory and provider details',async()=>{
 const f=setup();
 const provider=await screen.findByRole('region',{name:'Provider session'});
 const form=screen.getByRole('form',{name:'Add MCP server'});
 expect(form.compareDocumentPosition(provider)&Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
 expect(screen.getAllByRole('heading',{name:'Tools and connections'})).toHaveLength(1);
 expect(f.manage).not.toHaveBeenCalled();
});

it('moves focus to each ordinary Settings section without leaving it on the removed content',async()=>{
 setup();await screen.findByRole('region',{name:'Provider session'});
 for(const [hash,title] of [['#settings-usage','Usage'],['#settings-account','Account'],['#settings-providers','AI connections'],['#settings-routes','Models'],['#settings-tools','Tools and connections']]){
  screen.getByRole('link',{name:title}).focus();
  act(()=>{location.hash=hash!;window.dispatchEvent(new HashChangeEvent('hashchange'));});
  expect(document.activeElement).toBe(screen.getByRole('heading',{name:title,level:2}));
 }
});
