/**
 * The Local data block (Story 1.12): every category of local data the desktop
 * can hold, with its owner, rule and export rule, the real-data blockers, and
 * the export, import and delete actions.
 *
 * Built from the Story 1.6–1.8 primitives. It talks to main only through the
 * named `inquello.data` operations: main shows every folder dialog, so the
 * block never supplies a path; deletion sends category ids only. Data
 * attributes expose the rendered state to the smoke probe.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { dataBridge, parseDataAction, parseDataPolicy, type DataCategoryView, type DataPolicyView } from './bridge';
import { Button, Checkbox, StatusChip } from './primitives';

const RETENTION_TEXT = {
  'until-owner-deletes': 'Kept until you delete it; no automatic expiry',
  unknown: 'Retention unknown',
} as const;

const ACCESS_TEXT = {
  'main-process-only': 'Desktop main process only',
  runtime: 'Runtime',
} as const;

function exportText(category: DataCategoryView): string {
  if (category.export.mode === 'included') return 'Included only with trusted native ownership and current access';
  if (category.export.mode === 'unknown') return 'Export rule unknown';
  return `Not exported: ${category.export.reason ?? 'excluded'}`;
}

function heldText(category: DataCategoryView): string {
  if (!category.enabled) return 'Disabled; never written';
  if (category.location === 'os-credential-store') return 'Held in the OS credential store';
  return category.held.files === 0 ? 'Nothing held' : `${category.held.files} file${category.held.files === 1 ? '' : 's'} held`;
}

type Action = 'export' | 'import' | 'delete';

export function LocalData(): ReactElement {
  const bridge = dataBridge();
  const [policy, setPolicy] = useState<DataPolicyView | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<Action | null>(null);
  const [report, setReport] = useState<{ ok: boolean; lines: string[] } | null>(null);

  const load = useCallback(async () => {
    if (!bridge) return;
    try {
      const next = parseDataPolicy(await bridge.getPolicy());
      if (next) setPolicy(next);
    } catch {
      setReport({ ok: false, lines: ['The local data policy could not be read.'] });
    }
  }, [bridge]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: Action) => {
    if (!bridge) return;
    setBusy(action);
    setReport(null);
    try {
      const raw = action === 'export' ? await bridge.export() : action === 'import' ? await bridge.import() : await bridge.delete(selected);
      const result = parseDataAction(raw, action);
      if (!result) setReport({ ok: false, lines: ['The request did not complete.'] });
      else if (!result.ok) setReport({ ok: false, lines: [result.reason ?? 'The request did not complete.'] });
      else setReport({ ok: true, lines: result.lines });
      if (action === 'delete' && result?.ok) setSelected([]);
    } catch {
      setReport({ ok: false, lines: ['The request did not complete.'] });
    } finally {
      setBusy(null);
      setConfirming(false);
      void load();
    }
  };

  const toggle = (id: string, checked: boolean) => {
    setConfirming(false);
    setSelected((current) => (checked ? [...current.filter((entry) => entry !== id), id] : current.filter((entry) => entry !== id)));
  };

  const unavailable = !bridge ? 'Local data actions are available in the desktop app only.' : !policy ? 'The local data policy is loading.' : !policy.loaded ? 'The local data policy did not load.' : undefined;
  const actionReason = unavailable ?? (busy ? 'Another local data action is in progress.' : undefined);
  const deleteReason = actionReason ?? (selected.length === 0 ? 'Choose at least one category to delete.' : undefined);
  const chosenLabels = (policy?.categories ?? []).filter((category) => selected.includes(category.id)).map((category) => category.label);

  return (
    <div className="specimen-local-data" data-local-data="" data-policy-loaded={policy ? String(policy.loaded) : 'unknown'} data-blockers={policy ? String(policy.blockers.length) : 'unknown'}>
      <p className="specimen-account-note">
        {policy?.policyOwner ? `You own your private local data on this device. ${policy.policyOwner} sets the rules.` : 'Checking the local data policy.'}
      </p>
      <p>Export and recovery require current Workspace access and proven native ownership. Unknown or mixed content stays unavailable. Recovery validates a service-held byte receipt and current access; an imported manifest never grants permission. Deleting local data removes the local export journal, not service receipts. Receipts hold no source bytes and grant no access.</p>
      <div className="specimen-local-data-blockers">
        {policy && policy.blockers.length === 0 ? (
          <StatusChip status="data-no-blockers" label="No local policy blockers — route evidence and approval are checked separately" />
        ) : policy ? (
          <>
            <StatusChip status="data-blocked" label={`Real data blocked (${policy.blockers.length})`} />
            <ul className="specimen-local-data-list">
              {policy.blockers.map((blocker, index) => (
                <li key={`${blocker.kind}-${index}`}>{blocker.detail}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
      <ul className="specimen-local-data-categories">
        {(policy?.categories ?? []).map((category) => (
          <li key={category.id} className="specimen-local-data-category" data-local-data-category={category.id} data-enabled={String(category.enabled)}>
            <div className="specimen-local-data-head">
              {category.enabled && category.location === 'files' ? (
                <Checkbox
                  label={category.label}
                  checked={selected.includes(category.id)}
                  onChange={(checked) => toggle(category.id, checked)}
                  disabledReason={actionReason}
                />
              ) : (
                <span className="specimen-local-data-label">{category.label}</span>
              )}
              <StatusChip status={category.enabled ? 'data-enabled' : 'data-disabled'} label={heldText(category)} />
            </div>
            <dl className="specimen-local-data-rules">
              <dt>Owner</dt>
              <dd>{category.owner}</dd>
              <dt>Rule set by</dt>
              <dd>{category.ruleOwner}</dd>
              <dt>Retention</dt>
              <dd>{RETENTION_TEXT[category.retention]}</dd>
              <dt>Access</dt>
              <dd>{ACCESS_TEXT[category.access]}</dd>
              <dt>Export</dt>
              <dd>{exportText(category)}</dd>
              <dt>Deletion</dt>
              <dd>{category.deletion}</dd>
            </dl>
          </li>
        ))}
      </ul>
      <div className="specimen-account-actions">
        <Button variant="primary" data-local-data-action="export" pending={busy === 'export'} disabledReason={busy === 'export' ? undefined : actionReason} onPress={() => void run('export')}>
          Export
        </Button>
        <Button variant="secondary" data-local-data-action="import" pending={busy === 'import'} disabledReason={busy === 'import' ? undefined : actionReason} onPress={() => void run('import')}>
          Import
        </Button>
        {confirming ? (
          <>
            <Button variant="primary" data-local-data-action="confirm-delete" pending={busy === 'delete'} disabledReason={busy === 'delete' ? undefined : deleteReason} onPress={() => void run('delete')}>
              Confirm deletion
            </Button>
            <Button variant="quiet" data-local-data-action="cancel-delete" disabledReason={busy ? actionReason : undefined} onPress={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="secondary" data-local-data-action="delete" disabledReason={deleteReason} onPress={() => setConfirming(true)}>
            Delete selected
          </Button>
        )}
      </div>
      {confirming ? (
        <p className="specimen-account-note" role="status">
          {`Delete ${chosenLabels.join(', ')}? The runtime stops and restarts. Exported copies are not deleted.`}
        </p>
      ) : null}
      {report ? (
        <div className="specimen-local-data-report" role="status" data-local-data-report={report.ok ? 'ok' : 'failed'}>
          {report.lines.map((line, index) => (
            <p key={index} className="specimen-account-note">
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
