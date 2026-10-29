/**
 * The renderer's typed view of `window.inquello.policy` (Story 1.18): the
 * effective managed policy for Settings (S07, "Capabilities and processing")
 * and for the open Task, and a Task's broader execution mode.
 *
 * Main supplies every text (setting names, values, governing rules, reach
 * statements, reasons); these parsers keep only the published fields and
 * treat anything malformed as a failed read, never as a half-read policy.
 */

export type BroadMode = 'standard' | 'no_prompt' | 'full_access';

export interface PolicySettingItem {
  name: string;
  label: string;
  valueLabel: string;
  sourceLabel: string;
  restricted: boolean;
}

export interface CapabilityItem {
  id: string;
  label: string;
  statusLabel: string;
}

export interface PolicyItem {
  environmentLabel: string;
  policyRevision: number;
  settings: PolicySettingItem[];
  deviceLabel: string;
  capabilities: CapabilityItem[];
}

export interface BroadModeOption {
  mode: 'no_prompt' | 'full_access';
  title: string;
  reach: string;
  available: boolean;
  unavailableReason: string | null;
}

export interface TaskPolicyItem extends PolicyItem {
  taskId: string;
  broadMode: {
    label: string;
    revision: number;
    recorded: BroadMode;
    status: 'standard' | 'active' | 'suspended';
    effectiveMode: BroadMode;
    reach: string;
    statusLabel: string;
    suspendedReason: string | null;
  };
  options: BroadModeOption[];
}

export interface SettingsPolicyItem {
  signedIn: boolean;
  environmentLabel: string;
  workspaces: Array<{ workspaceId: string; name: string; policy: PolicyItem | null; reason: string | null }>;
  capabilities: CapabilityItem[];
  reason: string | null;
}

export interface PolicyBridge {
  getSettings(): Promise<unknown>;
  forTask(request: { taskId: string }): Promise<unknown>;
  setBroadMode(request: { operationId: string; taskId: string; expectedRevision: number; mode: BroadMode; confirmation: string | null }): Promise<unknown>;
}

/** The policy operations, or null outside the desktop. */
export function policyBridge(): PolicyBridge | null {
  const bridge = (globalThis as { inquello?: { policy?: PolicyBridge } }).inquello;
  return bridge?.policy ?? null;
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const count = (value: unknown): number | null => (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null);
const BROAD_MODES: readonly BroadMode[] = ['standard', 'no_prompt', 'full_access'];
const isMode = (value: unknown): value is BroadMode => (BROAD_MODES as readonly unknown[]).includes(value);

function list<T>(value: unknown, parse: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const out: T[] = [];
  for (const item of value) {
    const parsed = parse(item);
    if (parsed === null) return null;
    out.push(parsed);
  }
  return out;
}

function parseSetting(value: unknown): PolicySettingItem | null {
  const r = record(value);
  const name = text(r?.name);
  const label = text(r?.label);
  const valueLabel = text(r?.valueLabel);
  const sourceLabel = text(r?.sourceLabel);
  if (!r || name === null || label === null || valueLabel === null || sourceLabel === null || typeof r.restricted !== 'boolean') return null;
  return { name, label, valueLabel, sourceLabel, restricted: r.restricted };
}

function parseCapability(value: unknown): CapabilityItem | null {
  const r = record(value);
  const id = text(r?.id);
  const label = text(r?.label);
  const statusLabel = text(r?.statusLabel);
  // An enabled entry is never shown as such: Story 1.18 enables nothing.
  if (!r || id === null || label === null || statusLabel === null || r.enabled !== false) return null;
  return { id, label, statusLabel };
}

export function parsePolicy(value: unknown): PolicyItem | null {
  const r = record(value);
  const device = record(r?.device);
  const environmentLabel = text(r?.environmentLabel);
  const policyRevision = count(r?.policyRevision);
  const settings = list(r?.settings, parseSetting);
  const capabilities = list(r?.capabilities, parseCapability);
  const deviceLabel = text(device?.label);
  if (!r || environmentLabel === null || policyRevision === null || !settings || !capabilities || deviceLabel === null) return null;
  return { environmentLabel, policyRevision, settings, deviceLabel, capabilities };
}

function parseOption(value: unknown): BroadModeOption | null {
  const r = record(value);
  const title = text(r?.title);
  const reach = text(r?.reach);
  if (!r || (r.mode !== 'no_prompt' && r.mode !== 'full_access') || title === null || reach === null || typeof r.available !== 'boolean') return null;
  const unavailableReason = r.unavailableReason === null ? null : text(r.unavailableReason);
  if (!r.available && unavailableReason === null) return null;
  return { mode: r.mode, title, reach, available: r.available, unavailableReason };
}

export function parseTaskPolicy(value: unknown): TaskPolicyItem | null {
  const base = parsePolicy(value);
  const r = record(value);
  const broad = record(r?.broadMode);
  const options = list(r?.options, parseOption);
  const taskId = text(r?.taskId);
  if (!base || !r || !broad || !options || taskId === null) return null;
  const revision = count(broad.revision);
  const label = text(broad.label);
  const reach = text(broad.reach);
  const statusLabel = text(broad.statusLabel);
  const status = broad.status;
  if (revision === null || label === null || reach === null || statusLabel === null) return null;
  if (!isMode(broad.recorded) || !isMode(broad.effectiveMode)) return null;
  if (status !== 'standard' && status !== 'active' && status !== 'suspended') return null;
  const suspendedReason = broad.suspendedReason === null ? null : text(broad.suspendedReason);
  if (status === 'suspended' && suspendedReason === null) return null;
  return {
    ...base,
    taskId,
    broadMode: { label, revision, recorded: broad.recorded, status, effectiveMode: broad.effectiveMode, reach, statusLabel, suspendedReason },
    options,
  };
}

export function parseSettingsPolicy(value: unknown): SettingsPolicyItem | null {
  const r = record(value);
  const environmentLabel = text(r?.environmentLabel);
  const capabilities = list(r?.capabilities, parseCapability);
  const workspaces = list(r?.workspaces, (item) => {
    const w = record(item);
    const workspaceId = text(w?.workspaceId);
    const name = text(w?.name);
    if (!w || workspaceId === null || name === null) return null;
    const policy = w.policy === null ? null : parsePolicy(w.policy);
    if (w.policy !== null && policy === null) return null;
    const reason = w.reason === null ? null : text(w.reason);
    return { workspaceId, name, policy, reason };
  });
  if (!r || typeof r.signedIn !== 'boolean' || environmentLabel === null || !capabilities || !workspaces) return null;
  const reason = r.reason === null ? null : text(r.reason);
  return { signedIn: r.signedIn, environmentLabel, workspaces, capabilities, reason };
}
