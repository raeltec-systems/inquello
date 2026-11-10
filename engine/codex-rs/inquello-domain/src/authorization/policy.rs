//! Workspace kinds, actions, role kinds and the versioned role policy.

use crate::execution_policy::ExecutionPolicy;
use serde_json::Map;
use serde_json::Value;
use std::collections::BTreeSet;
use std::fmt;

/// The policy document format this domain reads and writes (`policy_version`).
pub const POLICY_FORMAT_VERSION: u64 = 1;

/// The longest role ID, in bytes.
pub const ROLE_ID_MAX_BYTES: usize = 64;

/// The longest role label, in characters.
pub const ROLE_LABEL_MAX_CHARS: usize = 120;

/// The most roles one policy may define.
const MAX_ROLES: usize = 64;

/// The kind of a Workspace. Only `internal_company` is enabled; `external_audit`
/// exists so it can be refused explicitly as `route_not_available` (OQ-15).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum WorkspaceKind {
    InternalCompany,
    ExternalAudit,
}

impl WorkspaceKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            WorkspaceKind::InternalCompany => "internal_company",
            WorkspaceKind::ExternalAudit => "external_audit",
        }
    }

    /// Parses a stored or requested kind; anything unknown is `None` (fail closed).
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "internal_company" => Some(WorkspaceKind::InternalCompany),
            "external_audit" => Some(WorkspaceKind::ExternalAudit),
            _ => None,
        }
    }

    /// Whether this kind's routes are enabled. Only `internal_company` is.
    pub const fn is_enabled(self) -> bool {
        matches!(self, WorkspaceKind::InternalCompany)
    }
}

/// The candidate actions of SC-3 plus the separate administrative action.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Action {
    Read,
    Derive,
    Comment,
    SubmitReview,
    IssueNotes,
    Share,
    Export,
    /// Administrative: issue and revoke invites, change roles, remove members and
    /// manage Engagements. Never a content action, so it reaches no resource.
    ManageMembership,
}

impl Action {
    pub const ALL: [Action; 8] = [
        Action::Read,
        Action::Derive,
        Action::Comment,
        Action::SubmitReview,
        Action::IssueNotes,
        Action::Share,
        Action::Export,
        Action::ManageMembership,
    ];

    pub const fn as_str(self) -> &'static str {
        match self {
            Action::Read => "read",
            Action::Derive => "derive",
            Action::Comment => "comment",
            Action::SubmitReview => "submit_review",
            Action::IssueNotes => "issue_notes",
            Action::Share => "share",
            Action::Export => "export",
            Action::ManageMembership => "manage_membership",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        Action::ALL
            .into_iter()
            .find(|action| action.as_str() == value)
    }

    /// Whether this is the administrative action rather than a content action.
    pub const fn is_administrative(self) -> bool {
        matches!(self, Action::ManageMembership)
    }
}

impl fmt::Display for Action {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// The only role kinds a policy may use. There is no guest kind.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum RoleKind {
    AuditTeam,
    Reviewer,
}

impl RoleKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            RoleKind::AuditTeam => "audit_team",
            RoleKind::Reviewer => "reviewer",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "audit_team" => Some(RoleKind::AuditTeam),
            "reviewer" => Some(RoleKind::Reviewer),
            _ => None,
        }
    }
}

/// A role's ID within its policy: 1 to [`ROLE_ID_MAX_BYTES`] of lowercase ASCII
/// letters, digits and `_`, starting with a letter.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct RoleId(String);

impl RoleId {
    pub fn parse(value: &str) -> Option<Self> {
        let valid = !value.is_empty()
            && value.len() <= ROLE_ID_MAX_BYTES
            && value.starts_with(|c: char| c.is_ascii_lowercase())
            && value
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_');
        valid.then(|| Self(value.to_string()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for RoleId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RoleDefinition {
    pub id: RoleId,
    pub kind: RoleKind,
    pub label: String,
    pub actions: BTreeSet<Action>,
}

impl RoleDefinition {
    pub fn permits(&self, action: Action) -> bool {
        self.actions.contains(&action)
    }
}

/// Why a policy document was rejected. Messages name the offending kind, action
/// or attribute so an operator can fix the file.
#[derive(Clone, Debug, PartialEq, Eq, thiserror::Error)]
pub enum PolicyError {
    #[error("the policy is not a valid document: {0}")]
    Malformed(String),
    #[error("policy_version {0} is not supported (expected 1)")]
    UnsupportedVersion(String),
    #[error("role kind `{kind}` is not allowed; only `audit_team` and `reviewer` roles exist")]
    UnknownRoleKind { kind: String },
    #[error("role `{role}` names unknown action `{action}`")]
    UnknownAction { role: String, action: String },
    #[error("role ID `{0}` is invalid (lowercase letters, digits and `_`, starting with a letter)")]
    InvalidRoleId(String),
    #[error("role `{0}` is defined more than once")]
    DuplicateRole(String),
    #[error("role `{0}` needs a non-empty label of at most 120 characters")]
    InvalidLabel(String),
    #[error("role `{0}` permits no action")]
    NoActions(String),
    #[error("the policy must define between 1 and 64 roles")]
    RoleCount,
    #[error("at least one role must permit `manage_membership`")]
    NoAdministrator,
    /// The optional `execution` section (Story 1.18) is invalid.
    #[error("the execution policy is invalid: {0}")]
    InvalidExecution(String),
    /// External-audit client or independence attributes (OQ-15).
    #[error("`{0}` is an external-audit attribute: route_not_available")]
    RouteNotAvailable(String),
}

/// A versioned Workspace role policy. Construct it only through
/// [`WorkspacePolicy::parse`] or [`WorkspacePolicy::from_value`], so every policy
/// in memory is valid.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WorkspacePolicy {
    roles: Vec<RoleDefinition>,
    /// The Workspace execution policy (Story 1.18); `None` when the document
    /// has no `execution` section, so the conservative Inquello default applies.
    execution: Option<ExecutionPolicy>,
}

/// Whether a key names an external-audit client or independence attribute.
fn is_external_audit_attribute(key: &str) -> bool {
    let key = key.to_ascii_lowercase();
    key.contains("client") || key.contains("independence") || key.contains("external")
}

pub(crate) fn check_keys(
    object: &Map<String, Value>,
    allowed: &[&str],
    at: &str,
) -> Result<(), PolicyError> {
    for key in object.keys() {
        if is_external_audit_attribute(key) {
            return Err(PolicyError::RouteNotAvailable(key.clone()));
        }
        if !allowed.contains(&key.as_str()) {
            return Err(PolicyError::Malformed(format!(
                "unknown field `{key}` in {at}"
            )));
        }
    }
    Ok(())
}

fn required<'a>(
    object: &'a Map<String, Value>,
    key: &str,
    at: &str,
) -> Result<&'a Value, PolicyError> {
    object
        .get(key)
        .ok_or_else(|| PolicyError::Malformed(format!("missing field `{key}` in {at}")))
}

fn as_str<'a>(value: &'a Value, what: &str) -> Result<&'a str, PolicyError> {
    value
        .as_str()
        .ok_or_else(|| PolicyError::Malformed(format!("{what} must be a string")))
}

impl WorkspacePolicy {
    /// Parses and validates a policy document.
    pub fn parse(text: &str) -> Result<Self, PolicyError> {
        let value: Value = serde_json::from_str(text)
            .map_err(|_| PolicyError::Malformed("not valid JSON".to_string()))?;
        Self::from_value(&value)
    }

    /// Validates a policy document already parsed as JSON.
    pub fn from_value(value: &Value) -> Result<Self, PolicyError> {
        let object = value
            .as_object()
            .ok_or_else(|| PolicyError::Malformed("the policy must be an object".to_string()))?;
        check_keys(
            object,
            &["policy_version", "roles", "execution"],
            "the policy",
        )?;
        let version = required(object, "policy_version", "the policy")?;
        if version.as_u64() != Some(POLICY_FORMAT_VERSION) {
            return Err(PolicyError::UnsupportedVersion(version.to_string()));
        }
        let roles = required(object, "roles", "the policy")?
            .as_array()
            .ok_or_else(|| PolicyError::Malformed("`roles` must be an array".to_string()))?;
        if roles.is_empty() || roles.len() > MAX_ROLES {
            return Err(PolicyError::RoleCount);
        }
        let mut parsed: Vec<RoleDefinition> = Vec::with_capacity(roles.len());
        for role in roles {
            let role = role
                .as_object()
                .ok_or_else(|| PolicyError::Malformed("each role must be an object".to_string()))?;
            check_keys(role, &["id", "kind", "label", "actions"], "a role")?;
            let raw_id = as_str(required(role, "id", "a role")?, "a role `id`")?;
            let id = RoleId::parse(raw_id)
                .ok_or_else(|| PolicyError::InvalidRoleId(raw_id.to_string()))?;
            let raw_kind = as_str(required(role, "kind", "a role")?, "a role `kind`")?;
            let kind = RoleKind::parse(raw_kind).ok_or_else(|| PolicyError::UnknownRoleKind {
                kind: raw_kind.to_string(),
            })?;
            let label = as_str(required(role, "label", "a role")?, "a role `label`")?;
            let label_chars = label.chars().count();
            if label.trim().is_empty()
                || label_chars > ROLE_LABEL_MAX_CHARS
                || label.chars().any(char::is_control)
            {
                return Err(PolicyError::InvalidLabel(id.to_string()));
            }
            let raw_actions = required(role, "actions", "a role")?
                .as_array()
                .ok_or_else(|| PolicyError::Malformed("`actions` must be an array".to_string()))?;
            let mut actions = BTreeSet::new();
            for raw in raw_actions {
                let raw = as_str(raw, "an action")?;
                let action = Action::parse(raw).ok_or_else(|| PolicyError::UnknownAction {
                    role: id.to_string(),
                    action: raw.to_string(),
                })?;
                actions.insert(action);
            }
            if actions.is_empty() {
                return Err(PolicyError::NoActions(id.to_string()));
            }
            if parsed.iter().any(|existing| existing.id == id) {
                return Err(PolicyError::DuplicateRole(id.to_string()));
            }
            parsed.push(RoleDefinition {
                id,
                kind,
                label: label.to_string(),
                actions,
            });
        }
        if !parsed
            .iter()
            .any(|role| role.permits(Action::ManageMembership))
        {
            return Err(PolicyError::NoAdministrator);
        }
        let execution = object
            .get("execution")
            .map(ExecutionPolicy::from_value)
            .transpose()?;
        Ok(Self {
            roles: parsed,
            execution,
        })
    }

    /// The canonical document: the form the service stores.
    pub fn to_value(&self) -> Value {
        let roles: Vec<Value> = self
            .roles
            .iter()
            .map(|role| {
                serde_json::json!({
                    "id": role.id.as_str(),
                    "kind": role.kind.as_str(),
                    "label": role.label,
                    "actions": role.actions.iter().map(|a| a.as_str()).collect::<Vec<_>>(),
                })
            })
            .collect();
        let mut document =
            serde_json::json!({ "policy_version": POLICY_FORMAT_VERSION, "roles": roles });
        if let (Some(execution), Some(object)) = (&self.execution, document.as_object_mut()) {
            object.insert("execution".to_string(), execution.to_value());
        }
        document
    }

    /// The execution section, if the document has one (Story 1.18).
    pub fn execution(&self) -> Option<&ExecutionPolicy> {
        self.execution.as_ref()
    }

    pub fn roles(&self) -> &[RoleDefinition] {
        &self.roles
    }

    pub fn role(&self, id: &str) -> Option<&RoleDefinition> {
        self.roles.iter().find(|role| role.id.as_str() == id)
    }

    /// The roles of `bindings` that this policy defines. Bindings to roles the
    /// policy no longer has are ignored, so they grant nothing (fail closed).
    pub fn bound_roles<'a, S: AsRef<str>>(
        &'a self,
        bindings: &'a [S],
    ) -> impl Iterator<Item = &'a RoleDefinition> + 'a {
        self.roles
            .iter()
            .filter(move |role| bindings.iter().any(|b| b.as_ref() == role.id.as_str()))
    }

    /// Whether any of `bindings` permits `action` under this policy.
    pub fn permits<S: AsRef<str>>(&self, bindings: &[S], action: Action) -> bool {
        self.bound_roles(bindings).any(|role| role.permits(action))
    }

    /// The roles that permit `manage_membership`: what the first administrator
    /// receives at bootstrap.
    pub fn administrator_roles(&self) -> Vec<RoleId> {
        self.roles
            .iter()
            .filter(|role| role.permits(Action::ManageMembership))
            .map(|role| role.id.clone())
            .collect()
    }
}
