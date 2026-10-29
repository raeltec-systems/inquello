//! The Workspace execution policy: the optional `execution` section of the
//! Story 1.11 Workspace policy document (Story 1.18).

use crate::authorization::PolicyError;
use crate::authorization::check_keys;
use serde_json::Map;
use serde_json::Value;
use std::collections::BTreeSet;

/// A sandbox level, ordered from most to least restrictive.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum SandboxLevel {
    ReadOnly,
    WorkspaceWrite,
    FullAccess,
}

impl SandboxLevel {
    pub const ALL: [SandboxLevel; 3] = [
        SandboxLevel::ReadOnly,
        SandboxLevel::WorkspaceWrite,
        SandboxLevel::FullAccess,
    ];

    pub const fn as_str(self) -> &'static str {
        match self {
            SandboxLevel::ReadOnly => "read_only",
            SandboxLevel::WorkspaceWrite => "workspace_write",
            SandboxLevel::FullAccess => "full_access",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|level| level.as_str() == value)
    }
}

/// An approval behaviour, ordered from most to least restrictive: `untrusted`
/// asks before anything not known to be safe, `on_request` asks when the agent
/// requests it, and `never` (no-prompt) never asks.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum ApprovalBehaviour {
    Untrusted,
    OnRequest,
    Never,
}

impl ApprovalBehaviour {
    pub const ALL: [ApprovalBehaviour; 3] = [
        ApprovalBehaviour::Untrusted,
        ApprovalBehaviour::OnRequest,
        ApprovalBehaviour::Never,
    ];

    pub const fn as_str(self) -> &'static str {
        match self {
            ApprovalBehaviour::Untrusted => "untrusted",
            ApprovalBehaviour::OnRequest => "on_request",
            ApprovalBehaviour::Never => "never",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        Self::ALL
            .into_iter()
            .find(|behaviour| behaviour.as_str() == value)
    }

    /// Whether this behaviour asks before actions at all.
    pub const fn prompts(self) -> bool {
        !matches!(self, ApprovalBehaviour::Never)
    }
}

/// The approval behaviours allowed when a policy names none.
pub const DEFAULT_APPROVALS: [ApprovalBehaviour; 2] =
    [ApprovalBehaviour::Untrusted, ApprovalBehaviour::OnRequest];

/// The validated `execution` section. Every field is optional: an absent field
/// takes the conservative Inquello default (`workspace_write`, on-request
/// approval, network denied, tools and extensions denied, no broad modes) and
/// is attributed to that default rather than to the Workspace policy.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ExecutionPolicy {
    /// The sandbox ceiling.
    pub sandbox: Option<SandboxLevel>,
    /// The allowed approval behaviours; `never` means no-prompt.
    pub approvals: Option<BTreeSet<ApprovalBehaviour>>,
    /// Network access in the sandbox.
    pub network: Option<bool>,
    /// MCP and connector tools.
    pub mcp_tools: Option<bool>,
    /// Plugins and extensions.
    pub extensions: Option<bool>,
    /// Whether a Task may use the full-access broad mode.
    pub allow_full_access: Option<bool>,
    /// Whether a Task may use the no-prompt broad mode.
    pub allow_no_prompt: Option<bool>,
}

const FIELDS: [&str; 7] = [
    "sandbox",
    "approvals",
    "network",
    "mcp_tools",
    "extensions",
    "allow_full_access",
    "allow_no_prompt",
];

const AT: &str = "the execution policy";

fn invalid(message: impl Into<String>) -> PolicyError {
    PolicyError::InvalidExecution(message.into())
}

/// `"allowed"` or `"denied"`.
fn toggle(object: &Map<String, Value>, key: &str) -> Result<Option<bool>, PolicyError> {
    match object.get(key) {
        None => Ok(None),
        Some(Value::String(value)) if value == "allowed" => Ok(Some(true)),
        Some(Value::String(value)) if value == "denied" => Ok(Some(false)),
        Some(_) => Err(invalid(format!(
            "`{key}` must be \"allowed\" or \"denied\""
        ))),
    }
}

fn flag(object: &Map<String, Value>, key: &str) -> Result<Option<bool>, PolicyError> {
    match object.get(key) {
        None => Ok(None),
        Some(Value::Bool(value)) => Ok(Some(*value)),
        Some(_) => Err(invalid(format!("`{key}` must be true or false"))),
    }
}

fn toggle_value(value: bool) -> Value {
    Value::String(if value { "allowed" } else { "denied" }.to_string())
}

impl ExecutionPolicy {
    /// Validates an `execution` section. Unknown fields are refused, and an
    /// external-audit attribute is refused as `route_not_available` (OQ-15).
    pub fn from_value(value: &Value) -> Result<Self, PolicyError> {
        let object = value
            .as_object()
            .ok_or_else(|| invalid("`execution` must be an object"))?;
        check_keys(object, &FIELDS, AT)?;
        let sandbox = match object.get("sandbox") {
            None => None,
            Some(raw) => Some(raw.as_str().and_then(SandboxLevel::parse).ok_or_else(|| {
                invalid("`sandbox` must be \"read_only\", \"workspace_write\" or \"full_access\"")
            })?),
        };
        let approvals = match object.get("approvals") {
            None => None,
            Some(raw) => {
                let raw = raw
                    .as_array()
                    .ok_or_else(|| invalid("`approvals` must be an array"))?;
                let mut approvals = BTreeSet::new();
                for entry in raw {
                    let behaviour = entry
                        .as_str()
                        .and_then(ApprovalBehaviour::parse)
                        .ok_or_else(|| {
                            invalid(
                                "each approval must be \"on_request\", \"untrusted\" or \"never\"",
                            )
                        })?;
                    if !approvals.insert(behaviour) {
                        return Err(invalid(format!(
                            "approval `{}` is listed more than once",
                            behaviour.as_str()
                        )));
                    }
                }
                if !approvals.iter().any(|behaviour| behaviour.prompts()) {
                    return Err(invalid(
                        "`approvals` must allow `on_request` or `untrusted`, so standard Tasks ask before actions",
                    ));
                }
                Some(approvals)
            }
        };
        let policy = Self {
            sandbox,
            approvals,
            network: toggle(object, "network")?,
            mcp_tools: toggle(object, "mcp_tools")?,
            extensions: toggle(object, "extensions")?,
            allow_full_access: flag(object, "allow_full_access")?,
            allow_no_prompt: flag(object, "allow_no_prompt")?,
        };
        if policy.allow_no_prompt == Some(true)
            && !policy.approvals().contains(&ApprovalBehaviour::Never)
        {
            return Err(invalid(
                "`allow_no_prompt` needs `never` among the allowed approvals",
            ));
        }
        if policy.allow_full_access == Some(true) {
            if policy.sandbox != Some(SandboxLevel::FullAccess) {
                return Err(invalid(
                    "`allow_full_access` needs the `full_access` sandbox ceiling",
                ));
            }
            if policy.allow_no_prompt != Some(true) {
                return Err(invalid(
                    "`allow_full_access` needs `allow_no_prompt`: full access never asks before actions",
                ));
            }
            if policy.network != Some(true) {
                return Err(invalid(
                    "`allow_full_access` needs `network` allowed: full access has no sandbox network limit",
                ));
            }
        }
        Ok(policy)
    }

    /// The allowed approval behaviours, with the default when none are named.
    pub fn approvals(&self) -> BTreeSet<ApprovalBehaviour> {
        self.approvals
            .clone()
            .unwrap_or_else(|| DEFAULT_APPROVALS.into_iter().collect())
    }

    /// The canonical section: only the fields the document names.
    pub fn to_value(&self) -> Value {
        let mut object = Map::new();
        if let Some(sandbox) = self.sandbox {
            object.insert(
                "sandbox".to_string(),
                Value::String(sandbox.as_str().to_string()),
            );
        }
        if let Some(approvals) = &self.approvals {
            object.insert(
                "approvals".to_string(),
                Value::Array(
                    approvals
                        .iter()
                        .map(|behaviour| Value::String(behaviour.as_str().to_string()))
                        .collect(),
                ),
            );
        }
        for (key, value) in [
            ("network", self.network),
            ("mcp_tools", self.mcp_tools),
            ("extensions", self.extensions),
        ] {
            if let Some(value) = value {
                object.insert(key.to_string(), toggle_value(value));
            }
        }
        for (key, value) in [
            ("allow_full_access", self.allow_full_access),
            ("allow_no_prompt", self.allow_no_prompt),
        ] {
            if let Some(value) = value {
                object.insert(key.to_string(), Value::Bool(value));
            }
        }
        Value::Object(object)
    }
}
