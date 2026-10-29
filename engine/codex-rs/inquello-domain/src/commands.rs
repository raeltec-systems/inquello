//! Domain commands and queries over the [`WorkingStore`] port.

use crate::error::DomainError;
use crate::error::StoreError;
use crate::model::CommandKind;
use crate::model::CommandOutcome;
use crate::model::OperationId;
use crate::model::Receipt;
use crate::model::ReceiptStatus;
use crate::model::Revision;
use crate::model::STORE_SCHEMA_VERSION;
use crate::model::StoreId;
use crate::model::StoreInfo;
use crate::ports::Clock;
use crate::ports::StateChange;
use crate::ports::WorkingStore;

/// Creates the `store_info` record of an empty working store.
///
/// `operation_id` is validated by the handler, so a malformed ID is rejected before
/// the store is touched. An empty store is at revision 0, so the only expected
/// revision that can succeed is 0.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct InitializeStore {
    pub operation_id: String,
    pub expected_revision: Revision,
}

/// Handles [`InitializeStore`].
///
/// - A malformed operation ID fails with [`DomainError::InvalidCommand`].
/// - A replay (same operation ID, same command and expected revision) returns the
///   stored receipt with `replayed: true` and applies nothing.
/// - Reusing an operation ID for a different request fails with
///   [`DomainError::OperationConflict`].
/// - An expected revision that differs from the store's fails with
///   [`DomainError::RevisionConflict`] and writes nothing.
/// - Two identical requests racing each other both succeed: one applies, the
///   other replays its receipt.
pub async fn initialize_store<S, C>(
    store: &S,
    clock: &C,
    command: InitializeStore,
) -> Result<CommandOutcome, DomainError>
where
    S: WorkingStore,
    C: Clock,
{
    let operation_id = OperationId::parse(&command.operation_id)?;
    let kind = CommandKind::InitializeStore;
    let expected = command.expected_revision;

    if let Some(outcome) = replay(store, &operation_id, kind, expected).await? {
        return Ok(outcome);
    }
    match apply_initialize(store, clock, &operation_id, expected).await {
        // A concurrent request with this operation ID may have committed after
        // the lookup above; its revision is then what refused this one.
        Err(error) if may_follow_concurrent_apply(&error) => {
            match replay(store, &operation_id, kind, expected).await? {
                Some(outcome) => Ok(outcome),
                None => Err(error),
            }
        }
        result => result,
    }
}

/// Whether a refusal met after the receipt lookup may have been caused by a
/// concurrent request with the same operation ID committing in between, so the
/// receipt must be looked up again before the refusal is returned. Store
/// failures and operation conflicts are final.
pub(crate) fn may_follow_concurrent_apply(error: &DomainError) -> bool {
    !matches!(
        error,
        DomainError::Store(_) | DomainError::OperationConflict { .. }
    )
}

/// The [`initialize_store`] steps after a receipt lookup found nothing.
async fn apply_initialize<S, C>(
    store: &S,
    clock: &C,
    operation_id: &OperationId,
    expected: Revision,
) -> Result<CommandOutcome, DomainError>
where
    S: WorkingStore,
    C: Clock,
{
    let kind = CommandKind::InitializeStore;
    let current = store.load_store_info().await.map_err(DomainError::Store)?;
    let actual = current
        .as_ref()
        .map_or(Revision::ZERO, |store_info| store_info.revision);
    if expected != actual {
        return Err(DomainError::RevisionConflict { expected, actual });
    }
    if current.is_some() {
        return Err(DomainError::AlreadyInitialized);
    }

    let resulting = expected.next()?;
    let now = clock.now();
    let store_info = StoreInfo {
        store_id: StoreId::new_random(),
        schema_version: STORE_SCHEMA_VERSION,
        revision: resulting,
        created_at: now,
    };
    let receipt = Receipt {
        operation_id: operation_id.clone(),
        command: kind,
        expected_revision: expected,
        resulting_revision: resulting,
        status: ReceiptStatus::Applied,
        recorded_at: now,
    };
    let change = StateChange {
        expected_revision: expected,
        store_info,
        receipt: receipt.clone(),
    };

    match store.commit(change).await {
        Ok(()) => Ok(CommandOutcome {
            receipt,
            replayed: false,
        }),
        Err(StoreError::RevisionConflict { expected, actual }) => {
            Err(DomainError::RevisionConflict { expected, actual })
        }
        Err(error @ StoreError::DuplicateOperation { .. }) => {
            // Another writer recorded this operation ID after our lookup.
            match replay(store, operation_id, kind, expected).await? {
                Some(outcome) => Ok(outcome),
                None => Err(DomainError::Store(error)),
            }
        }
        Err(error) => Err(DomainError::Store(error)),
    }
}

/// Returns the `store_info` record, or `None` for an uninitialized store.
pub async fn get_store_info<S>(store: &S) -> Result<Option<StoreInfo>, DomainError>
where
    S: WorkingStore,
{
    store.load_store_info().await.map_err(DomainError::Store)
}

/// Answers a repeated operation ID from its stored receipt.
async fn replay<S>(
    store: &S,
    operation_id: &OperationId,
    kind: CommandKind,
    expected: Revision,
) -> Result<Option<CommandOutcome>, DomainError>
where
    S: WorkingStore,
{
    let Some(receipt) = store
        .find_receipt(operation_id)
        .await
        .map_err(DomainError::Store)?
    else {
        return Ok(None);
    };
    if receipt.matches_request(kind, expected) {
        Ok(Some(CommandOutcome {
            receipt,
            replayed: true,
        }))
    } else {
        Err(DomainError::OperationConflict {
            operation_id: operation_id.clone(),
        })
    }
}

#[cfg(test)]
#[path = "commands_tests.rs"]
mod tests;
