/**
 * The open Task's policy summary and broader execution mode (Story 1.18).
 *
 * - A compact summary of the effective policy on this device: the sandbox
 *   ceiling, how the agent asks before actions and network access, each with
 *   the rule that governs it.
 * - The Task's execution mode. A broader mode (No prompt, Full access) is
 *   labelled "Broader execution mode" with its reach, never as review,
 *   approval or acceptance, and never with a green or approved chip. A mode
 *   the policy no longer permits shows "Suspended by policy" and the Task
 *   runs as Standard.
 * - Choosing a broader mode opens an explicit confirmation that states its
 *   reach; only "Turn on" in that confirmation sets it, for this Task only.
 *   An unavailable mode stays focusable and says which rule prevents it.
 * - What the Task's tools can reach (Story 1.19), in plain words with no
 *   device path or sandbox syntax: what they can read, where they can write
 *   and which destinations they can contact, or "No filesystem limits" under
 *   a permitted Full access mode; and whether the local sandbox applies on
 *   this device ("Local sandbox unavailable on this device" when it cannot).
 */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';

import { Button, StatusChip } from '../primitives';
import type { BroadModeOption, ReachItem, TaskPolicyItem } from '../policy-bridge';

/** The reach lines main supplies, as a definition list. */
export function ReachList({ reach, scope }: { reach: ReachItem; scope: string }): ReactElement {
  return (
    <dl className="iq-task-states-list" data-reach={scope} data-reach-bounded={String(reach.bounded)}>
      {reach.lines.map((line) => (
        <div key={line.name} className="iq-task-state" data-reach-line={line.name}>
          <dt className="iq-task-state-name">{line.label}</dt>
          <dd className="iq-task-state-value">{line.value}</dd>
        </div>
      ))}
      <div className="iq-task-state" data-reach-line="network-rule">
        <dt className="iq-task-state-name">Destinations set by</dt>
        <dd className="iq-task-state-value">{reach.networkSourceLabel}</dd>
      </div>
    </dl>
  );
}

export interface TaskPolicyProps {
  policy: TaskPolicyItem | null;
  /** Why the policy could not be read, if it could not. */
  notice?: string | null;
  /** Sets the mode; resolves with a reason when it was refused. */
  onSetMode?: (mode: 'standard' | 'no_prompt' | 'full_access', confirmation: string | null) => Promise<string | null>;
}

const SUMMARY = ['sandbox', 'approval', 'network'] as const;

export function TaskPolicy({ policy, notice = null, onSetMode }: TaskPolicyProps): ReactElement {
  const [confirming, setConfirming] = useState<BroadModeOption | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  // A different Task opened: close any confirmation.
  useEffect(() => {
    setConfirming(null);
    setMessage(null);
  }, [policy?.taskId]);

  useEffect(() => {
    if (confirming) dialog.current?.querySelector<HTMLElement>('[data-broad-mode-action="cancel"]')?.focus();
  }, [confirming]);

  const close = () => {
    setConfirming(null);
    opener.current?.focus();
  };

  const apply = async (mode: 'standard' | 'no_prompt' | 'full_access', confirmation: string | null) => {
    if (!onSetMode || busy) return;
    setBusy(true);
    setMessage(null);
    const refused = await onSetMode(mode, confirmation);
    setBusy(false);
    setConfirming(null);
    setMessage(refused);
  };

  const onDialogKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      event.preventDefault();
      close();
    }
  };

  const broad = policy?.broadMode;
  const unavailable = !onSetMode ? 'Execution modes can be changed in the desktop app only.' : busy ? 'A change is in progress.' : undefined;
  return (
    <section className="iq-task-policy" aria-labelledby="iq-task-policy-heading" data-task-policy={policy?.taskId ?? ''}>
      <h2 id="iq-task-policy-heading" className="iq-task-states-heading">
        Policy on this device
      </h2>
      {notice ? (
        <p className="iq-task-notice" role="status" data-task-policy-notice>
          {notice}
        </p>
      ) : null}
      {policy ? (
        <>
          <dl className="iq-task-states-list" data-task-policy-summary>
            {SUMMARY.map((name) => {
              const setting = policy.settings.find((entry) => entry.name === name);
              if (!setting) return null;
              return (
                <div key={name} className="iq-task-state" data-policy-setting={name}>
                  <dt className="iq-task-state-name">{setting.label}</dt>
                  <dd className="iq-task-state-value">
                    {setting.valueLabel} <span className="iq-task-state-meta">({setting.sourceLabel})</span>
                  </dd>
                </div>
              );
            })}
          </dl>
          <section className="iq-task-reach" aria-labelledby="iq-task-reach-heading" data-task-reach={policy.taskId}>
            <h3 id="iq-task-reach-heading" className="iq-task-state-name">
              What this Task's tools can reach
            </h3>
            <p className={policy.sandbox.status === 'unavailable' ? 'iq-task-notice' : 'iq-task-state-meta'} role={policy.sandbox.status === 'unavailable' ? 'status' : undefined} data-task-sandbox={policy.sandbox.status}>
              {policy.sandbox.label}
            </p>
            <ReachList reach={policy.reach} scope="task" />
          </section>
          <div className="iq-task-mode" data-broad-mode={broad?.recorded} data-broad-mode-status={broad?.status} data-broad-mode-effective={broad?.effectiveMode}>
            <p className="iq-task-mode-line">
              <span className="iq-task-state-name">{broad?.label}</span>{' '}
              <StatusChip status={`broad-mode:${broad?.status ?? 'standard'}`} label={broad?.statusLabel ?? 'Standard'} />
            </p>
            {broad && broad.status === 'active' ? (
              <p className="iq-task-mode-reach" data-broad-mode-reach>
                {broad.reach}
              </p>
            ) : null}
            {broad?.suspendedReason ? (
              <p className="iq-task-mode-reach" data-broad-mode-suspended>
                {broad.suspendedReason}
              </p>
            ) : null}
            <div className="iq-task-mode-actions">
              {policy.options.map((option) => {
                const current = broad?.status === 'active' && broad.effectiveMode === option.mode;
                return (
                  <Button
                    key={option.mode}
                    variant="secondary"
                    size="sm"
                    data-broad-mode-option={option.mode}
                    disabledReason={current ? `${option.title} is on for this Task.` : (option.unavailableReason ?? unavailable)}
                    onPress={() => {
                      opener.current = document.activeElement as HTMLElement | null;
                      setMessage(null);
                      setConfirming(option);
                    }}
                  >
                    {`Use ${option.title}…`}
                  </Button>
                );
              })}
              {broad && broad.recorded !== 'standard' ? (
                <Button variant="quiet" size="sm" data-broad-mode-option="standard" pending={busy && !confirming} disabledReason={busy ? undefined : unavailable} onPress={() => void apply('standard', null)}>
                  Return to Standard
                </Button>
              ) : null}
            </div>
          </div>
          {confirming ? (
            <div
              ref={dialog}
              className="iq-task-mode-confirm"
              role="alertdialog"
              aria-modal="false"
              aria-labelledby="iq-task-mode-confirm-title"
              aria-describedby="iq-task-mode-confirm-reach"
              data-broad-mode-confirm={confirming.mode}
              onKeyDown={onDialogKey}
            >
              <p id="iq-task-mode-confirm-title" className="iq-task-mode-confirm-title">
                {`Turn on ${confirming.title} for this Task?`}
              </p>
              <p id="iq-task-mode-confirm-reach" className="iq-task-mode-reach" data-broad-mode-confirm-reach>
                {confirming.reach}
              </p>
              <p className="iq-task-state-meta">This is a broader execution mode for this Task only. It ends with the Task and changes no other Task.</p>
              <div className="iq-task-mode-actions">
                <Button variant="primary" size="sm" data-broad-mode-action="confirm" pending={busy} disabledReason={busy ? undefined : unavailable} onPress={() => void apply(confirming.mode, confirming.reach)}>
                  {`Turn on ${confirming.title}`}
                </Button>
                <Button variant="quiet" size="sm" data-broad-mode-action="cancel" onPress={close}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
          {message ? (
            <p className="iq-task-notice" role="status" data-broad-mode-notice>
              {message}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
