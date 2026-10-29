//! Domain and port errors.

use crate::execution_policy::SettingSource;
use crate::model::OperationId;
use crate::model::Revision;

/// Errors a [`crate::WorkingStore`] implementation reports.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum StoreError {
    /// The store's revision did not equal the change's expected revision.
    #[error("store revision is {actual}, expected {expected}")]
    RevisionConflict {
        expected: Revision,
        actual: Revision,
    },
    /// A receipt for this operation ID already exists.
    #[error("a receipt for operation {operation_id} already exists")]
    DuplicateOperation { operation_id: OperationId },
    /// Stored data could not be read back as domain values.
    #[error("stored working metadata is invalid: {0}")]
    Corrupt(String),
    /// The storage backend failed; nothing from the failed change was persisted.
    #[error("working store failure: {0}")]
    Backend(String),
}

/// Errors returned by domain commands and queries.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum DomainError {
    /// The command was malformed and was rejected before the store was touched.
    #[error("invalid command: {0}")]
    InvalidCommand(String),
    /// The operation ID was already used for a different command or revision.
    #[error("operation {operation_id} was already used for a different request")]
    OperationConflict { operation_id: OperationId },
    /// The expected revision did not match the store; nothing was written.
    #[error("revision conflict: expected {expected}, actual {actual}")]
    RevisionConflict {
        expected: Revision,
        actual: Revision,
    },
    /// `InitializeStore` was sent to a store that already has its `store_info`.
    #[error("the working store is already initialized")]
    AlreadyInitialized,
    /// The record does not exist, is in another Workspace, or (for a Task) was
    /// created by another principal. The three cases are indistinguishable, so a
    /// refusal never confirms another creator's private Task.
    #[error("no such record is visible to this principal")]
    NotFound,
    /// A move or create targeted an Engagement or folder of another Workspace.
    #[error("the target belongs to another Workspace")]
    WorkspaceMismatch,
    /// A `review` or `approval_marker` state was written by a runtime or
    /// system actor: only a human may record it (Story 1.15).
    #[error("this state can only be recorded by a person")]
    HumanActorRequired,
    /// The state dimension has no writer yet (Story 1.15 writes only Task and
    /// run states).
    #[error("this state dimension cannot be written yet")]
    DimensionNotEnabled,
    /// The value is not in the state dimension's vocabulary.
    #[error("the value is not a state of this dimension")]
    InvalidValue,
    /// A broader execution mode the effective policy does not permit; `rule`
    /// names the governing rule (Story 1.18).
    #[error("broad_mode_not_permitted: governed by {rule}")]
    BroadModeNotPermitted { rule: SettingSource },
    /// A person's own command rule may only prompt or forbid (Story 1.20).
    #[error("user_rule_cannot_allow: your own rules can only ask or forbid")]
    UserRuleCannotAllow,
    /// The permission request was already decided or has expired (Story 1.20).
    #[error("this request is no longer pending")]
    RequestNotPending,
    /// No allowed, unused permission covers this exact action (Story 1.20).
    #[error("no permission covers this action")]
    PermissionNotGranted,
    #[error(transparent)]
    Store(StoreError),
}
