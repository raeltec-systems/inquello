//! Private Workspace organisation (Story 1.14): Engagements, folders and private
//! Tasks in the local working store, written only through domain commands.
//!
//! - An Engagement is the local record of a shared-service Engagement (Story
//!   1.11), which owns membership. The host creates the service Engagement
//!   first and passes its ID here.
//! - A folder belongs to exactly one Engagement.
//! - A Task belongs to a Workspace and its creator. It may sit in an Engagement
//!   and one of its folders, or in neither (ad hoc). Its visibility is always
//!   `private`; moves never change visibility, grants or references.
//! - A Workspace label is the name a principal last saw for a Workspace, so
//!   that private Tasks stay listable while the shared service is down.
//!
//! IDs are random UUIDs, fixed at creation and scoped by their Workspace.

mod commands;
mod model;
mod ports;

pub use commands::Actor;
pub use commands::AttachThread;
pub use commands::CreateEngagement;
pub use commands::CreateFolder;
pub use commands::CreateTask;
pub use commands::MoveTask;
pub use commands::RememberWorkspace;
pub use commands::RenameTask;
pub use commands::UpdateEngagement;
pub use commands::attach_thread;
pub use commands::create_engagement;
pub use commands::create_folder;
pub use commands::create_task;
pub use commands::known_workspaces;
pub use commands::move_task;
pub use commands::remember_workspace;
pub use commands::rename_task;
pub use commands::update_engagement;
pub use commands::workspace_tree;
pub use model::Engagement;
pub use model::EngagementId;
pub use model::Folder;
pub use model::FolderId;
pub use model::KnownWorkspace;
pub use model::NAME_MAX_CHARS;
pub use model::OrganiseCommandKind;
pub use model::OrganiseOutcome;
pub use model::OrganiseReceipt;
pub use model::OrganiseRecord;
pub use model::PeriodDate;
pub use model::PrincipalId;
pub use model::ServiceEngagementId;
pub use model::TEXT_MAX_CHARS;
pub use model::THREAD_REF_MAX_BYTES;
pub use model::Task;
pub use model::TaskId;
pub use model::Visibility;
pub use model::WorkspaceId;
pub use model::WorkspaceLabel;
pub use model::WorkspaceTree;
pub use ports::OrganiseChange;
pub use ports::OrganiseStore;
