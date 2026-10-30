//! The Workspace execution policy: the optional `execution` section of the
//! Story 1.11 Workspace policy document (Story 1.18).

use crate::authorization::PolicyError;
use crate::authorization::check_keys;
use crate::execution_policy::command_rules::CommandRule;
use crate::execution_policy::command_rules::MAX_COMMAND_RULES;
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
    /// The network destinations a Task's tools may contact (Story 1.19): host
    /// or wildcard patterns (`example.com`, `*.example.com`,
    /// `**.example.com`), lowercase, with no scheme, port or path. Absent or
    /// empty means no network destination.
    pub allowed_domains: Option<Vec<String>>,
    /// Command rules on command prefixes (Story 1.20): allow, prompt or
    /// forbid. Matched with the runtime's own exec-policy prefix matching.
    pub command_rules: Option<Vec<CommandRule>>,
    /// Whether the inherited automatic permission reviewer may decide
    /// permission requests (Story 1.20). Absent means off. It becomes usable
    /// only once a processing route exists.
    pub automatic_permission_review: Option<bool>,
    /// Whether people may add local (stdio) MCP servers (Story 1.21). A local
    /// server runs a program on the device outside the Task sandbox, so it
    /// needs `mcp_tools` allowed. Absent means not allowed.
    pub allow_local_mcp_servers: Option<bool>,
}

/// The most patterns `allowed_domains` may list.
pub const MAX_ALLOWED_DOMAINS: usize = 100;

const FIELDS: [&str; 11] = [
    "sandbox",
    "approvals",
    "network",
    "mcp_tools",
    "extensions",
    "allow_full_access",
    "allow_no_prompt",
    "allowed_domains",
    "command_rules",
    "automatic_permission_review",
    "allow_local_mcp_servers",
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

/// Validates one `allowed_domains` pattern: a host name, or a host name after
/// `*.` (subdomains only) or `**.` (the domain and its subdomains). Labels are
/// 1 to 63 lowercase letters, digits or hyphens, not starting or ending with a
/// hyphen. A scheme, port, path, user, query or the bare `*` is refused.
fn domain_pattern(raw: &str) -> Result<String, PolicyError> {
    let refuse = |why: &str| invalid(format!("allowed domain `{raw}` {why}"));
    if raw.is_empty() {
        return Err(invalid("an allowed domain must not be empty"));
    }
    if raw.len() > 253 {
        return Err(refuse("is longer than 253 characters"));
    }
    if raw.contains("://") {
        return Err(refuse("must not include a scheme"));
    }
    if raw.contains('/') {
        return Err(refuse("must not include a path"));
    }
    if raw.contains(':') {
        return Err(refuse("must not include a port"));
    }
    if raw.contains(['@', '?', '#']) || raw.chars().any(char::is_whitespace) {
        return Err(refuse("must be a host name only"));
    }
    let host = raw
        .strip_prefix("**.")
        .or_else(|| raw.strip_prefix("*."))
        .unwrap_or(raw);
    let wildcard = host.len() != raw.len();
    let labels: Vec<&str> = host.split('.').collect();
    if wildcard && labels.len() < 2 {
        return Err(refuse(
            "must name a domain of at least two labels after the wildcard",
        ));
    }
    for label in &labels {
        let valid = !label.is_empty()
            && label.len() <= 63
            && !label.starts_with('-')
            && !label.ends_with('-')
            && label
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
        if !valid {
            return Err(refuse(
                "must be a lowercase host name, optionally after `*.` or `**.`",
            ));
        }
    }
    Ok(raw.to_string())
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
            allowed_domains: match object.get("allowed_domains") {
                None => None,
                Some(raw) => {
                    let raw = raw
                        .as_array()
                        .ok_or_else(|| invalid("`allowed_domains` must be an array"))?;
                    if raw.len() > MAX_ALLOWED_DOMAINS {
                        return Err(invalid(format!(
                            "`allowed_domains` may list at most {MAX_ALLOWED_DOMAINS} patterns"
                        )));
                    }
                    let mut domains = Vec::with_capacity(raw.len());
                    for entry in raw {
                        let pattern = entry
                            .as_str()
                            .ok_or_else(|| invalid("each allowed domain must be a string"))?;
                        let pattern = domain_pattern(pattern)?;
                        if domains.contains(&pattern) {
                            return Err(invalid(format!(
                                "allowed domain `{pattern}` is listed more than once"
                            )));
                        }
                        domains.push(pattern);
                    }
                    Some(domains)
                }
            },
            command_rules: match object.get("command_rules") {
                None => None,
                Some(raw) => {
                    let raw = raw
                        .as_array()
                        .ok_or_else(|| invalid("`command_rules` must be an array"))?;
                    if raw.len() > MAX_COMMAND_RULES {
                        return Err(invalid(format!(
                            "`command_rules` may list at most {MAX_COMMAND_RULES} rules"
                        )));
                    }
                    let mut rules: Vec<CommandRule> = Vec::with_capacity(raw.len());
                    for (index, entry) in raw.iter().enumerate() {
                        let rule = CommandRule::from_value(entry)
                            .map_err(|why| invalid(format!("command rule {index}: {why}")))?;
                        if rules.iter().any(|known| known.prefix == rule.prefix) {
                            return Err(invalid(format!(
                                "command rule {index}: the prefix is listed more than once"
                            )));
                        }
                        rules.push(rule);
                    }
                    Some(rules)
                }
            },
            automatic_permission_review: flag(object, "automatic_permission_review")?,
            allow_local_mcp_servers: flag(object, "allow_local_mcp_servers")?,
        };
        if policy.allow_local_mcp_servers == Some(true) && policy.mcp_tools != Some(true) {
            return Err(invalid(
                "`allow_local_mcp_servers` needs `mcp_tools` allowed: a local MCP server provides MCP tools",
            ));
        }
        if policy
            .allowed_domains
            .as_ref()
            .is_some_and(|domains| !domains.is_empty())
            && policy.network != Some(true)
        {
            return Err(invalid(
                "`allowed_domains` needs `network` allowed: listed destinations are reached through the network",
            ));
        }
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
        if let Some(domains) = &self.allowed_domains {
            object.insert(
                "allowed_domains".to_string(),
                Value::Array(domains.iter().cloned().map(Value::String).collect()),
            );
        }
        if let Some(rules) = &self.command_rules {
            object.insert(
                "command_rules".to_string(),
                Value::Array(rules.iter().map(CommandRule::to_value).collect()),
            );
        }
        if let Some(value) = self.automatic_permission_review {
            object.insert(
                "automatic_permission_review".to_string(),
                Value::Bool(value),
            );
        }
        if let Some(value) = self.allow_local_mcp_servers {
            object.insert("allow_local_mcp_servers".to_string(), Value::Bool(value));
        }
        Value::Object(object)
    }

    /// The Workspace command rules; empty when none are listed.
    pub fn command_rules(&self) -> &[CommandRule] {
        self.command_rules.as_deref().unwrap_or_default()
    }

    /// Whether local (stdio) MCP servers may be added; false when absent.
    pub fn local_mcp_servers_allowed(&self) -> bool {
        self.allow_local_mcp_servers == Some(true)
    }

    /// The listed destinations; empty when none are listed.
    pub fn allowed_domains(&self) -> &[String] {
        self.allowed_domains.as_deref().unwrap_or_default()
    }
}
