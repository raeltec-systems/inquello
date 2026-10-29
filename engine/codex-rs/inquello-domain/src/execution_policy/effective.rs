//! The effective execution policy of a Task on this device (Story 1.18): the
//! Workspace execution policy, the device-managed requirements and the user's
//! own configuration, combined so that the most restrictive value wins and
//! every setting names the rule that governs it.

use crate::execution_policy::section::ApprovalBehaviour;
use crate::execution_policy::section::ExecutionPolicy;
use crate::execution_policy::section::SandboxLevel;
use crate::model::Revision;
use crate::organise::WorkspaceId;
use std::collections::BTreeSet;
use std::fmt;

/// Where an effective value comes from.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum SettingSource {
    /// The Workspace execution policy at this policy revision.
    WorkspacePolicy { revision: Revision },
    /// This device's managed Codex requirements (`configRequirements/read`).
    DeviceRequirements,
    /// The user's own runtime configuration.
    UserConfig,
    /// The conservative Inquello default (no Workspace rule names the setting).
    InquelloDefault,
}

impl SettingSource {
    /// The wire kind: `workspace_policy`, `device_requirements`, `user_config`
    /// or `inquello_default`.
    pub const fn kind(self) -> &'static str {
        match self {
            SettingSource::WorkspacePolicy { .. } => "workspace_policy",
            SettingSource::DeviceRequirements => "device_requirements",
            SettingSource::UserConfig => "user_config",
            SettingSource::InquelloDefault => "inquello_default",
        }
    }

    /// The Workspace policy revision, for a Workspace rule.
    pub const fn revision(self) -> Option<Revision> {
        match self {
            SettingSource::WorkspacePolicy { revision } => Some(revision),
            _ => None,
        }
    }
}

impl fmt::Display for SettingSource {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SettingSource::WorkspacePolicy { revision } => {
                write!(f, "Workspace policy, revision {revision}")
            }
            SettingSource::DeviceRequirements => f.write_str("this device's managed requirements"),
            SettingSource::UserConfig => f.write_str("your runtime configuration"),
            SettingSource::InquelloDefault => f.write_str("the Inquello default"),
        }
    }
}

/// One effective setting: its value, the rule that governs it, and whether a
/// rule narrows it below its most permissive value.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Setting<T> {
    pub value: T,
    pub source: SettingSource,
    pub restricted: bool,
}

/// The execution environment. V1 runs Tasks on the local device only (OQ-13).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Environment {
    LocalDevice,
}

impl Environment {
    pub const fn as_str(self) -> &'static str {
        match self {
            Environment::LocalDevice => "local_device",
        }
    }
}

/// The Workspace layer, as the shared service reported it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WorkspaceLayer {
    pub workspace_id: WorkspaceId,
    pub policy_revision: Revision,
    pub authorization_epoch: Revision,
    /// `None` when the policy has no `execution` section.
    pub execution: Option<ExecutionPolicy>,
}

/// The device layer: the managed requirements `configRequirements/read`
/// reports. `None` for a list means it is not configured.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct DeviceRequirements {
    pub sandbox_modes: Option<BTreeSet<SandboxLevel>>,
    pub approvals: Option<BTreeSet<ApprovalBehaviour>>,
}

impl DeviceRequirements {
    /// Whether the device has any requirement this policy reads.
    pub fn configured(&self) -> bool {
        self.sandbox_modes.is_some() || self.approvals.is_some()
    }
}

/// The user layer: the user's own runtime configuration. `None` means unset.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct UserConfig {
    pub sandbox: Option<SandboxLevel>,
    pub approval: Option<ApprovalBehaviour>,
    pub network: Option<bool>,
}

/// The effective policy for one Task (or Workspace) on this device.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EffectivePolicy {
    pub environment: Environment,
    pub workspace_id: WorkspaceId,
    pub policy_revision: Revision,
    pub authorization_epoch: Revision,
    pub device_configured: bool,
    /// The sandbox ceiling. Standard Tasks never run above `workspace_write`.
    pub sandbox: Setting<SandboxLevel>,
    /// The approval behaviour of a standard Task.
    pub approval: Setting<ApprovalBehaviour>,
    pub network: Setting<bool>,
    pub mcp_tools: Setting<bool>,
    pub extensions: Setting<bool>,
    /// Whether a Task may use the full-access broad mode.
    pub full_access: Setting<bool>,
    /// Whether a Task may use the no-prompt broad mode.
    pub no_prompt: Setting<bool>,
}

/// The most restrictive candidate wins; on a tie the earlier layer is named.
fn strictest<T: Ord + Copy>(candidates: &[(T, SettingSource)]) -> (T, SettingSource) {
    let mut best = candidates[0];
    for candidate in &candidates[1..] {
        if candidate.0 < best.0 {
            best = *candidate;
        }
    }
    best
}

/// The approval a standard Task uses from an allowed set: `on_request` when
/// allowed, otherwise `untrusted`, the strictest prompting behaviour.
fn standard_approval(allowed: &BTreeSet<ApprovalBehaviour>) -> ApprovalBehaviour {
    if allowed.contains(&ApprovalBehaviour::OnRequest) {
        ApprovalBehaviour::OnRequest
    } else {
        ApprovalBehaviour::Untrusted
    }
}

/// Combines the three layers. Pure: no I/O and no clock.
///
/// - Sandbox ceiling, network: the strictest of the Workspace (or default),
///   device and user values.
/// - Approval: the allowed set is the Workspace set intersected with the
///   device set; a standard Task uses `on_request` if allowed, else
///   `untrusted`; a user configuration of `untrusted` is stricter still.
/// - MCP tools and extensions: the Workspace policy or the default (deny).
/// - Broad modes: permitted only when the Workspace policy allows them and the
///   device requirements (when configured) allow the sandbox mode and the
///   no-prompt approval they need. The user's own configuration does not
///   forbid them: a broad mode is that user's explicit per-Task choice.
pub fn effective_policy(
    workspace: &WorkspaceLayer,
    device: &DeviceRequirements,
    user: &UserConfig,
) -> EffectivePolicy {
    let rule = SettingSource::WorkspacePolicy {
        revision: workspace.policy_revision,
    };
    let execution = workspace.execution.clone().unwrap_or_default();
    let from_workspace = |present: bool| {
        if present && workspace.execution.is_some() {
            rule
        } else {
            SettingSource::InquelloDefault
        }
    };

    // Sandbox ceiling.
    let mut candidates = vec![(
        execution.sandbox.unwrap_or(SandboxLevel::WorkspaceWrite),
        from_workspace(execution.sandbox.is_some()),
    )];
    if let Some(modes) = &device.sandbox_modes {
        let ceiling = modes
            .iter()
            .max()
            .copied()
            .unwrap_or(SandboxLevel::ReadOnly);
        candidates.push((ceiling, SettingSource::DeviceRequirements));
    }
    if let Some(level) = user.sandbox {
        candidates.push((level, SettingSource::UserConfig));
    }
    let (sandbox, sandbox_source) = strictest(&candidates);

    // Approval.
    let workspace_approvals = execution.approvals();
    let mut approval_source = from_workspace(execution.approvals.is_some());
    let mut approval = standard_approval(&workspace_approvals);
    let mut allowed = workspace_approvals;
    if let Some(device_approvals) = &device.approvals {
        allowed = allowed.intersection(device_approvals).copied().collect();
        let narrowed = standard_approval(&allowed);
        if narrowed != approval || !allowed.contains(&narrowed) {
            // With no prompting behaviour left, `untrusted` (the strictest)
            // applies: a standard Task never runs without asking.
            approval = narrowed;
            approval_source = SettingSource::DeviceRequirements;
        }
    }
    if user.approval == Some(ApprovalBehaviour::Untrusted)
        && approval > ApprovalBehaviour::Untrusted
    {
        approval = ApprovalBehaviour::Untrusted;
        approval_source = SettingSource::UserConfig;
    }

    // Network.
    let mut candidates = vec![(
        execution.network.unwrap_or(false),
        from_workspace(execution.network.is_some()),
    )];
    if let Some(network) = user.network {
        candidates.push((network, SettingSource::UserConfig));
    }
    let (network, network_source) = strictest(&candidates);

    let toggle = |value: Option<bool>| {
        let allowed = value.unwrap_or(false);
        Setting {
            value: allowed,
            source: from_workspace(value.is_some()),
            restricted: !allowed,
        }
    };

    // Broad modes: the Workspace rule first, then the device requirements.
    let device_allows_never = device
        .approvals
        .as_ref()
        .is_none_or(|approvals| approvals.contains(&ApprovalBehaviour::Never));
    let device_allows_full = device
        .sandbox_modes
        .as_ref()
        .is_none_or(|modes| modes.contains(&SandboxLevel::FullAccess));
    let broad = |workspace_allows: Option<bool>, device_allows: bool| {
        let (value, source) = if workspace_allows != Some(true) {
            (false, from_workspace(workspace_allows.is_some()))
        } else if !device_allows {
            (false, SettingSource::DeviceRequirements)
        } else {
            (true, rule)
        };
        Setting {
            value,
            source,
            restricted: !value,
        }
    };

    EffectivePolicy {
        environment: Environment::LocalDevice,
        workspace_id: workspace.workspace_id,
        policy_revision: workspace.policy_revision,
        authorization_epoch: workspace.authorization_epoch,
        device_configured: device.configured(),
        sandbox: Setting {
            value: sandbox,
            source: sandbox_source,
            restricted: sandbox < SandboxLevel::FullAccess,
        },
        approval: Setting {
            value: approval,
            source: approval_source,
            restricted: approval == ApprovalBehaviour::Untrusted,
        },
        network: Setting {
            value: network,
            source: network_source,
            restricted: !network,
        },
        mcp_tools: toggle(execution.mcp_tools),
        extensions: toggle(execution.extensions),
        full_access: broad(
            execution.allow_full_access,
            device_allows_full && device_allows_never,
        ),
        no_prompt: broad(execution.allow_no_prompt, device_allows_never),
    }
}
