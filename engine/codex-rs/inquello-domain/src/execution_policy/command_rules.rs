//! Command rules and the permission decision of one command (Story 1.20).
//!
//! - A rule is `{prefix: [tokens], decision: allow|prompt|forbid, note?}`.
//!   Workspace administrators list rules in the execution policy
//!   (`execution.command_rules`); a person may add their own rules, which
//!   only prompt or forbid (see `user_rules`).
//! - Matching is the runtime's own exec-policy prefix matching: the caller
//!   (the app-server) runs it and passes which rules matched. This crate only
//!   combines the matches: among matching rules forbid wins over prompt, and
//!   prompt over allow. With no match, the effective asking behaviour (Story
//!   1.18) decides. Every evaluation names the rule (and its source) that
//!   controls it.
//! - An allowed command still runs inside the Task's tool profile (Story
//!   1.19): allow never lifts the sandbox.
//! - The automatic permission reviewer is a Workspace switch, off by
//!   default. It is bounded by the same profile and rules: it can never turn
//!   forbid into allow, change the sandbox or widen a request, and its
//!   decisions are labelled as automated permission review, never as
//!   analytical review or Professional Approval.

use crate::Revision;
use crate::execution_policy::BroadModeStatus;
use crate::execution_policy::EffectivePolicy;
use crate::execution_policy::NetworkReach;
use crate::execution_policy::ToolReach;
use crate::execution_policy::section::ApprovalBehaviour;
use crate::execution_policy::thread_settings;
use crate::execution_policy::tool_reach;
use serde_json::Map;
use serde_json::Value;
use serde_json::json;
use std::fmt;

/// The most rules a Workspace policy, or a person, may list.
pub const MAX_COMMAND_RULES: usize = 100;
/// The most tokens one rule's prefix may hold.
pub const MAX_PREFIX_TOKENS: usize = 16;
/// The longest token, in bytes.
pub const MAX_TOKEN_BYTES: usize = 256;
/// The longest note, in characters.
pub const MAX_NOTE_CHARS: usize = 500;

/// Characters a shell or glob would treat as syntax. Prefix tokens are
/// literal command words, so a token holding one is refused rather than
/// silently read as a pattern.
const SHELL_METACHARACTERS: [char; 16] = [
    '*', '?', '[', ']', '{', '}', '|', '&', ';', '<', '>', '$', '`', '(', ')', '\\',
];

/// What a rule decides, ordered from least to most restrictive.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum RuleDecision {
    Allow,
    Prompt,
    Forbid,
}

impl RuleDecision {
    pub const ALL: [RuleDecision; 3] = [
        RuleDecision::Allow,
        RuleDecision::Prompt,
        RuleDecision::Forbid,
    ];

    pub const fn as_str(self) -> &'static str {
        match self {
            RuleDecision::Allow => "allow",
            RuleDecision::Prompt => "prompt",
            RuleDecision::Forbid => "forbid",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        Self::ALL
            .into_iter()
            .find(|decision| decision.as_str() == value)
    }
}

/// One rule on a command prefix.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct CommandRule {
    /// The literal command words the rule matches, in order.
    pub prefix: Vec<String>,
    pub decision: RuleDecision,
    pub note: Option<String>,
}

impl CommandRule {
    /// Validates one rule from its parts. The message names what is wrong.
    pub fn new(
        prefix: Vec<String>,
        decision: RuleDecision,
        note: Option<String>,
    ) -> Result<Self, String> {
        if prefix.is_empty() {
            return Err("the prefix must hold at least one token".to_string());
        }
        if prefix.len() > MAX_PREFIX_TOKENS {
            return Err(format!(
                "the prefix may hold at most {MAX_PREFIX_TOKENS} tokens"
            ));
        }
        for token in &prefix {
            if token.is_empty() {
                return Err("a prefix token must not be empty".to_string());
            }
            if token.len() > MAX_TOKEN_BYTES {
                return Err(format!(
                    "a prefix token may be at most {MAX_TOKEN_BYTES} bytes"
                ));
            }
            if token.chars().any(|c| c.is_control() || c.is_whitespace()) {
                return Err(format!(
                    "the prefix token `{}` must be one command word, without spaces or control characters",
                    token.escape_debug()
                ));
            }
            if let Some(found) = token.chars().find(|c| SHELL_METACHARACTERS.contains(c)) {
                return Err(format!(
                    "the prefix token `{token}` holds `{found}`; tokens are literal command words, never shell or glob patterns"
                ));
            }
        }
        let note = match note {
            None => None,
            Some(note) => {
                let trimmed = note.trim();
                if trimmed.is_empty() {
                    None
                } else if trimmed.chars().count() > MAX_NOTE_CHARS
                    || trimmed.chars().any(|c| c.is_control() && c != '\n')
                {
                    return Err(format!(
                        "the note must be at most {MAX_NOTE_CHARS} printable characters"
                    ));
                } else {
                    Some(trimmed.to_string())
                }
            }
        };
        Ok(Self {
            prefix,
            decision,
            note,
        })
    }

    /// Validates `{prefix, decision, note?}`.
    pub fn from_value(value: &Value) -> Result<Self, String> {
        let object = value
            .as_object()
            .ok_or_else(|| "a command rule must be an object".to_string())?;
        for key in object.keys() {
            if !matches!(key.as_str(), "prefix" | "decision" | "note") {
                return Err(format!("unknown field `{key}`"));
            }
        }
        let prefix = object
            .get("prefix")
            .and_then(Value::as_array)
            .ok_or_else(|| "`prefix` must be an array of command words".to_string())?
            .iter()
            .map(|token| {
                token
                    .as_str()
                    .map(str::to_string)
                    .ok_or_else(|| "each prefix token must be a string".to_string())
            })
            .collect::<Result<Vec<_>, _>>()?;
        let decision = object
            .get("decision")
            .and_then(Value::as_str)
            .and_then(RuleDecision::parse)
            .ok_or_else(|| "`decision` must be \"allow\", \"prompt\" or \"forbid\"".to_string())?;
        let note = match object.get("note") {
            None | Some(Value::Null) => None,
            Some(Value::String(note)) => Some(note.clone()),
            Some(_) => return Err("`note` must be a string".to_string()),
        };
        Self::new(prefix, decision, note)
    }

    pub fn to_value(&self) -> Value {
        let mut object = Map::new();
        object.insert("prefix".to_string(), json!(self.prefix));
        object.insert("decision".to_string(), json!(self.decision.as_str()));
        if let Some(note) = &self.note {
            object.insert("note".to_string(), json!(note));
        }
        Value::Object(object)
    }

    /// The prefix as people read it, for example `git push`.
    pub fn prefix_text(&self) -> String {
        display_command(&self.prefix)
    }
}

/// Where a command decision comes from.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum RuleSource {
    /// A Workspace command rule at this policy revision.
    WorkspacePolicy { revision: Revision },
    /// The person's own rule, at this version of their rules.
    UserRule { version: Revision },
    /// No rule matched: the Task's effective asking behaviour decides.
    ApprovalBehaviour { behaviour: ApprovalBehaviour },
}

impl RuleSource {
    /// `workspace_policy`, `user_rule` or `approval_behaviour`.
    pub const fn kind(self) -> &'static str {
        match self {
            RuleSource::WorkspacePolicy { .. } => "workspace_policy",
            RuleSource::UserRule { .. } => "user_rule",
            RuleSource::ApprovalBehaviour { .. } => "approval_behaviour",
        }
    }

    /// The policy revision or rules version, when a rule decides.
    pub const fn revision(self) -> Option<Revision> {
        match self {
            RuleSource::WorkspacePolicy { revision } => Some(revision),
            RuleSource::UserRule { version } => Some(version),
            RuleSource::ApprovalBehaviour { .. } => None,
        }
    }

    pub const fn behaviour(self) -> Option<ApprovalBehaviour> {
        match self {
            RuleSource::ApprovalBehaviour { behaviour } => Some(behaviour),
            _ => None,
        }
    }
}

impl fmt::Display for RuleSource {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            RuleSource::WorkspacePolicy { revision } => {
                write!(f, "Workspace policy, revision {revision}")
            }
            RuleSource::UserRule { .. } => f.write_str("your rule"),
            RuleSource::ApprovalBehaviour { behaviour } => match behaviour {
                ApprovalBehaviour::Untrusted => f.write_str(
                    "this Task's asking behaviour (asks before actions not known to be safe)",
                ),
                ApprovalBehaviour::OnRequest => {
                    f.write_str("this Task's asking behaviour (asks when the agent requests it)")
                }
                ApprovalBehaviour::Never => {
                    f.write_str("this Task's asking behaviour (never asks)")
                }
            },
        }
    }
}

/// A rule with the layer it comes from.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SourcedRule {
    pub rule: CommandRule,
    pub source: RuleSource,
}

/// The rules that apply to a Task: the Workspace's first, then the person's.
pub fn effective_rules(
    policy: &EffectivePolicy,
    user_rules: &[CommandRule],
    user_version: Revision,
) -> Vec<SourcedRule> {
    let workspace = RuleSource::WorkspacePolicy {
        revision: policy.policy_revision,
    };
    let user = RuleSource::UserRule {
        version: user_version,
    };
    policy
        .command_rules
        .iter()
        .map(|rule| SourcedRule {
            rule: rule.clone(),
            source: workspace,
        })
        .chain(user_rules.iter().map(|rule| SourcedRule {
            rule: rule.clone(),
            source: user,
        }))
        .collect()
}

/// The decision record of one evaluated command.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CommandEvaluation {
    pub decision: RuleDecision,
    /// The rule that controls the decision; `None` when the asking
    /// behaviour decides.
    pub controlling_rule: Option<CommandRule>,
    pub source: RuleSource,
    /// A prompt that cannot ask: the Task's No prompt mode never asks, so
    /// the command is refused instead.
    pub cannot_ask: bool,
    /// The exact command.
    pub command: Vec<String>,
    /// The action and its destination in plain words, for example "Runs
    /// `curl https://api.example.com/` in this Task's working folder, which
    /// contacts api.example.com."
    pub analysis: String,
    /// Where the command takes effect, with no device path.
    pub destination: String,
    /// What changes, and whether it can be undone.
    pub consequence: String,
}

impl CommandEvaluation {
    /// The exact command as people read it.
    pub fn command_text(&self) -> String {
        display_command(&self.command)
    }

    /// The controlling rule and its source in words, for example "`git
    /// push` (prompt), from your rule".
    pub fn rule_text(&self) -> String {
        match &self.controlling_rule {
            Some(rule) => format!(
                "`{}` ({}), from {}",
                rule.prefix_text(),
                rule.decision.as_str(),
                self.source
            ),
            None => format!("No command rule matches; decided by {}", self.source),
        }
    }

    /// The canonical stored form.
    pub fn to_value(&self) -> Value {
        json!({
            "decision": self.decision.as_str(),
            "controlling_rule": self.controlling_rule.as_ref().map(CommandRule::to_value),
            "source": {
                "kind": self.source.kind(),
                "revision": self.source.revision().map(Revision::get),
                "behaviour": self.source.behaviour().map(ApprovalBehaviour::as_str),
            },
            "cannot_ask": self.cannot_ask,
            "command": self.command,
            "analysis": self.analysis,
            "destination": self.destination,
            "consequence": self.consequence,
        })
    }

    /// Reads the stored form back; the message names what is wrong.
    pub fn from_value(value: &Value) -> Result<Self, String> {
        let text = |key: &str| {
            value[key]
                .as_str()
                .map(str::to_string)
                .ok_or_else(|| format!("`{key}` is missing"))
        };
        let decision = value["decision"]
            .as_str()
            .and_then(RuleDecision::parse)
            .ok_or("`decision` is invalid")?;
        let controlling_rule = match &value["controlling_rule"] {
            Value::Null => None,
            rule => Some(CommandRule::from_value(rule)?),
        };
        let source = &value["source"];
        let revision = source["revision"].as_u64().map(Revision::new);
        let source = match (source["kind"].as_str(), revision) {
            (Some("workspace_policy"), Some(revision)) => RuleSource::WorkspacePolicy { revision },
            (Some("user_rule"), Some(version)) => RuleSource::UserRule { version },
            (Some("approval_behaviour"), None) => RuleSource::ApprovalBehaviour {
                behaviour: source["behaviour"]
                    .as_str()
                    .and_then(ApprovalBehaviour::parse)
                    .ok_or("`source.behaviour` is invalid")?,
            },
            _ => return Err("`source` is invalid".to_string()),
        };
        let command = value["command"]
            .as_array()
            .ok_or("`command` is missing")?
            .iter()
            .map(|token| {
                token
                    .as_str()
                    .map(str::to_string)
                    .ok_or("a command token is not a string")
            })
            .collect::<Result<Vec<_>, _>>()?;
        Ok(Self {
            decision,
            controlling_rule,
            source,
            cannot_ask: value["cannot_ask"]
                .as_bool()
                .ok_or("`cannot_ask` is missing")?,
            command,
            analysis: text("analysis")?,
            destination: text("destination")?,
            consequence: text("consequence")?,
        })
    }
}

/// Evaluates one command for a Task.
///
/// `matched[i]` says whether `rules[i]` matched the command under the
/// runtime's own prefix matching. Among matching rules the most restrictive
/// wins (forbid, then prompt, then allow); on a tie the earlier rule (the
/// Workspace's before the person's) is named. With no match, the Task's
/// effective asking behaviour decides: `untrusted` asks, `on_request` and
/// `never` allow (the command still runs inside the Task's profile). A
/// prompt under a mode that never asks is refused instead.
pub fn evaluate_command(
    command: &[String],
    rules: &[SourcedRule],
    matched: &[bool],
    policy: &EffectivePolicy,
    status: BroadModeStatus,
) -> CommandEvaluation {
    let settings = thread_settings(policy, status);
    let reach = tool_reach(policy, status);
    let mut controlling: Option<&SourcedRule> = None;
    for (rule, _) in rules
        .iter()
        .zip(matched.iter().chain(std::iter::repeat(&false)))
        .filter(|(_, matched)| **matched)
    {
        if controlling.is_none_or(|best| rule.rule.decision > best.rule.decision) {
            controlling = Some(rule);
        }
    }
    let (mut decision, controlling_rule, source) = match controlling {
        Some(rule) => (rule.rule.decision, Some(rule.rule.clone()), rule.source),
        None => (
            if settings.approval == ApprovalBehaviour::Untrusted {
                RuleDecision::Prompt
            } else {
                RuleDecision::Allow
            },
            None,
            RuleSource::ApprovalBehaviour {
                behaviour: settings.approval,
            },
        ),
    };
    let cannot_ask = decision == RuleDecision::Prompt && !settings.approval.prompts();
    if cannot_ask {
        decision = RuleDecision::Forbid;
    }
    CommandEvaluation {
        decision,
        controlling_rule,
        source,
        cannot_ask,
        command: command.to_vec(),
        analysis: analysis(command, &reach),
        destination: destination(&reach),
        consequence: consequence(&reach),
    }
}

/// The command as people read it: words separated by spaces, a word with a
/// space or quote shown in single quotes.
pub fn display_command(command: &[String]) -> String {
    command
        .iter()
        .map(|token| {
            if token.is_empty()
                || token
                    .chars()
                    .any(|c| c.is_whitespace() || matches!(c, '\'' | '"'))
            {
                format!("'{}'", token.replace('\'', "'\\''"))
            } else {
                token.clone()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// The hosts a command names in URLs (`scheme://host[:port]/…`).
pub fn named_hosts(command: &[String]) -> Vec<String> {
    let mut hosts: Vec<String> = Vec::new();
    for token in command {
        for (start, _) in token.match_indices("://") {
            let rest = &token[start + 3..];
            let authority = rest.split(['/', '?', '#']).next().unwrap_or_default();
            let host = authority.rsplit('@').next().unwrap_or_default();
            let host = if let Some(stripped) = host.strip_prefix('[') {
                stripped.split(']').next().unwrap_or_default()
            } else {
                host.split(':').next().unwrap_or_default()
            };
            let host = host.trim_end_matches('.').to_ascii_lowercase();
            if !host.is_empty() && !hosts.contains(&host) {
                hosts.push(host);
            }
        }
    }
    hosts
}

/// Whether `host` is on a listed pattern (`example.com`, `*.example.com`
/// for subdomains, `**.example.com` for the domain and its subdomains).
pub fn host_listed(host: &str, patterns: &[String]) -> bool {
    patterns.iter().any(|pattern| {
        if let Some(domain) = pattern.strip_prefix("**.") {
            host == domain || host.ends_with(&format!(".{domain}"))
        } else if let Some(domain) = pattern.strip_prefix("*.") {
            host.ends_with(&format!(".{domain}"))
        } else {
            host == pattern
        }
    })
}

fn analysis(command: &[String], reach: &ToolReach) -> String {
    let text = display_command(command);
    if !reach.bounded {
        return format!("Runs `{text}` without sandbox limits on this device.");
    }
    let hosts = named_hosts(command);
    let listed = match &reach.network {
        NetworkReach::Listed(domains) => domains.as_slice(),
        NetworkReach::Unrestricted => &[],
    };
    let network = if hosts.is_empty() {
        if listed.is_empty() {
            ", with no network access".to_string()
        } else {
            format!(", and can contact only {}", listed.join(", "))
        }
    } else {
        let parts: Vec<String> = hosts
            .iter()
            .map(|host| {
                if host_listed(host, listed) {
                    format!("contacts {host}")
                } else {
                    format!("names {host}, which is not on this Workspace's allowed list, so that contact will be blocked")
                }
            })
            .collect();
        format!(", which {}", parts.join("; and "))
    };
    format!("Runs `{text}` in this Task's working folder{network}.")
}

fn destination(reach: &ToolReach) -> String {
    if !reach.bounded {
        return "This device, without sandbox limits".to_string();
    }
    let folders = if reach.writes() {
        "This Task's working folder and Output folder"
    } else {
        "This Task's working folder and Output folder (read only)"
    };
    let network = match &reach.network {
        NetworkReach::Listed(domains) if domains.is_empty() => "no network destination".to_string(),
        NetworkReach::Listed(domains) => format!("network: only {}", domains.join(", ")),
        NetworkReach::Unrestricted => "any network destination".to_string(),
    };
    format!("{folders}; {network}")
}

fn consequence(reach: &ToolReach) -> String {
    let scope = if !reach.bounded {
        "It can change anything this account can change on this device, and Inquello cannot undo those changes."
    } else if reach.writes() {
        "It can create, change or delete files in this Task's working folder and Output folder, and Inquello cannot undo those changes. Nothing outside them changes."
    } else {
        "It can only read: nothing on this device changes."
    };
    format!("{scope} Allowing it runs this one request once and adds no rule.")
}

// ---- the automatic permission reviewer ----------------------------------------

/// The label every automated permission decision carries.
pub const AUTOMATED_DECISION_LABEL: &str =
    "Automated permission review — not analytical review or Professional Approval";

/// Whether the automatic permission reviewer decides requests.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ReviewerState {
    /// The Workspace switch is off (the default): every request goes to the person.
    Off,
    /// The switch is on but no processing route exists: requests go to the person.
    NotAvailable,
    /// The switch is on and a route exists.
    Active,
}

impl ReviewerState {
    pub const fn kind(self) -> &'static str {
        match self {
            ReviewerState::Off => "off",
            ReviewerState::NotAvailable => "not_available",
            ReviewerState::Active => "active",
        }
    }

    /// The state in words.
    pub const fn label(self) -> &'static str {
        match self {
            ReviewerState::Off => "Automated permission review: off. Every request comes to you.",
            ReviewerState::NotAvailable => {
                "Automated permission review: not available (no processing route)"
            }
            ReviewerState::Active => {
                "Automated permission review: on, bounded by this Task's sandbox and rules"
            }
        }
    }

    /// Global runtime review remains human; active automation uses only a
    /// scoped, trusted Story 1.22 invocation at the permission boundary.
    pub const fn runtime_setting(self) -> &'static str {
        "user"
    }
}

/// The reviewer's state under the policy. `route_available` is false until a
/// processing route exists (Story 1.22).
pub fn permission_reviewer(policy: &EffectivePolicy, route_available: bool) -> ReviewerState {
    match (policy.automatic_permission_review.value, route_available) {
        (false, _) => ReviewerState::Off,
        (true, false) => ReviewerState::NotAvailable,
        (true, true) => ReviewerState::Active,
    }
}

/// What the reviewer proposes for one request.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ReviewerVerdict {
    Allow,
    Deny,
}

/// Bounds a reviewer verdict by the same rules: only a request that asks may
/// be allowed, and only that one request; forbid stays forbid. The Task's
/// profile is not an input, so a verdict can never widen it.
pub fn bounded_reviewer_verdict(
    evaluation: &CommandEvaluation,
    verdict: ReviewerVerdict,
) -> ReviewerVerdict {
    match (evaluation.decision, verdict) {
        (RuleDecision::Prompt, ReviewerVerdict::Allow) if !evaluation.cannot_ask => {
            ReviewerVerdict::Allow
        }
        _ => ReviewerVerdict::Deny,
    }
}
