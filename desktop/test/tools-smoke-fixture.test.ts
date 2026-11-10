import {expect,it} from 'vitest';
import {startToolsSmokeFixture} from '../src/main/tools-smoke-fixture';
it('only serves bounded loopback discovery and refuses invocation/auth',async()=>{
 const fixture=await startToolsSmokeFixture();
 try {
  expect(new URL(fixture.url).hostname).toBe('127.0.0.1');
  const post=(method:string)=>fetch(fixture.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method})});
  expect((await (await post('initialize')).json()).result.serverInfo.name).toBe('inquello-ui-fixture');
  expect((await (await post('tools/list')).json()).result.tools[0].name).toBe('fictional_echo');
  expect((await post('tools/call')).status).toBe(403);
  expect((await post('oauth/login')).status).toBe(403);
  expect(fixture.counts).toEqual({initialize:1,toolsList:1,forbidden:2});
 } finally {await fixture.close();}
});
