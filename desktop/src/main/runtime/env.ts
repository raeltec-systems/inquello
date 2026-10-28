/**
 * The environment the `codex-app-server` child receives.
 *
 * It inherits the desktop's environment minus what must not cross into the
 * runtime:
 * - `ELECTRON_RUN_AS_NODE`, which would change how child Electron tools start;
 * - the shared-service config variable, because identity stays in main;
 * - every `CODEX_INTERNAL_*` variable. A host Codex session (for example
 *   Codex Desktop) exports these, and `CODEX_INTERNAL_ORIGINATOR_OVERRIDE`
 *   would make the runtime identify as that host instead of Inquello.
 *
 * Windows environment names are case-insensitive, so names are compared
 * upper-cased.
 */
export function runtimeChildEnv(
  base: NodeJS.ProcessEnv,
  options: { serviceConfigEnv: string; codexHome?: string },
): NodeJS.ProcessEnv {
  const blocked = new Set(['ELECTRON_RUN_AS_NODE', options.serviceConfigEnv.toUpperCase()]);
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(base)) {
    const upper = key.toUpperCase();
    if (blocked.has(upper) || upper.startsWith('CODEX_INTERNAL_')) continue;
    env[key] = value;
  }
  if (options.codexHome !== undefined) env.CODEX_HOME = options.codexHome;
  return env;
}
