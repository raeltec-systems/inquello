//! Effective managed policy and explicit broader modes (Story 1.18).
//!
//! - [`ExecutionPolicy`]: the optional `execution` section of the Workspace
//!   policy (sandbox ceiling, approval behaviours, network, MCP tools,
//!   extensions, and whether the two broad modes are allowed). Absent fields
//!   take the conservative Inquello default.
//! - [`effective_policy`]: the pure combination of the Workspace layer, the
//!   device-managed requirements and the user's configuration. The most
//!   restrictive value wins and every [`Setting`] names its [`SettingSource`].
//! - [`set_broad_mode`] and [`task_broad_mode`]: a Task's broader execution
//!   mode, a versioned creator-only record. A broader mode needs a human, the
//!   confirmation of its reach and a permitting policy; one the policy no
//!   longer permits is [`BroadModeStatus::Suspended`] and the Task runs as
//!   standard.
//! - [`thread_settings`]: the only derivation of a thread's sandbox and
//!   approval settings, from the effective policy and the broad mode.
//! - [`tool_profile`] (Story 1.19): the only derivation of a Task's tool
//!   profile, its private working folder with an `output` folder, read-only
//!   system locations and the Workspace's allowed network destinations, or
//!   the true reach of a permitted Full access mode.
//! - Story 1.20: [`CommandRule`]s on command prefixes (Workspace rules in the
//!   `execution` section, and a person's own prompt-or-forbid rules in a
//!   versioned record, [`set_user_rules`]); [`evaluate_command`], which
//!   combines the runtime's own prefix matches (forbid over prompt over
//!   allow) and names the controlling rule; permission requests and
//!   decisions ([`request_permission`], [`decide_permission`],
//!   [`use_permission`]); and the automatic permission reviewer switch
//!   ([`permission_reviewer`]), bounded by the same rules.

mod broad_mode;
mod command_rules;
mod effective;
mod permission;
mod profile;
mod section;
mod user_rules;

#[cfg(test)]
mod permission_tests;
#[cfg(test)]
mod profile_tests;
#[cfg(test)]
mod tests;

pub use broad_mode::BROAD_MODE_LABEL;
pub use broad_mode::BroadMode;
pub use broad_mode::BroadModeChange;
pub use broad_mode::BroadModeOutcome;
pub use broad_mode::BroadModeReceipt;
pub use broad_mode::BroadModeRecord;
pub use broad_mode::BroadModeStatus;
pub use broad_mode::BroadModeStore;
pub use broad_mode::BroadModeTask;
pub use broad_mode::SET_BROAD_MODE_COMMAND;
pub use broad_mode::SetBroadMode;
pub use broad_mode::TaskBroadMode;
pub use broad_mode::ThreadSettings;
pub use broad_mode::check_permitted;
pub use broad_mode::set_broad_mode;
pub use broad_mode::task_broad_mode;
pub use broad_mode::thread_settings;
pub use command_rules::AUTOMATED_DECISION_LABEL;
pub use command_rules::CommandEvaluation;
pub use command_rules::CommandRule;
pub use command_rules::MAX_COMMAND_RULES;
pub use command_rules::MAX_NOTE_CHARS;
pub use command_rules::MAX_PREFIX_TOKENS;
pub use command_rules::MAX_TOKEN_BYTES;
pub use command_rules::ReviewerState;
pub use command_rules::ReviewerVerdict;
pub use command_rules::RuleDecision;
pub use command_rules::RuleSource;
pub use command_rules::SourcedRule;
pub use command_rules::bounded_reviewer_verdict;
pub use command_rules::display_command;
pub use command_rules::effective_rules;
pub use command_rules::evaluate_command;
pub use command_rules::host_listed;
pub use command_rules::named_hosts;
pub use command_rules::permission_reviewer;
pub use effective::DeviceRequirements;
pub use effective::EffectivePolicy;
pub use effective::Environment;
pub use effective::Setting;
pub use effective::SettingSource;
pub use effective::UserConfig;
pub use effective::WorkspaceLayer;
pub use effective::effective_policy;
pub use permission::DECIDE_PERMISSION_COMMAND;
pub use permission::DecidePermission;
pub use permission::Decider;
pub use permission::DeciderKind;
pub use permission::MAX_REQUEST_TTL_MS;
pub use permission::MIN_REQUEST_TTL_MS;
pub use permission::NO_LONGER_PENDING;
pub use permission::NewPermissionRequest;
pub use permission::PERMISSION_LABEL;
pub use permission::PermissionDecision;
pub use permission::PermissionDecisionChange;
pub use permission::PermissionOutcome;
pub use permission::PermissionReceipt;
pub use permission::PermissionRequest;
pub use permission::PermissionRequestOutcome;
pub use permission::PermissionStore;
pub use permission::REQUEST_PERMISSION_COMMAND;
pub use permission::RequestOrigin;
pub use permission::RequestPermission;
pub use permission::RequestStatus;
pub use permission::decide_permission;
pub use permission::pending_requests;
pub use permission::permission_request;
pub use permission::request_permission;
pub use permission::use_permission;
pub use profile::Boundary;
pub use profile::FolderAccess;
pub use profile::NetworkReach;
pub use profile::TASK_OUTPUT_DIR;
pub use profile::TaskFolder;
pub use profile::ToolProfile;
pub use profile::ToolReach;
pub use profile::tool_profile;
pub use profile::tool_reach;
pub use section::ApprovalBehaviour;
pub use section::DEFAULT_APPROVALS;
pub use section::ExecutionPolicy;
pub use section::MAX_ALLOWED_DOMAINS;
pub use section::SandboxLevel;
pub use user_rules::SET_USER_RULES_COMMAND;
pub use user_rules::SetUserRules;
pub use user_rules::UserRuleInput;
pub use user_rules::UserRuleStore;
pub use user_rules::UserRules;
pub use user_rules::UserRulesChange;
pub use user_rules::UserRulesOutcome;
pub use user_rules::UserRulesReceipt;
pub use user_rules::UserRulesRecord;
pub use user_rules::rules_from_value;
pub use user_rules::rules_to_value;
pub use user_rules::set_user_rules;
pub use user_rules::user_rules;
pub use user_rules::validate_user_rules;

mod automated_review;
pub use automated_review::{AutomatedReviewChange, AutomatedReviewStore, ReviewAttribution, apply_automated_review};
