import { ProcessingRoutes } from './ProcessingRoutes';
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
 *   are listed as not enabled until their eligibility is verified, and the
 *   execution sandbox is the local OS sandbox on this device with no hosted
 *   sandbox (Story 1.19, OQ-13).
 * - What a Task's tools can reach in each Workspace (Story 1.19): read,
 *   write and contact, in plain words.
 *
 * Read-only. Talks to main only through `inquello.policy.getSettings`; every
 * text comes from main. Values render through StatusChip's custom label path,
 * so nothing here is ever green or reads as approved.
 */
import { useEffect, useState, type ReactElement } from 'react';

import { parseSettingsPolicy, policyBridge, type CapabilityItem, type PolicyItem, type SettingsPolicyItem } from './policy-bridge';
import { StatusChip } from './primitives';
import { CapabilityInventory } from './CapabilityInventory';
import { ReachList } from './Shell/TaskPolicy';

const REFRESH_MS = 30_000;

const FALLBACK_CAPABILITIES: readonly CapabilityItem[] = [
  { id: 'prompt_inspection', label: 'Prompt inspection', statusLabel: 'Not enabled — eligibility verification required', enabled: false },
  { id: 'specialist_cyber_access', label: 'Specialist cyber access', statusLabel: 'Not enabled — eligibility verification required', enabled: false },
  { id: 'execution_sandbox', label: 'Execution sandbox', statusLabel: 'Local OS sandbox on this device; no hosted sandbox — V2 revisit (OQ-13)', enabled: true },
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
      <h4 className="specimen-policy-heading">What a Task's tools can reach</h4>
      <ReachList reach={policy.reach} scope="workspace" />
    </>
  );
}

export function CapabilityContract({ capabilities }: { capabilities: readonly CapabilityItem[] }): ReactElement {
  return (
    <section className="specimen-policy-contract" aria-labelledby="specimen-policy-contract-heading" data-capability-contract>
      <p>Real-data use needs exact-build reviewed authorization evidence and independent current organization approval. Provider credentials and local action permission do not replace either requirement.</p>
      <h3 id="specimen-policy-contract-heading" className="specimen-policy-heading">
        Capability Contract
      </h3>
      <ul className="specimen-policy-capabilities">
        {capabilities.map((capability) => (
          <li key={capability.id} data-capability={capability.id} data-enabled={String(capability.enabled)}>
            <span className="specimen-policy-capability">{capability.label}</span>
            <StatusChip status={`capability:${capability.id}`} label={capability.statusLabel} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Capabilities({ workspaceId, showProcessingRoutes = true }: { workspaceId?: string | null; showProcessingRoutes?: boolean } = {}): ReactElement {
  const bridge = policyBridge();
  const [view, setView] = useState<SettingsPolicyItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bridge) return;
    let active = true, generation = 0, settled = true;
    const load = async () => {
      if (!active || !settled) return;
      const request = ++generation;
      try {
        const next = parseSettingsPolicy(await bridge.getSettings());
        if (!active || request !== generation || !settled) return;
        setView(next); setLoading(false);
        setNotice(next ? null : 'The policy could not be read.');
      } catch {
        if (active && request === generation) { setView(null); setLoading(false); setNotice('The policy could not be read.'); }
      }
    };
    const changed = (ready: boolean) => {
      if (!active) return;
      ++generation;
      settled = ready; setLoading(ready);
      // Remove prior-principal policy and capability children before any new read.
      setView(null);
      setNotice(ready ? null : 'Account or runtime is changing. Current policy is unavailable.');
      if (ready) void load();
    };
    const unsubscribe = bridge.onSettingsChanged?.(changed);
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => { active = false; ++generation; clearInterval(timer); unsubscribe?.(); };
  }, [bridge]);

  const capabilities = view?.capabilities ?? FALLBACK_CAPABILITIES;
  // Ordinary Settings is scoped to the selected Workspace; the specimen may show all.
  const workspaces = (view?.workspaces ?? []).filter(workspace => workspaceId === undefined || workspace.workspaceId === workspaceId);
  if (workspaceId !== undefined) return <>
    {notice ? <p role="status">{notice}</p> : null}
    {view?.reason ? <p role="status">{view.reason}</p> : null}
    {!bridge ? <p role="status">Tools and connections are available in the desktop app only.</p> : !workspaceId ? <p role="status">Select a Workspace in chat to manage its tools and connections.</p> : loading ? <p role="status">Loading tools and connections for the selected Workspace.</p> : view && !workspaces.length ? <p role="status">The selected Workspace is unavailable. Return to chat and select an accessible Workspace.</p> : null}
    {workspaces.map(workspace => <section key={workspace.workspaceId} aria-label={`Tools settings for ${workspace.name}`}>
      <p>Workspace: <strong>{workspace.name}</strong></p>
      <CapabilityInventory workspaceId={workspace.workspaceId} workspaceName={workspace.name} />
      <details><summary>Workspace policy and capability limits</summary>
        {workspace.policy ? <PolicySettings policy={workspace.policy} /> : <p>{workspace.reason ?? 'The policy could not be read.'}</p>}
        <CapabilityContract capabilities={capabilities} />
      </details>
    </section>)}
  </>;
  return (
    <><div className="specimen-policy" data-policy-section="" data-policy-loaded={view ? 'true' : 'false'} data-signed-in={view ? String(view.signedIn) : 'unknown'}>
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
      {workspaces.map((workspace) => (
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
    {showProcessingRoutes ? <ProcessingRoutes /> : null}
    {workspaces.map(workspace => <CapabilityInventory key={workspace.workspaceId} workspaceId={workspace.workspaceId} workspaceName={workspace.name} />)}
    </>
  );
}
