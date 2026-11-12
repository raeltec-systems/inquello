import { ensurePrivateDirectory, restrictPrivateFile } from './private-paths';
/**
 * Persistent runtime-owned configuration (Story 1.21).
 * Initialize it once; subsequent plugin/MCP/config-writer edits survive restart.
 * Main passes RUNTIME_OWNED_CONFIG_ARGS on every production startup, so stored
 * configuration cannot turn off keyring-only credentials or managed tool bounds.
 * No TOML parsing/rewriting occurs in the desktop. Existing non-regular files are
 * refused. The config file contains no connection credentials.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const RUNTIME_CONFIG_FILE = 'config.toml';

export const RUNTIME_CONFIG_TOML = [
  '# Initialized by Inquello; subsequent runtime-managed settings are preserved.',
  '# Codex logins live in the OS keyring only: no auth.json fallback.',
  'cli_auth_credentials_store = "keyring"',
  'mcp_oauth_credentials_store = "keyring"',
  '# Permission requests come to the person; the automatic reviewer stays off.',
  'approvals_reviewer = "user"',
  '',
  '[features]',
  '# Keep the login itself in the keyring, not in an encrypted file in this directory.',
  'secret_auth_storage = false',
  '# Task tools reach the network only through the runtime\'s proxy, with the Workspace\'s allowed domains.',
  'network_proxy = true',
  '',
].join('\n');

/** Highest-priority runtime CLI layer; these values cannot be weakened by a saved file. */
export const RUNTIME_OWNED_CONFIG_ARGS: readonly string[] = [
  '-c', 'cli_auth_credentials_store="keyring"',
  '-c', 'mcp_oauth_credentials_store="keyring"',
  '-c', 'approvals_reviewer="user"',
  '-c', 'features.secret_auth_storage=false',
  '-c', 'features.network_proxy=true',
];

/**
 * Story 2.1 (owner, 2026-11-12): the agent's standing instruction for attached material. Skills do not load in
 * private Tasks, and the person's message is never changed, so it travels as Codex's own `developer_instructions`
 * (one developer message in each thread's initial context; guardian reviewers replace it with their own policy).
 * The renderer tells the person: "The agent is told where the attached material is and how to read and cite it."
 */
export const AGENT_MATERIAL_INSTRUCTION = 'Material the person attached to this Task is in the Task folder under attached/. When that folder exists, read the material with the evidence skill in skills/inquello-evidence/SKILL.md and cite what you rely on.';

/** Appended by main after `RUNTIME_OWNED_CONFIG_ARGS`; a TOML basic string (JSON escaping is valid TOML here). */
export const RUNTIME_AGENT_INSTRUCTION_ARGS: readonly string[] = ['-c', `developer_instructions=${JSON.stringify(AGENT_MATERIAL_INSTRUCTION)}`];

/** Initializes `config.toml` once; returns its path, preserving runtime-owned edits. */
export function writeRuntimeConfig(runtimeHome: string): string {
  ensurePrivateDirectory(runtimeHome);
  const file = path.join(runtimeHome, RUNTIME_CONFIG_FILE);
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('runtime config must be a regular file');
    restrictPrivateFile(file);
    return file;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, RUNTIME_CONFIG_TOML, { mode: 0o600, flag: 'wx' });
    restrictPrivateFile(temp);
    fs.renameSync(temp, file);
  } finally {
    fs.rmSync(temp, { force: true });
  }
  return file;
}

/** Validate the runtime's effective layer before exposing any credential operation.
 * Legacy device-managed configuration can outrank CLI flags; refuse that conflict.
 * The reviewer field is experimental and may be elided from config/read, so check
 * its raw higher-priority managed layers too (no TOML parsing in the desktop).
 */
export async function verifyRuntimeOwnedConfig(request: (method: string, params: unknown) => Promise<unknown>): Promise<void> {
  const raw = await request('config/read', {includeLayers:true}) as {config?: Record<string, unknown>; layers?: Array<{name?: {type?: string}; config?: Record<string, unknown>; disabledReason?: string}>};
  const config = raw?.config;
  const features = config?.features as Record<string,unknown> | undefined;
  if (!config || config.cli_auth_credentials_store !== 'keyring' || config.mcp_oauth_credentials_store !== 'keyring' || features?.secret_auth_storage !== false || features?.network_proxy !== true || (config.approvals_reviewer !== undefined && config.approvals_reviewer !== 'user')) throw new Error('runtime configuration conflicts with Inquello credential or execution protections');
  for (const layer of raw.layers ?? []) {
    if (layer.disabledReason) continue;
    if (['legacyManagedConfigTomlFromFile','legacyManagedConfigTomlFromMdm'].includes(layer.name?.type ?? '') && layer.config?.approvals_reviewer !== undefined && layer.config.approvals_reviewer !== 'user') throw new Error('managed reviewer configuration conflicts with Inquello execution protections');
  }
}
