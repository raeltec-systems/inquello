/**
 * The effective managed policy as main shows it (Story 1.18): views rebuilt
 * field by field from the runtime's `inquello/policy/effective` answer, with
 * fixed plain-word text for every value and governing rule, and the payload
 * validators of the `policy.*` operations.
 *
 * - Every setting names the rule that governs it: "Restricted by Workspace
 *   policy, revision 4", "Set by this device's managed requirements",
 *   "Restricted by your runtime configuration" or "Inquello default".
 * - A broader execution mode is labelled "Broader execution mode" with its
 *   reach, never as review or approval, and no text here uses those words.
 * - Prompt inspection and specialist cyber access are listed as not enabled.
 */
import type { InquelloPolicyEffectiveResponse } from '../../protocol/generated/v2/InquelloPolicyEffectiveResponse';
import type { InquelloPolicySource } from '../../protocol/generated/v2/InquelloPolicySource';
import type { InquelloTaskPolicy } from '../../protocol/generated/v2/InquelloTaskPolicy';
import { OperationError, type PayloadValidator } from '../security/operations';

export const SETTING_NAMES = ['sandbox', 'approval', 'network', 'mcp_tools', 'extensions', 'full_access', 'no_prompt'] as const;
export type SettingName = (typeof SETTING_NAMES)[number];

export const BROAD_MODES = ['standard', 'no_prompt', 'full_access'] as const;
export type BroadMode = (typeof BROAD_MODES)[number];

export const SOURCE_KINDS = ['workspace_policy', 'device_requirements', 'user_config', 'inquello_default'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/** The label every broader mode carries. */
export const BROAD_MODE_LABEL = 'Broader execution mode';

export const BROAD_MODE_TITLE: Record<BroadMode, string> = {
  standard: 'Standard',
  no_prompt: 'No prompt',
  full_access: 'Full access',
};

/** The reach each mode states; a broader mode is confirmed with exactly this text. */
export const BROAD_MODE_REACH: Record<BroadMode, string> = {
  standard: 'Standard: commands on this Task run inside the sandbox on this device, and you are asked before actions as the policy requires.',
  no_prompt: 'No prompt: commands on this Task run inside the sandbox on this device, and you will not be asked before actions.',
  full_access: 'Full access: commands on this Task run without sandbox limits on this device, and you will not be asked before actions.',
};

export const SETTING_LABEL: Record<SettingName, string> = {
  sandbox: 'Sandbox ceiling',
  approval: 'Asking before actions',
  network: 'Network access in the sandbox',
  mcp_tools: 'MCP and connector tools',
  extensions: 'Plugins and extensions',
  full_access: 'Full access mode',
  no_prompt: 'No-prompt mode',
};

const VALUE_LABEL: Record<string, string> = {
  read_only: 'Read only',
  workspace_write: 'Workspace write',
  full_access: 'Full access',
  on_request: 'Asks when the agent requests it',
  untrusted: 'Asks before actions not known to be safe',
  never: 'Never asks',
  allowed: 'Allowed',
  denied: 'Denied',
  permitted: 'Available per Task, with confirmation',
  not_permitted: 'Not available',
};

export const ENVIRONMENT_LABEL = 'Local device';
export const DEVICE_NONE = 'None configured on this device';

/** The Capability Contract entries listed as not enabled (Story 1.18). */
export const CAPABILITY_LABEL: Record<string, string> = {
  prompt_inspection: 'Prompt inspection',
  specialist_cyber_access: 'Specialist cyber access',
};
export const CAPABILITY_NOT_ENABLED = 'Not enabled — eligibility verification required';

export interface PolicySourceView {
  kind: SourceKind;
  /** The Workspace policy revision, for a Workspace rule. */
  revision: number | null;
}

export interface PolicySettingView {
  name: SettingName;
  label: string;
  value: string;
  valueLabel: string;
  source: PolicySourceView;
  /** "Restricted by Workspace policy, revision 4", "Inquello default", … */
  sourceLabel: string;
  restricted: boolean;
}

export interface CapabilityView {
  id: string;
  label: string;
  enabled: false;
  statusLabel: string;
}

export interface PolicyView {
  environment: 'local_device';
  environmentLabel: string;
  workspaceId: string;
  policyRevision: number;
  authorizationEpoch: number;
  settings: PolicySettingView[];
  device: { configured: boolean; label: string };
  capabilities: CapabilityView[];
}

export interface BroadModeView {
  label: string;
  revision: number;
  recorded: BroadMode;
  status: 'standard' | 'active' | 'suspended';
  effectiveMode: BroadMode;
  /** The mode's reach statement; "Suspended by policy: …" when suspended. */
  reach: string;
  statusLabel: string;
  /** Why the recorded mode is suspended, if it is. */
  suspendedReason: string | null;
}

export interface ThreadSettingsView {
  sandbox: 'read-only' | 'workspace-write' | 'danger-full-access';
  approvalPolicy: 'untrusted' | 'on-request' | 'never';
  networkAccess: boolean;
  mode: BroadMode;
}

export interface TaskPolicyView extends PolicyView {
  taskId: string;
  broadMode: BroadModeView;
  /** Each broader mode, its reach and, when unavailable, the rule that prevents it. */
  options: Array<{ mode: Exclude<BroadMode, 'standard'>; title: string; reach: string; available: boolean; unavailableReason: string | null }>;
  threadSettings: ThreadSettingsView;
}

export interface WorkspacePolicyEntry {
  workspaceId: string;
  name: string;
  policy: PolicyView | null;
  /** Why the policy could not be shown, if it could not. */
  reason: string | null;
}

export interface SettingsPolicyView {
  signedIn: boolean;
  environmentLabel: string;
  workspaces: WorkspacePolicyEntry[];
  capabilities: CapabilityView[];
  /** Why nothing could be shown, if nothing could. */
  reason: string | null;
}

export type PolicyFailureCode =
  | 'signed-out'
  | 'service-unavailable'
  | 'policy-unavailable'
  | 'not-found'
  | 'workspace-mismatch'
  | 'conflict'
  | 'invalid'
  | 'runtime-unavailable'
  | 'human-actor-required'
  | 'broad-mode-not-permitted'
  | 'failed';

export type PolicyResult<T> = { ok: true; value: T } | { ok: false; code: PolicyFailureCode; reason: string; actualRevision?: number };

/** The governing rule in words, for "not permitted by …". */
export function governingText(source: PolicySourceView): string {
  switch (source.kind) {
    case 'workspace_policy':
      return `Workspace policy, revision ${source.revision ?? '?'}`;
    case 'device_requirements':
      return "this device's managed requirements";
    case 'user_config':
      return 'your runtime configuration';
    default:
      return 'the Inquello default';
  }
}

/** The plain-word source of a setting. */
export function sourceLabel(source: PolicySourceView, restricted: boolean): string {
  switch (source.kind) {
    case 'workspace_policy':
      return `${restricted ? 'Restricted' : 'Set'} by Workspace policy, revision ${source.revision ?? '?'}`;
    case 'device_requirements':
      return `${restricted ? 'Restricted' : 'Set'} by this device's managed requirements`;
    case 'user_config':
      return 'Restricted by your runtime configuration';
    default:
      return 'Inquello default';
  }
}

/** Why a broader mode is unavailable. */
export function unavailableReason(mode: Exclude<BroadMode, 'standard'>, source: PolicySourceView): string {
  return `${BROAD_MODE_TITLE[mode]} is not available: not permitted by ${governingText(source)}.`;
}

function oneOf<T extends string>(allowed: readonly T[], value: unknown, field: string): T {
  if (!(allowed as readonly unknown[]).includes(value)) throw new Error(`unexpected ${field} from the runtime`);
  return value as T;
}

function sourceView(value: InquelloPolicySource): PolicySourceView {
  const kind = oneOf(SOURCE_KINDS, value.kind, 'policy source');
  return { kind, revision: kind === 'workspace_policy' && typeof value.revision === 'number' ? value.revision : null };
}

const capabilityView = (id: string): CapabilityView => ({ id, label: CAPABILITY_LABEL[id] ?? id, enabled: false, statusLabel: CAPABILITY_NOT_ENABLED });

/** The listed-not-enabled entries when no runtime answer is at hand. */
export const DEFAULT_CAPABILITIES: readonly CapabilityView[] = Object.keys(CAPABILITY_LABEL).map(capabilityView);

/** Rebuilds the runtime's answer field by field. An enabled contract entry is refused, never shown as enabled. */
export function policyView(value: InquelloPolicyEffectiveResponse): PolicyView {
  const settings = SETTING_NAMES.map((name) => {
    const entry = value.settings.find((setting) => setting.name === name);
    if (!entry) throw new Error(`the runtime omitted the ${name} setting`);
    const source = sourceView(entry.source);
    const restricted = entry.restricted === true;
    const raw = String(entry.value);
    return {
      name,
      label: SETTING_LABEL[name],
      value: raw,
      valueLabel: VALUE_LABEL[raw] ?? raw,
      source,
      sourceLabel: sourceLabel(source, restricted),
      restricted,
    };
  });
  const device = value.device;
  let deviceLabel = DEVICE_NONE;
  if (device.configured) {
    const parts: string[] = [];
    if (device.sandboxModes) parts.push(`Allowed sandbox levels: ${device.sandboxModes.map((mode) => VALUE_LABEL[mode] ?? mode).join(', ') || 'none'}.`);
    if (device.approvals) parts.push(`Allowed asking behaviours: ${device.approvals.map((mode) => VALUE_LABEL[mode] ?? mode).join(', ') || 'none'}.`);
    deviceLabel = parts.join(' ');
  }
  for (const entry of value.capabilities) {
    if (entry.enabled) throw new Error(`the runtime reported ${String(entry.id)} as enabled`);
  }
  return {
    environment: oneOf(['local_device'] as const, value.environment, 'environment'),
    environmentLabel: ENVIRONMENT_LABEL,
    workspaceId: String(value.workspaceId),
    policyRevision: Number(value.policyRevision),
    authorizationEpoch: Number(value.authorizationEpoch),
    settings,
    device: { configured: device.configured === true, label: deviceLabel },
    capabilities: value.capabilities.map((entry) => capabilityView(String(entry.id))),
  };
}

export function taskPolicyView(value: InquelloPolicyEffectiveResponse, task: InquelloTaskPolicy): TaskPolicyView {
  const base = policyView(value);
  const broad = task.broadMode;
  const recorded = oneOf(BROAD_MODES, broad.recorded, 'broad mode');
  const status = oneOf(['standard', 'active', 'suspended'] as const, broad.status, 'broad-mode status');
  const effectiveMode = oneOf(BROAD_MODES, broad.effectiveMode, 'effective mode');
  const governing = broad.governing ? sourceView(broad.governing) : null;
  const suspendedReason =
    status === 'suspended' && governing
      ? `Suspended by policy: ${governingText(governing)} no longer permits ${BROAD_MODE_TITLE[recorded]}. This Task runs in Standard mode.`
      : null;
  const setting = (name: SettingName) => base.settings.find((entry) => entry.name === name)!;
  const options = (['no_prompt', 'full_access'] as const).map((mode) => {
    const entry = setting(mode);
    const available = entry.value === 'permitted';
    return { mode, title: BROAD_MODE_TITLE[mode], reach: BROAD_MODE_REACH[mode], available, unavailableReason: available ? null : unavailableReason(mode, entry.source) };
  });
  const settings = task.threadSettings;
  return {
    ...base,
    taskId: String(broad.taskId),
    broadMode: {
      label: BROAD_MODE_LABEL,
      revision: Number(broad.revision),
      recorded,
      status,
      effectiveMode,
      reach: BROAD_MODE_REACH[recorded],
      statusLabel: status === 'suspended' ? 'Suspended by policy' : BROAD_MODE_TITLE[effectiveMode],
      suspendedReason,
    },
    options,
    threadSettings: {
      sandbox: oneOf(['read-only', 'workspace-write', 'danger-full-access'] as const, settings.sandbox, 'sandbox'),
      approvalPolicy: oneOf(['untrusted', 'on-request', 'never'] as const, settings.approvalPolicy, 'approval policy'),
      networkAccess: settings.networkAccess === true,
      mode: oneOf(BROAD_MODES, settings.mode, 'thread mode'),
    },
  };
}

// ---- payload validators -------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function plainObject(args: readonly unknown[]): Record<string, unknown> {
  if (args.length !== 1) throw new OperationError('expected one argument');
  const value = args[0];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new OperationError('expected an object');
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) throw new OperationError('expected a plain object');
  return value as Record<string, unknown>;
}

function exactKeys(record: Record<string, unknown>, keys: readonly string[]): void {
  for (const key of Object.keys(record)) if (!keys.includes(key)) throw new OperationError(`unknown key ${key}`);
  for (const key of keys) if (!Object.hasOwn(record, key)) throw new OperationError(`missing key ${key}`);
}

function uuid(value: unknown, key: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new OperationError(`${key} must be a UUID`);
  return value;
}

export interface SetBroadModeInput {
  operationId: string;
  taskId: string;
  expectedRevision: number;
  mode: BroadMode;
  /** The reach statement the person confirmed; null for `standard`. */
  confirmation: string | null;
}

export const taskPolicyPayload: PayloadValidator<{ taskId: string }> = (args) => {
  const record = plainObject(args);
  exactKeys(record, ['taskId']);
  return { taskId: uuid(record.taskId, 'taskId') };
};

/**
 * `{ operationId, taskId, expectedRevision, mode, confirmation }`: a broader
 * mode needs exactly its reach statement as the confirmation, `standard` none.
 * No actor, principal or policy key passes; main supplies those.
 */
export const setBroadModePayload: PayloadValidator<SetBroadModeInput> = (args) => {
  const record = plainObject(args);
  exactKeys(record, ['operationId', 'taskId', 'expectedRevision', 'mode', 'confirmation']);
  const { expectedRevision, mode, confirmation } = record;
  if (typeof expectedRevision !== 'number' || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new OperationError('wrong type for expectedRevision');
  }
  if (!(BROAD_MODES as readonly unknown[]).includes(mode)) throw new OperationError('mode must be standard, no_prompt or full_access');
  if (mode === 'standard') {
    if (confirmation !== null) throw new OperationError('the standard mode takes no confirmation');
  } else if (confirmation !== BROAD_MODE_REACH[mode as BroadMode]) {
    throw new OperationError('a broader mode needs the confirmation of its reach');
  }
  return {
    operationId: uuid(record.operationId, 'operationId'),
    taskId: uuid(record.taskId, 'taskId'),
    expectedRevision,
    mode: mode as BroadMode,
    confirmation: confirmation as string | null,
  };
};
