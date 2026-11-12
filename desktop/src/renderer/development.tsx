/**
 * Development mode in the renderer (spec-dev-mode-real-model-testing). Main
 * reports it on `runtime.getStatus` (`developmentMode: true`) only when the
 * unpackaged app was started by `scripts/run-dev.cjs`, with
 * `developmentProblem` when the development sign-in or Workspace join failed.
 * The notice text is duplicated from main (`main/development-mode.ts`): the
 * renderer cannot import main constants.
 */
import { useEffect, useState, type ReactElement } from 'react';

export const DEVELOPMENT_NOTICE = 'Development build: qualification checks are off. Use only data you control.';

interface DevelopmentState { on: boolean; problem: string | null }
const OFF: DevelopmentState = { on: false, problem: null };

let known: DevelopmentState | null = null;
let pending: Promise<DevelopmentState> | null = null;

function parse(status: unknown): DevelopmentState {
  const value = !!status && typeof status === 'object' ? status as { developmentMode?: unknown; developmentProblem?: unknown } : {};
  const on = value.developmentMode === true;
  return { on, problem: on && typeof value.developmentProblem === 'string' && value.developmentProblem ? value.developmentProblem : null };
}

function read(): Promise<DevelopmentState> {
  if (known !== null) return Promise.resolve(known);
  const api = (globalThis as { inquello?: { runtime?: { getStatus?: () => Promise<unknown> } } }).inquello?.runtime;
  if (!api?.getStatus) return Promise.resolve(OFF);
  const getStatus = () => api.getStatus!();
  // One retry: a failed first read must not hide the notice for the whole run.
  pending ??= getStatus().catch(() => getStatus()).then(
    (status) => (known = parse(status)),
    () => { pending = null; return OFF; },
  );
  return pending;
}

function useDevelopmentState(): DevelopmentState {
  const [state, setState] = useState<DevelopmentState>(known ?? OFF);
  useEffect(() => {
    let live = true;
    void read().then((value) => { if (live && value.on) setState(value); });
    return () => { live = false; };
  }, []);
  return state;
}

/** True once main has reported development mode; it never changes during a run. */
export function useDevelopmentBuild(): boolean {
  return useDevelopmentState().on;
}

/** The persistent notice, and the development sign-in failure if there was one; nothing outside development mode. */
export function DevelopmentNotice(): ReactElement {
  const { on, problem } = useDevelopmentState();
  if (!on) return <></>;
  return (
    <div className="iq-development-notice" data-development-notice>
      <p role="note">{DEVELOPMENT_NOTICE}</p>
      {problem ? <p role="alert" className="iq-development-problem">{problem}</p> : null}
    </div>
  );
}

/** Tests only: forget the cached answer. */
export function resetDevelopmentBuildForTests(): void { known = null; pending = null; }
