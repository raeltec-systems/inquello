import {describe,it,expect,vi} from 'vitest';
import {signOutWithCapabilities,providerLogoutWithCapabilities} from '../src/main/capabilities/lifecycle';
import type {IdentityActionResult} from '../src/main/identity/session';
import type {ProviderStatus} from '../src/main/providers/status';
const control=(resolved=true)=>({quiesce:vi.fn(async()=>resolved),resume:vi.fn(),clearConnectionTracking:vi.fn()});
const identity=(state:string)=>({ok:false,status:{identity:{state},sharedService:'unavailable',credentialStorage:'memory-only',privateWork:'local'}} as IdentityActionResult);
describe('main capability lifecycle operation wrappers',()=>{
 it('resumes failed sign-out only when identity still proves signed in',async()=>{
  const capabilities=control(),result=identity('signed-in'),stopRuntime=vi.fn();
  expect(await signOutWithCapabilities({capabilities,stopRuntime,signOut:async()=>result,afterIdentityChange:async x=>x})).toBe(result);
  expect(capabilities.resume).toHaveBeenCalledOnce();expect(stopRuntime).not.toHaveBeenCalled();
 });
 it.each(['blocked','signed-out','signing-in'])('retains pause for %s transition',async state=>{
  const capabilities=control();await signOutWithCapabilities({capabilities,stopRuntime:vi.fn(),signOut:async()=>identity(state),afterIdentityChange:async x=>x});expect(capabilities.resume).not.toHaveBeenCalled();
 });
 it('never resumes unresolved cleanup despite a signed-in failure',async()=>{
  const capabilities=control(false),stopRuntime=vi.fn();await signOutWithCapabilities({capabilities,stopRuntime,signOut:async()=>identity('signed-in'),afterIdentityChange:async x=>x});expect(stopRuntime).toHaveBeenCalledOnce();expect(capabilities.resume).not.toHaveBeenCalled();
 });
 it('stops uncertain MCP cleanup and gives explicit provider logout recovery without claiming deletion',async()=>{
  const capabilities=control(false),stopRuntime=vi.fn(),logout=vi.fn(),status={} as ProviderStatus;
  const result=await providerLogoutWithCapabilities({capabilities,stopRuntime,logout,getStatus:async()=>status});
  expect(result.ok).toBe(false);expect(result.reason).toContain('credentials were not removed');expect(result.reason).toContain('Restart the app/runtime and retry');expect(logout).not.toHaveBeenCalled();expect(stopRuntime).toHaveBeenCalledOnce();expect(capabilities.resume).not.toHaveBeenCalled();
 });
 it('successful cleanup delegates logout then resumes',async()=>{
  const capabilities=control(),result={ok:true,status:{} as ProviderStatus},logout=vi.fn(async()=>result);
  expect(await providerLogoutWithCapabilities({capabilities,stopRuntime:vi.fn(),logout,getStatus:async()=>result.status})).toBe(result);expect(logout).toHaveBeenCalledOnce();expect(capabilities.resume).toHaveBeenCalledOnce();
 });
});
