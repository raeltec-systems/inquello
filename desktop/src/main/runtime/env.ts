/**
 * The environment the `codex-app-server` child receives.
 *
 * It inherits the desktop's environment minus what must not cross into the
 * runtime:
 * - `ELECTRON_RUN_AS_NODE`, which would change how child Electron tools start;
 * - the shared-service config variable, because identity stays in main, and
 *   any other main-only variable the caller names (`blocked`);
 * - every `CODEX_INTERNAL_*` variable. A host Codex session (for example
 *   Codex Desktop) exports these, and `CODEX_INTERNAL_ORIGINATOR_OVERRIDE`
 *   would make the runtime identify as that host instead of Inquello;
 * - every provider credential variable (Story 1.13): `OPENAI_API_KEY`,
 *   `ANTHROPIC_API_KEY`, `CODEX_API_KEY`, `AZURE_OPENAI_API_KEY`, and any
 *   `*_API_KEY`, `*_SECRET` or `*_TOKEN` whose name has a provider name as
 *   one of its `_`-separated parts, wherever it sits (`OPENAI_ADMIN_API_KEY`,
 *   `MY_OPENAI_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`; see
 *   `isProviderCredentialVar`). The runtime uses only credentials set
 *   through Inquello, never whatever the user's shell happens to hold.
 *
 * Windows environment names are case-insensitive, so names are compared
 * upper-cased.
 */

/** Provider names: a credential variable naming one of them never reaches the runtime (`AZURE_OPENAI` contains `OPENAI`). */
export const PROVIDER_ENV_NAMES = ['OPENAI', 'ANTHROPIC', 'CLAUDE', 'CODEX', 'CHATGPT'] as const;

/** Provider credential variables named outright (each also matches the name rule). */
export const PROVIDER_CREDENTIAL_VARS = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'CODEX_API_KEY', 'AZURE_OPENAI_API_KEY'] as const;

const CREDENTIAL_SUFFIXES = ['_API_KEY', '_SECRET', '_TOKEN'] as const;

/** True for a provider credential variable: a credential suffix and a provider name among the name's parts. */
export function isProviderCredentialVar(name: string): boolean {
  const upper = name.toUpperCase();
  if ((PROVIDER_CREDENTIAL_VARS as readonly string[]).includes(upper)) return true;
  if (!CREDENTIAL_SUFFIXES.some((suffix) => upper.endsWith(suffix))) return false;
  const parts = upper.split('_');
  return PROVIDER_ENV_NAMES.some((provider) => parts.includes(provider));
}

export function runtimeChildEnv(
  base: NodeJS.ProcessEnv,
  options: { serviceConfigEnv: string; codexHome?: string; blocked?: readonly string[] },
): NodeJS.ProcessEnv {
  const blocked = new Set(['ELECTRON_RUN_AS_NODE', options.serviceConfigEnv.toUpperCase(), ...(options.blocked ?? []).map((name) => name.toUpperCase())]);
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(base)) {
    const upper = key.toUpperCase();
    if (blocked.has(upper) || upper.startsWith('CODEX_INTERNAL_') || isProviderCredentialVar(upper)) continue;
    env[key] = value;
  }
  if (options.codexHome !== undefined) env.CODEX_HOME = options.codexHome;
  return env;
}
