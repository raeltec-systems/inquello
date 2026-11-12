/**
 * Development mode (spec-dev-mode-real-model-testing): the owner tries features
 * with real model providers on this machine. Started only by
 * `scripts/run-dev.cjs`, which runs the local development topology and passes
 * `--development` with the topology's service config and seed file.
 *
 * It is refused in a packaged app, beside the controlled fictional session,
 * a smoke run or an owned development profile. When on, main signs in with the
 * synthetic local identity without a browser, keeps the window visible, uses
 * the persistent development profile and tells the debug runtime child to skip
 * the real-data qualification checks (`INQUELLO_DEVELOPMENT_MODE=1`; release
 * runtimes ignore it). Provider keys are still entered in Settings.
 */
import os from 'node:os';
import path from 'node:path';

import { DEV_PROFILE_ENV, DEV_RUN_ENV } from './dev-profile';
import { SERVICE_CONFIG_ENV } from './identity/config';

export { DEVELOPMENT_RUNTIME_ENV } from './runtime/env';
export const DEVELOPMENT_FLAG = '--development';
/** The topology's seed file (`workspace_id`, `invite_id`), set by the launcher. */
export const DEVELOPMENT_SEED_ENV = 'INQUELLO_DEV_SEED';
/** Shown persistently while development mode is on; duplicated in the renderer. */
export const DEVELOPMENT_NOTICE = 'Development build: qualification checks are off. Use only data you control.';

/** Fixture and test variables the launcher strips; any of them refuses development mode. */
export const DEVELOPMENT_REFUSED_ENV = ['INQUELLO_SMOKE_SEED', 'INQUELLO_QUOTA_FIXTURE', 'INQUELLO_VISUAL_FIXTURE', 'INQUELLO_FICTIONAL_AUDIT_SESSION', 'INQUELLO_FICTIONAL_PAID_SESSION', 'INQUELLO_ONBOARDING_FIXTURE', 'INQUELLO_ONBOARDING_RUN', 'INQUELLO_ONBOARDING_RESUME', 'INQUELLO_PROVIDER_DEV_CONFIG', 'INQUELLO_FIXTURE_APP_SERVER_BIN'];

export interface DevelopmentMode { profile: string; seedFile: string }

/** What the window shows when the development sign-in or Workspace join failed; null when both worked. */
export function developmentSignInProblem(result: { signedIn: boolean; member: boolean; reason?: string | null }): string | null {
  if (result.signedIn && result.member) return null;
  const why = (result.reason?.trim() || (result.signedIn ? 'the seeded Workspace could not be joined' : 'the synthetic identity did not sign in')).replace(/\.+$/, '');
  return `Development sign-in failed: ${why}. Close the window and run pnpm run dev again.`;
}

/** The persistent development profile, apart from smoke profiles, the Auth0 pilot and the default profile. */
export function developmentProfileDir(platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? 'D:\\Inquello\\dev\\profile' : path.join(os.homedir(), '.inquello-dev', 'profile');
}

export function developmentMode(options: { packaged: boolean; paid: boolean; argv: readonly string[]; env: NodeJS.ProcessEnv; platform?: NodeJS.Platform }): DevelopmentMode | null {
  if (!options.argv.includes(DEVELOPMENT_FLAG)) return null;
  const fail = (why: string) => new Error(`Development mode unavailable: ${why}`);
  if (options.packaged) throw fail('this is a packaged app');
  if (options.paid) throw fail('the controlled fictional session is requested');
  if (options.argv.some((arg) => /^--(?:smoke|seed|provider-fixture|resume-owned-profile)/.test(arg))) throw fail('a smoke or owned-profile flag is present');
  if (Object.keys(options.env).some((name) => [DEV_PROFILE_ENV, DEV_RUN_ENV].includes(name.toUpperCase()))) throw fail('an owned development profile is configured');
  if (Object.keys(options.env).some((name) => DEVELOPMENT_REFUSED_ENV.includes(name.toUpperCase()))) throw fail('a test fixture variable is set');
  const seedFile = options.env[DEVELOPMENT_SEED_ENV];
  if (!options.env[SERVICE_CONFIG_ENV] || !seedFile || !path.isAbsolute(seedFile)) throw fail('start it with scripts/run-dev.cjs');
  return { profile: developmentProfileDir(options.platform), seedFile };
}
