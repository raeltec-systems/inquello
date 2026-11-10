/** Inspection only: location is not eligibility, readiness is not sandbox verification. */
export const LOCAL_ENVIRONMENT = 'This device (local host)' as const;
export const REMOTE_GATE = 'Not enabled. Story 8.1 requires proven service, identity, context transfer, mutation ownership, policy eligibility and recovery. Collaboration hosting is not execution.';
export interface TaskEnvironmentView {
  taskId: string;
  executionLabel: typeof LOCAL_ENVIRONMENT;
  readiness: 'ready' | 'unavailable';
  sandbox: 'not-checked' | 'available' | 'unavailable';
  inference: { status: 'selected' | 'none' | 'unavailable' | 'stale'; provider: string | null; deployment: string | null; endpoint: string | null; model: string | null; apiVersion: string | null; region: string };
  remoteGate: string;
  hostedSandboxGate: 'V2 revisit (OQ-13)';
}
export type TaskEnvironmentResult = { ok: true; value: TaskEnvironmentView } | { ok: false; reason: string };
export function parseTaskEnvironment(value: unknown): TaskEnvironmentView {
  if (!value || typeof value !== 'object') throw new Error('Environment information unavailable');
  const v = value as TaskEnvironmentView;
  const nullable = (s: unknown) => s === null || (typeof s === 'string' && s.length <= 4096);
  if (typeof v.taskId !== 'string' || v.taskId.length > 128 || v.executionLabel !== LOCAL_ENVIRONMENT || !['ready','unavailable'].includes(v.readiness) || !['not-checked','available','unavailable'].includes(v.sandbox) || !v.inference || !['selected','none','unavailable','stale'].includes(v.inference.status) || ![v.inference.provider,v.inference.deployment,v.inference.endpoint,v.inference.model,v.inference.apiVersion].every(nullable) || typeof v.inference.region !== 'string' || v.inference.region.length > 4096 || v.remoteGate !== REMOTE_GATE || v.hostedSandboxGate !== 'V2 revisit (OQ-13)') throw new Error('Environment information unavailable');
  const metadata = [v.inference.provider, v.inference.deployment, v.inference.endpoint, v.inference.model, v.inference.apiVersion];
  const consistent = v.inference.status === 'selected'
    ? metadata.every(field => typeof field === 'string' && field.trim().length > 0) && v.inference.region.trim().length > 0
    : metadata.every(field => field === null) && v.inference.region === 'Unknown';
  if (!consistent) throw new Error('Environment information unavailable');
  return v;
}
