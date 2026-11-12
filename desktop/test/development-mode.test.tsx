// @vitest-environment jsdom
/** Development mode (spec-dev-mode-real-model-testing): flag handling, runtime switch, notice. */
import {act,cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('../src/renderer/Shell/Shell',()=>({Shell:()=> <div data-testid="shell">Shell</div>}));
import {DEVELOPMENT_FLAG,DEVELOPMENT_NOTICE,DEVELOPMENT_RUNTIME_ENV,DEVELOPMENT_SEED_ENV,developmentMode,developmentProfileDir,developmentSignInProblem} from '../src/main/development-mode';
import {runtimeChildEnv} from '../src/main/runtime/env';
import {createOperations} from '../src/main/security/operations';
import {savedModelReason,type RouteView} from '../src/main/routes/types';
import {App} from '../src/renderer/App';
import {DEVELOPMENT_NOTICE as RENDERER_NOTICE,resetDevelopmentBuildForTests} from '../src/renderer/development';

const launcherEnv={INQUELLO_SERVICE_CONFIG:'D:\\Inquello\\dev\\run\\config.json',[DEVELOPMENT_SEED_ENV]:'D:\\Inquello\\dev\\run\\seed.json'};
const base={packaged:false,paid:false,argv:['electron','.',DEVELOPMENT_FLAG],env:launcherEnv,platform:'win32' as const};
afterEach(()=>{cleanup();resetDevelopmentBuildForTests();delete (globalThis as {inquello?:unknown}).inquello;});

it('is off without the flag and on only for an unpackaged launch from the launcher',()=>{
 expect(developmentMode({...base,argv:['electron','.']})).toBeNull();
 expect(developmentMode({...base,argv:[]})).toBeNull();
 expect(developmentMode(base)).toEqual({profile:'D:\\Inquello\\dev\\profile',seedFile:launcherEnv[DEVELOPMENT_SEED_ENV]});
 expect(developmentProfileDir('win32')).toBe('D:\\Inquello\\dev\\profile');
});

it('refuses packaged, fictional-session, smoke, owned-profile and incomplete launches',()=>{
 expect(()=>developmentMode({...base,packaged:true})).toThrow(/packaged/);
 expect(()=>developmentMode({...base,paid:true})).toThrow(/fictional/);
 for(const flag of ['--smoke','--smoke-visual','--seed-x','--resume-owned-profile'])expect(()=>developmentMode({...base,argv:[...base.argv,flag]})).toThrow();
 expect(()=>developmentMode({...base,env:{...launcherEnv,INQUELLO_DEV_PROFILE:'D:\\x\\profile'}})).toThrow(/owned/);
 for(const name of ['INQUELLO_SMOKE_SEED','INQUELLO_QUOTA_FIXTURE','INQUELLO_VISUAL_FIXTURE','INQUELLO_FICTIONAL_AUDIT_SESSION','INQUELLO_FICTIONAL_PAID_SESSION','INQUELLO_ONBOARDING_FIXTURE','INQUELLO_ONBOARDING_RUN','inquello_onboarding_resume','INQUELLO_PROVIDER_DEV_CONFIG','INQUELLO_FIXTURE_APP_SERVER_BIN'])expect(()=>developmentMode({...base,env:{...launcherEnv,[name]:'x'}}),name).toThrow(/fixture/);
 expect(()=>developmentMode({...base,env:{INQUELLO_SERVICE_CONFIG:launcherEnv.INQUELLO_SERVICE_CONFIG}})).toThrow(/run-dev/);
 expect(()=>developmentMode({...base,env:{[DEVELOPMENT_SEED_ENV]:launcherEnv[DEVELOPMENT_SEED_ENV]}})).toThrow(/run-dev/);
 expect(()=>developmentMode({...base,env:{...launcherEnv,[DEVELOPMENT_SEED_ENV]:'seed.json'}})).toThrow(/run-dev/);
});

it('sets the runtime switch only in development mode and never passes an inherited one',()=>{
 const inherited={PATH:'x',[DEVELOPMENT_RUNTIME_ENV]:'1',inquello_development_mode:'1'};
 const options={serviceConfigEnv:'INQUELLO_SERVICE_CONFIG'};
 for(const development of [undefined,false]){
  const env=runtimeChildEnv(inherited,{...options,development});
  expect(Object.keys(env).filter(k=>k.toUpperCase()===DEVELOPMENT_RUNTIME_ENV)).toEqual([]);
  expect(env.PATH).toBe('x');
 }
 const on=runtimeChildEnv(inherited,{...options,development:true});
 expect(Object.keys(on).filter(k=>k.toUpperCase()===DEVELOPMENT_RUNTIME_ENV)).toEqual([DEVELOPMENT_RUNTIME_ENV]);
 expect(on[DEVELOPMENT_RUNTIME_ENV]).toBe('1');
});

it('reports development mode on the runtime status only when main is in it',async()=>{
 const status=async(developmentMode?:boolean)=>{
  const ops=createOperations({runtimeState:()=>'ready',runtimeVersion:'0.165.0',...(developmentMode===undefined?{}:{developmentMode}),identity:{} as never,data:{} as never,provider:{} as never,organise:{} as never,policy:{} as never});
  const op=ops.find(o=>o.name==='runtime.getStatus')!;
  return op.handle(undefined as never);
 };
 expect(await status()).toEqual({state:'ready',runtimeVersion:'0.165.0'});
 expect(await status(false)).toEqual({state:'ready',runtimeVersion:'0.165.0'});
 expect(await status(true)).toEqual({state:'ready',runtimeVersion:'0.165.0',developmentMode:true});
});

it('shows the same persistent notice in the renderer only when main reports development mode',async()=>{
 expect(RENDERER_NOTICE).toBe(DEVELOPMENT_NOTICE);
 expect(DEVELOPMENT_NOTICE).toBe('Development build: qualification checks are off. Use only data you control.');
 const getStatus=vi.fn(async()=>({state:'ready',runtimeVersion:'0.165.0'}));
 (globalThis as {inquello?:unknown}).inquello={runtime:{getStatus}};
 await act(async()=>{render(<App/>);});
 expect(getStatus).toHaveBeenCalled();
 expect(screen.queryByText(DEVELOPMENT_NOTICE)).toBeNull();
 cleanup();resetDevelopmentBuildForTests();
 (globalThis as {inquello?:unknown}).inquello={runtime:{getStatus:async()=>({state:'ready',runtimeVersion:'0.165.0',developmentMode:true})}};
 await act(async()=>{render(<App/>);});
 const notice=screen.getByText(DEVELOPMENT_NOTICE);
 expect(notice.getAttribute('role')).toBe('note');
 // It stays while the person moves between views.
 await act(async()=>{globalThis.location.hash='#settings';globalThis.dispatchEvent(new HashChangeEvent('hashchange'));});
 expect(screen.getByText(DEVELOPMENT_NOTICE)).toBeTruthy();
 globalThis.location.hash='';
});

it('reads the development status again once when the first read fails',async()=>{
 const getStatus=vi.fn().mockRejectedValueOnce(new Error('not ready')).mockResolvedValue({state:'ready',runtimeVersion:'0.165.0',developmentMode:true});
 (globalThis as {inquello?:unknown}).inquello={runtime:{getStatus}};
 await act(async()=>{render(<App/>);});
 expect(getStatus).toHaveBeenCalledTimes(2);
 expect(screen.getByText(DEVELOPMENT_NOTICE)).toBeTruthy();
});

it('shows a failed development sign-in or Workspace join in the window in plain words',async()=>{
 expect(developmentSignInProblem({signedIn:true,member:true})).toBeNull();
 expect(developmentSignInProblem({signedIn:false,member:false,reason:'The shared service is not configured.'})).toBe('Development sign-in failed: The shared service is not configured. Close the window and run pnpm run dev again.');
 expect(developmentSignInProblem({signedIn:false,member:false})).toMatch(/^Development sign-in failed: the synthetic identity did not sign in\. Close the window and run pnpm run dev again\.$/);
 expect(developmentSignInProblem({signedIn:true,member:false})).toMatch(/seeded Workspace could not be joined\. Close the window/);
 const ops=(developmentMode:boolean,problem:string|null)=>createOperations({runtimeState:()=>'ready',runtimeVersion:'0.165.0',developmentMode,developmentProblem:()=>problem,identity:{} as never,data:{} as never,provider:{} as never,organise:{} as never,policy:{} as never}).find(o=>o.name==='runtime.getStatus')!;
 expect(await ops(true,'Development sign-in failed: x. Close the window and run pnpm run dev again.').handle(undefined as never)).toEqual({state:'ready',runtimeVersion:'0.165.0',developmentMode:true,developmentProblem:'Development sign-in failed: x. Close the window and run pnpm run dev again.'});
 expect(await ops(false,'never shown').handle(undefined as never)).toEqual({state:'ready',runtimeVersion:'0.165.0'});
 expect(await ops(true,null).handle(undefined as never)).toEqual({state:'ready',runtimeVersion:'0.165.0',developmentMode:true});
 const problem=developmentSignInProblem({signedIn:false,member:false,reason:'fetch failed'})!;
 (globalThis as {inquello?:unknown}).inquello={runtime:{getStatus:async()=>({state:'ready',runtimeVersion:'0.165.0',developmentMode:true,developmentProblem:problem})}};
 await act(async()=>{render(<App/>);});
 expect(screen.getByText(DEVELOPMENT_NOTICE)).toBeTruthy();
 expect(screen.getByText(problem).getAttribute('role')).toBe('alert');
});

it('does not call a connected unqualified saved model unavailable in development mode',()=>{
 const route={routeId:'claude-api-key',provider:'Anthropic',configurable:true,configuration:null,endpoint:null,revision:1,credentialPresent:true,adapterSupported:true,verification:'not_verified',enabled:false,gate:'x',limits:[],evidence:[],executionFlow:'',inferenceFlow:'',connectorFlow:''} satisfies RouteView;
 expect(savedModelReason(route)).toMatch(/not qualified/);
 expect(savedModelReason(route,false,false,true)).toBeNull();
 expect(savedModelReason({...route,credentialPresent:false},false,false,true)).toMatch(/Connect Anthropic/);
 expect(savedModelReason(route,true,false,true)).toMatch(/unavailable/);
});
