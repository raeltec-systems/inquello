/**
 * S07 command rules (Story 1.20), after the Capability Contract in
 * "Capabilities and processing".
 *
 * - For each of the person's Workspaces: the Workspace command rules, each
 *   with what it decides and its source ("Workspace policy, revision 4"),
 *   and the automatic permission reviewer's state ("Automated permission
 *   review: off" by default, or "not available (no processing route)").
 * - The person's own rules ("Your rule"): they only ask first or forbid,
 *   never allow, and can be added and removed here. Each change carries a
 *   fresh operation ID and the rules version the person saw.
 *
 * Talks to main only through `inquello.permissions`; every text comes from main.
 */
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';

import { parsePermissionSettings, permissionBridge, type PermissionSettingsItem, type RuleItem } from './permission-bridge';
import { Button, SegmentedControl, StatusChip, TextField } from './primitives';
import { newOperationId } from './Shell/organise-bridge';

const REFRESH_MS = 30_000;

function RuleList({ rules, empty, onRemove }: { rules: readonly RuleItem[]; empty: string; onRemove?: (rule: RuleItem) => void }): ReactElement {
  if (rules.length === 0) return <p className="specimen-account-note">{empty}</p>;
  return (
    <ul className="specimen-policy-capabilities">
      {rules.map((rule) => (
        <li key={`${rule.sourceLabel}:${rule.prefixText}`} data-command-rule={rule.prefixText} data-rule-decision={rule.decision}>
          <code className="specimen-policy-capability">{rule.prefixText}</code>
          <StatusChip status={`rule:${rule.decision}`} label={rule.decisionLabel} />
          <span className="specimen-policy-source" data-rule-source>
            {rule.sourceLabel}
          </span>
          {rule.note ? <span className="specimen-account-note">{rule.note}</span> : null}
          {onRemove ? (
            <Button size="sm" onPress={() => onRemove(rule)} data-action="remove-user-rule">
              {`Remove the rule for ${rule.prefixText}`}
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function PermissionRules({ operationIds = newOperationId }: { operationIds?: () => string }): ReactElement {
  const bridge = permissionBridge();
  const [view, setView] = useState<PermissionSettingsItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [prefix, setPrefix] = useState('');
  const [decision, setDecision] = useState<'prompt' | 'forbid'>('prompt');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!bridge) return;
    try {
      const next = parsePermissionSettings(await bridge.getRules());
      if (next) setView(next);
      else setNotice('The command rules could not be read.');
    } catch {
      setNotice('The command rules could not be read.');
    }
  }, [bridge]);

  useEffect(() => {
    if (!bridge) return undefined;
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [bridge, load]);

  const save = async (rules: Array<{ prefix: string[]; decision: 'prompt' | 'forbid'; note: string | null }>, done: string) => {
    if (!bridge || !view?.userRules || busy) return;
    setBusy(true);
    try {
      const result = (await bridge.setUserRules({ operationId: operationIds(), expectedRevision: view.userRules.revision, rules })) as { ok?: unknown; value?: unknown; reason?: unknown };
      const next = result && result.ok === true ? parsePermissionSettings(result.value) : null;
      if (next) {
        setView(next);
        setNotice(done);
        setPrefix('');
      } else {
        setNotice(typeof result?.reason === 'string' ? result.reason : 'Your rules were not changed.');
        await load();
      }
    } catch {
      setNotice('Your rules were not changed.');
    }
    setBusy(false);
  };

  const own = view?.userRules?.rules ?? [];
  const asInput = (rule: RuleItem) => ({ prefix: rule.prefix, decision: rule.decision === 'forbid' ? ('forbid' as const) : ('prompt' as const), note: rule.note });

  const add = (event: FormEvent) => {
    event.preventDefault();
    const words = prefix.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      setNotice('Enter the command words the rule starts with.');
      return;
    }
    const same = (rule: RuleItem) => rule.prefix.length === words.length && rule.prefix.every((word, index) => word === words[index]);
    void save([...own.filter((rule) => !same(rule)).map(asInput), { prefix: words, decision, note: null }], 'Your rule was added.');
  };

  const remove = (rule: RuleItem) => {
    void save(
      own.filter((entry) => entry !== rule).map(asInput),
      'Your rule was removed.',
    );
  };

  return (
    <section className="specimen-policy" aria-labelledby="specimen-permission-rules-heading" data-permissions-section="" data-permissions-loaded={view ? 'true' : 'false'}>
      <h3 id="specimen-permission-rules-heading" className="specimen-policy-heading">
        Command rules
      </h3>
      {!bridge ? <p className="specimen-account-note">Command rules are shown in the desktop app only.</p> : null}
      {notice ? (
        <p className="specimen-account-note" role="status" data-permissions-notice>
          {notice}
        </p>
      ) : null}
      {view?.reason ? <p className="specimen-account-note">{view.reason}</p> : null}
      {(view?.workspaces ?? []).map((workspace) => (
        <section key={workspace.workspaceId} aria-label={`Command rules for ${workspace.name}`} data-permission-workspace={workspace.workspaceId}>
          <h4 className="specimen-policy-heading">{workspace.name}</h4>
          {workspace.reason ? (
            <p className="specimen-account-note">{workspace.reason}</p>
          ) : (
            <RuleList rules={workspace.rules} empty="No Workspace command rules. Commands follow the asking behaviour above." />
          )}
          {workspace.reviewer ? (
            <p className="specimen-account-note" data-permission-reviewer={workspace.reviewer.state}>
              {workspace.reviewer.label}
            </p>
          ) : null}
        </section>
      ))}
      {view?.userRules ? (
        <section aria-label="Your command rules" data-user-rules={String(view.userRules.revision)}>
          <h4 className="specimen-policy-heading">Your rules</h4>
          <p className="specimen-account-note">Your own rules only make things stricter: a rule asks you first or forbids a command. Where a rule of yours and a Workspace rule both match, the stricter one decides.</p>
          <RuleList rules={own} empty="You have no rules of your own." onRemove={remove} />
          <form className="specimen-account-form" onSubmit={add} data-user-rule-form>
            <TextField label="Command words the rule starts with" instruction="For example: git push" value={prefix} onChange={setPrefix} />
            <SegmentedControl
              label="What the rule does"
              options={[
                { value: 'prompt', label: 'Ask me first' },
                { value: 'forbid', label: 'Forbid' },
              ]}
              value={decision}
              onChange={(value) => setDecision(value === 'forbid' ? 'forbid' : 'prompt')}
            />
            <Button type="submit" pending={busy} data-action="add-user-rule">
              Add your rule
            </Button>
          </form>
        </section>
      ) : null}
    </section>
  );
}
