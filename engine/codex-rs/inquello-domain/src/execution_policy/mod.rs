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

mod broad_mode;
mod effective;
mod profile;
mod section;

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
pub use effective::DeviceRequirements;
pub use effective::EffectivePolicy;
pub use effective::Environment;
pub use effective::Setting;
pub use effective::SettingSource;
pub use effective::UserConfig;
pub use effective::WorkspaceLayer;
pub use effective::effective_policy;
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
