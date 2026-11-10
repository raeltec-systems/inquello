/** Main-operation wrappers kept importable without Electron startup. */
import type { IdentityActionResult } from '../identity/session';
import type { ProviderActionResult, ProviderStatus } from '../providers/status';
import type { CapabilityService } from './service';
type Control = Pick<CapabilityService, 'quiesce' | 'clearConnectionTracking' | 'resume'>;
export async function signOutWithCapabilities(options: {
  capabilities?: Control; stopRuntime(): Promise<void>;
  signOut(): Promise<IdentityActionResult>;
  afterIdentityChange(result: IdentityActionResult): Promise<IdentityActionResult>;
}): Promise<IdentityActionResult> {
  const resolved = !options.capabilities || await options.capabilities.quiesce();
  if (!resolved) await options.stopRuntime();
  const result = await options.afterIdentityChange(await options.signOut());
  // A signed-in failure proves prepareLogout did not create a pending logout.
  // Blocked/signing-in/out results are actual or uncertain transitions: stay paused.
  if (resolved && !result.ok && result.status.identity.state === 'signed-in') options.capabilities?.resume();
  else options.capabilities?.clearConnectionTracking();
  return result;
}
export async function providerLogoutWithCapabilities(options: {
  capabilities?: Control; stopRuntime(): Promise<void>;
  logout(): Promise<ProviderActionResult>; getStatus(): Promise<ProviderStatus>;
}): Promise<ProviderActionResult> {
  if (options.capabilities && !(await options.capabilities.quiesce())) {
    await options.stopRuntime();
    return {ok:false, reason:'The runtime was stopped because pending MCP sign-in cleanup could not be confirmed. Provider credentials were not removed. Restart the app/runtime and retry provider sign-out.', status:await options.getStatus()};
  }
  const result = await options.logout();
  options.capabilities?.clearConnectionTracking(); options.capabilities?.resume();
  return result;
}
