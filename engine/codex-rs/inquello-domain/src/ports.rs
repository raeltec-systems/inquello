//! Ports the domain owns. Adapters implement them.

use crate::error::StoreError;
use crate::model::OperationId;
use crate::model::Receipt;
use crate::model::Revision;
use crate::model::StoreInfo;
use crate::model::Timestamp;
use std::future::Future;

/// One state change and the receipt that records it.
///
/// Implementations must apply it atomically: the state and the receipt are persisted
/// together or not at all.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StateChange {
    /// The revision the store must be at for the change to apply.
    pub expected_revision: Revision,
    /// The new `store_info` record; its revision is `expected_revision + 1`.
    pub store_info: StoreInfo,
    /// The receipt for the operation that produced this change.
    pub receipt: Receipt,
}

/// Durable storage for local working metadata.
pub trait WorkingStore: Send + Sync {
    /// Loads the `store_info` record, or `None` for an uninitialized store.
    fn load_store_info(&self)
    -> impl Future<Output = Result<Option<StoreInfo>, StoreError>> + Send;

    /// Finds the receipt recorded for `operation_id`, if any.
    fn find_receipt(
        &self,
        operation_id: &OperationId,
    ) -> impl Future<Output = Result<Option<Receipt>, StoreError>> + Send;

    /// Atomically compares the store revision with `change.expected_revision`, writes
    /// `change.store_info` and records `change.receipt`.
    ///
    /// Returns [`StoreError::RevisionConflict`] when the revision differs and
    /// [`StoreError::DuplicateOperation`] when the operation ID already has a receipt.
    /// On any error nothing is persisted.
    fn commit(&self, change: StateChange) -> impl Future<Output = Result<(), StoreError>> + Send;
}

/// The source of the current time.
pub trait Clock: Send + Sync {
    fn now(&self) -> Timestamp;
}
