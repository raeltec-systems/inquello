/**
 * S07, "Capabilities and processing" in Settings (Story 1.18).
 *
 * - For each of the signed-in person's Workspaces: the effective value of
 *   every execution setting on this device and, in plain words, the rule that
 *   governs it ("Restricted by Workspace policy, revision 4", "Set by this
 *   device's managed requirements", "Inquello default"), plus the
 *   device-managed requirements ("None configured on this device" when none).
 * - The environment is always the local device in V1.
 * - The Capability Contract: prompt inspection and specialist cyber access
 *   are listed as not enabled until their eligibility is verified.
 *
 * Read-only. Talks to main only through `inquello.policy.getSettings`; every
 * text comes from main. Values render through StatusChip's custom label path,
 * so nothing here is ever green or reads as approved.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { parseSettingsPolicy, policyBridge, type CapabilityItem, type PolicyItem, type SettingsPolicyItem } from './policy-bridge';
import { StatusChip } from './primitives';

const REFRESH_MS = 30_000;

const FALLBACK_CAPABILITIES: readonly CapabilityItem[] = [
  { id: 'prompt_inspection', label: 'Prompt inspection', statusLabel: 'Not enabled — eligibility verification required' },
  { id: 'specialist_cyber_access', label: 'Specialist cyber access', statusLabel: 'Not enabled — eligibility verification required' },
];

export function PolicySettings({ policy }: { policy: PolicyItem }): ReactElement {
  return (
    <>
      <dl className="specimen-policy-settings">
        {policy.settings.map((setting) => (
          <div key={setting.name} className="specimen-policy-setting" data-policy-setting={setting.name} data-restricted={String(setting.restricted)}>
            <dt>{setting.label}</dt>
            <dd>
              <StatusChip status={`policy:${setting.name}`} label={setting.valueLabel} />
              <span className="specimen-policy-source" data-policy-source>
                {setting.sourceLabel}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="specimen-account-note" data-policy-device>
        {`Device-managed requirements: ${policy.deviceLabel}`}
      </p>
    </>
  );
}

export function CapabilityContract({ capabilities }: { capabilities: readonly CapabilityItem[] }): ReactElement {
  return (
    <section className="specimen-policy-contract" aria-labelledby="specimen-policy-contract-heading" data-capability-contract>
      <h3 id="specimen-policy-contract-heading" className="specimen-policy-heading">
        Capability Contract
      </h3>
      <ul className="specimen-policy-capabilities">
        {capabilities.map((capability) => (
          <li key={capability.id} data-capability={capability.id} data-enabled="false">
            <span className="specimen-policy-capability">{capability.label}</span>
            <StatusChip status={`capability:${capability.id}`} label={capability.statusLabel} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Capabilities(): ReactElement {
  const bridge = policyBridge();
  const [view, setView] = useState<SettingsPolicyItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!bridge) return;
    try {
      const next = parseSettingsPolicy(await bridge.getSettings());
      if (next) {
        setView(next);
        setNotice(null);
      } else setNotice('The policy could not be read.');
    } catch {
      setNotice('The policy could not be read.');
    }
  }, [bridge]);

  useEffect(() => {
    if (!bridge) return;
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [bridge, load]);

  const capabilities = view?.capabilities ?? FALLBACK_CAPABILITIES;
  return (
    <div className="specimen-policy" data-policy-section="" data-policy-loaded={view ? 'true' : 'false'} data-signed-in={view ? String(view.signedIn) : 'unknown'}>
      <p className="specimen-account-note" data-policy-environment>
        {`Environment: ${view?.environmentLabel ?? 'Local device'}. Tasks run on this device only.`}
      </p>
      {!bridge ? <p className="specimen-account-note">The effective policy is shown in the desktop app only.</p> : null}
      {notice ? (
        <p className="specimen-account-note" role="status">
          {notice}
        </p>
      ) : null}
      {view?.reason ? (
        <p className="specimen-account-note" data-policy-reason>
          {view.reason}
        </p>
      ) : null}
      {(view?.workspaces ?? []).map((workspace) => (
        <section key={workspace.workspaceId} className="specimen-policy-workspace" aria-label={`Policy for ${workspace.name}`} data-policy-workspace={workspace.workspaceId}>
          <h3 className="specimen-policy-heading">{workspace.name}</h3>
          {workspace.policy ? (
            <PolicySettings policy={workspace.policy} />
          ) : (
            <p className="specimen-account-note" data-policy-reason>
              {workspace.reason ?? 'The policy could not be read.'}
            </p>
          )}
        </section>
      ))}
      <CapabilityContract capabilities={capabilities} />
    </div>
  );
}
