//! The port Task-state commands write and read through. Adapters implement it.

use crate::error::StoreError;
use crate::model::OperationId;
use crate::model::Revision;
use crate::organise::PrincipalId;
use crate::organise::TaskId;
use crate::state::model::StateReceipt;
use crate::state::model::StateRecord;
use crate::state::model::TaskStates;
use std::future::Future;

/// One new state record and the receipt that records it.
///
/// Implementations apply it atomically: the record and the receipt are
/// persisted together or not at all, and only while the Task's state revision
/// equals `expected_revision`. The record's revision is `expected_revision + 1`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TaskStateChange {
    pub expected_revision: Revision,
    pub record: StateRecord,
    pub receipt: StateReceipt,
}

/// Durable storage for Task states.
pub trait TaskStateStore: Send + Sync {
    fn find_state_receipt(
        &self,
        operation_id: &OperationId,
    ) -> impl Future<Output = Result<Option<StateReceipt>, StoreError>> + Send;

    /// The principal who created the Task, if the Task exists.
    fn load_task_creator(
        &self,
        task_id: TaskId,
    ) -> impl Future<Output = Result<Option<PrincipalId>, StoreError>> + Send;

    /// Every state record of the Task, latest first, and its state revision
    /// (0 with no records).
    fn load_task_states(
        &self,
        task_id: TaskId,
    ) -> impl Future<Output = Result<TaskStates, StoreError>> + Send;

    /// The record that created state revision `revision` of the Task.
    fn load_state_record(
        &self,
        task_id: TaskId,
        revision: Revision,
    ) -> impl Future<Output = Result<Option<StateRecord>, StoreError>> + Send;

    /// Atomically applies `change` (see [`TaskStateChange`]).
    ///
    /// Returns [`StoreError::DuplicateOperation`] when the operation ID already
    /// has a receipt (checked first, under the same write lock) and
    /// [`StoreError::RevisionConflict`] when the Task's state revision differs.
    /// On any error nothing is persisted.
    fn commit_state(
        &self,
        change: TaskStateChange,
    ) -> impl Future<Output = Result<(), StoreError>> + Send;
}
