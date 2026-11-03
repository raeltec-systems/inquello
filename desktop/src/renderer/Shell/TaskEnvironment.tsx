/** Read-only execution facts. Inspection never starts a tool, probe, or inference. */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { parseTaskEnvironment, REMOTE_GATE, type TaskEnvironmentView } from '../../main/environments/types';
import { Button } from '../primitives';
import { modelAuthorityApplies, type ModelAuthorityChange } from './model-authority';

interface EnvironmentBridge {
  forTask(input: { taskId: string }): Promise<unknown>;
  onChanged?(listener: () => void): () => void;
}
const bridge = (): EnvironmentBridge | null =>
  (globalThis as { inquello?: { environments?: EnvironmentBridge } }).inquello?.environments ?? null;
const UNAVAILABLE = 'Environment information unavailable. Refresh to check this Task.';

export function TaskEnvironment({ taskId }: { taskId: string }): ReactElement {
  const [view, setView] = useState<TaskEnvironmentView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const reload = useRef<() => void>(() => {});
  useEffect(() => {
    let live = true;
    const api = bridge();
    const load = async () => {
      const request = ++generation.current;
      setView(null);
      setNotice(null);
      setBusy(true);
      try {
        if (!api) throw new Error('Unavailable');
        const result = await api.forTask({ taskId });
        if (!live || request !== generation.current) return;
        if (!result || typeof result !== 'object' || !('ok' in result) || result.ok !== true || !('value' in result)) throw new Error('Unavailable');
        const next = parseTaskEnvironment(result.value);
        if (next.taskId !== taskId) throw new Error('Wrong Task');
        setView(next);
      } catch {
        // Never display transport/server errors, which can contain private values.
        if (live && request === generation.current) setNotice(UNAVAILABLE);
      } finally {
        if (live && request === generation.current) setBusy(false);
      }
    };
    reload.current = () => { void load(); };
    void load();
    const unsubscribe = api?.onChanged?.(() => { void load(); });
    const routes = (globalThis as { inquello?: { routes?: { onChanged?(listener: (change?: ModelAuthorityChange) => void): () => void } } }).inquello?.routes;
    const unsubscribeModel = routes?.onChanged?.(change => { if (modelAuthorityApplies(change, taskId)) void load(); });
    return () => { live = false; generation.current++; unsubscribe?.(); unsubscribeModel?.(); };
  }, [taskId]);

  // Do not show the old Task even during the render preceding its effect cleanup.
  const current = view?.taskId === taskId ? view : null;
  const inference = current?.inference;
  return (
    <section className="iq-task-environment" aria-label="Task environment" data-task-environment>
      <h2 className="iq-task-states-heading">Environment</h2>
      <Button size="sm" onPress={() => reload.current()} pending={busy} pendingText="Reading environment facts">Refresh environment</Button>
      {notice && <p role="status">{notice}</p>}
      <dl className="iq-task-environment-facts">
        <dt>Execution location</dt><dd>This device (local host)</dd>
        <dt>Runtime readiness</dt><dd>{current?.readiness === 'ready' ? 'Ready — runtime-owned configuration verified' : current ? 'This device (local host) is unavailable for tool execution' : 'This device (local host) runtime information unavailable'}</dd>
        <dt>Sandbox</dt><dd>{!current || current.sandbox === 'not-checked' ? 'Not checked' : current.sandbox === 'available' ? 'Available' : 'Unavailable'}</dd>
        <dt>Inference</dt><dd>{inference?.status === 'selected' ? 'Selected conversation model' : inference?.status === 'none' ? 'No conversation model selected' : inference?.status === 'stale' ? 'Saved model information changed — refresh to review availability' : 'Model information unavailable'}</dd>
        {inference?.status === 'selected' && <>
          <dt>Provider</dt><dd>{inference.provider ?? 'Unknown'}</dd>
          <dt>Model</dt><dd>{inference.model ?? 'Unknown'}</dd>
          <dt>Inference region</dt><dd>{inference.region}</dd>
        </>}
      </dl>
      <p>Local execution does not mean local or offline inference. Runtime readiness, sandbox checks and model availability are separate.</p>
      <div className="iq-task-environment-gates">
        <Button size="sm" disabledReason={current?.remoteGate ?? REMOTE_GATE}>Remote / cloud execution — not enabled</Button>
        <p>Collaboration hosting is not execution.</p>
        <Button size="sm" disabledReason="V2 revisit (OQ-13)">Hosted browser / sandbox — not enabled</Button>
      </div>
    </section>
  );
}
