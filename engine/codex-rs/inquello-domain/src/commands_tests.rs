use super::*;
use crate::model::Timestamp;
use pretty_assertions::assert_eq;
use std::collections::HashMap;
use std::pin::pin;
use std::sync::Mutex;
use std::sync::atomic::AtomicUsize;
use std::sync::atomic::Ordering;
use std::task::Context;
use std::task::Poll;
use std::task::Waker;

/// Drives a future whose awaits are all immediately ready (the fake port never
/// suspends), without an async runtime.
fn block_on<F: std::future::Future>(future: F) -> F::Output {
    let mut future = pin!(future);
    let mut context = Context::from_waker(Waker::noop());
    loop {
        if let Poll::Ready(output) = future.as_mut().poll(&mut context) {
            return output;
        }
    }
}

#[derive(Default)]
struct FakeState {
    store_info: Option<StoreInfo>,
    receipts: HashMap<OperationId, Receipt>,
}

/// An in-memory [`WorkingStore`] with the same atomic compare-and-set contract as
/// the SQLite adapter.
#[derive(Default)]
struct FakeStore {
    state: Mutex<FakeState>,
    calls: AtomicUsize,
    fail_next_commit: Mutex<Option<StoreError>>,
}

impl FakeStore {
    fn calls(&self) -> usize {
        self.calls.load(Ordering::SeqCst)
    }

    fn snapshot(&self) -> (Option<StoreInfo>, usize) {
        let state = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        (state.store_info.clone(), state.receipts.len())
    }
}

impl WorkingStore for FakeStore {
    async fn load_store_info(&self) -> Result<Option<StoreInfo>, StoreError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        let state = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        Ok(state.store_info.clone())
    }

    async fn find_receipt(
        &self,
        operation_id: &OperationId,
    ) -> Result<Option<Receipt>, StoreError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        let state = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        Ok(state.receipts.get(operation_id).cloned())
    }

    async fn commit(&self, change: StateChange) -> Result<(), StoreError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        if let Some(error) = self
            .fail_next_commit
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .take()
        {
            return Err(error);
        }
        let mut state = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let actual = state
            .store_info
            .as_ref()
            .map_or(Revision::ZERO, |info| info.revision);
        if actual != change.expected_revision {
            return Err(StoreError::RevisionConflict {
                expected: change.expected_revision,
                actual,
            });
        }
        if state.receipts.contains_key(&change.receipt.operation_id) {
            return Err(StoreError::DuplicateOperation {
                operation_id: change.receipt.operation_id,
            });
        }
        state.store_info = Some(change.store_info);
        state
            .receipts
            .insert(change.receipt.operation_id.clone(), change.receipt);
        Ok(())
    }
}

struct FixedClock(i64);

impl Clock for FixedClock {
    fn now(&self) -> Timestamp {
        Timestamp::from_unix_millis(self.0)
    }
}

fn command(operation_id: &str, expected_revision: u64) -> InitializeStore {
    InitializeStore {
        operation_id: operation_id.to_string(),
        expected_revision: Revision::new(expected_revision),
    }
}

fn op(value: &str) -> OperationId {
    OperationId::parse(value).unwrap_or_else(|error| panic!("valid op id {value:?}: {error}"))
}

#[test]
fn initialize_creates_store_info_at_revision_one_with_applied_receipt() {
    let store = FakeStore::default();
    let clock = FixedClock(1_700_000_000_000);

    let outcome = block_on(initialize_store(&store, &clock, command("op-1", 0)));

    let expected_receipt = Receipt {
        operation_id: op("op-1"),
        command: CommandKind::InitializeStore,
        expected_revision: Revision::ZERO,
        resulting_revision: Revision::new(1),
        status: ReceiptStatus::Applied,
        recorded_at: Timestamp::from_unix_millis(1_700_000_000_000),
    };
    assert_eq!(
        outcome,
        Ok(CommandOutcome {
            receipt: expected_receipt,
            replayed: false,
        })
    );
    let info = block_on(get_store_info(&store))
        .ok()
        .flatten()
        .unwrap_or_else(|| panic!("store_info must exist"));
    assert_eq!(info.revision, Revision::new(1));
    assert_eq!(info.schema_version, STORE_SCHEMA_VERSION);
    assert_eq!(
        info.created_at,
        Timestamp::from_unix_millis(1_700_000_000_000)
    );
}

#[test]
fn replay_returns_stored_receipt_without_reapplying() {
    let store = FakeStore::default();
    let first = block_on(initialize_store(
        &store,
        &FixedClock(10),
        command("op-1", 0),
    ));
    let before = store.snapshot();

    let second = block_on(initialize_store(
        &store,
        &FixedClock(99),
        command("op-1", 0),
    ));

    let first = first.unwrap_or_else(|error| panic!("first apply: {error}"));
    assert_eq!(
        second,
        Ok(CommandOutcome {
            receipt: first.receipt,
            replayed: true,
        })
    );
    assert_eq!(store.snapshot(), before);
}

#[test]
fn reusing_operation_id_for_a_different_revision_is_a_conflict() {
    let store = FakeStore::default();
    let applied = block_on(initialize_store(
        &store,
        &FixedClock(10),
        command("op-1", 0),
    ));
    assert!(applied.is_ok());
    let before = store.snapshot();

    let reused = block_on(initialize_store(
        &store,
        &FixedClock(11),
        command("op-1", 1),
    ));

    assert_eq!(
        reused,
        Err(DomainError::OperationConflict {
            operation_id: op("op-1"),
        })
    );
    assert_eq!(store.snapshot(), before);
}

#[test]
fn stale_expected_revision_writes_nothing() {
    let store = FakeStore::default();

    let on_empty = block_on(initialize_store(&store, &FixedClock(1), command("op-1", 3)));
    assert_eq!(
        on_empty,
        Err(DomainError::RevisionConflict {
            expected: Revision::new(3),
            actual: Revision::ZERO,
        })
    );
    assert_eq!(store.snapshot(), (None, 0));

    let applied = block_on(initialize_store(&store, &FixedClock(2), command("op-2", 0)));
    assert!(applied.is_ok());
    let before = store.snapshot();
    let stale = block_on(initialize_store(&store, &FixedClock(3), command("op-3", 0)));
    assert_eq!(
        stale,
        Err(DomainError::RevisionConflict {
            expected: Revision::ZERO,
            actual: Revision::new(1),
        })
    );
    assert_eq!(store.snapshot(), before);
}

#[test]
fn initializing_an_initialized_store_at_its_revision_is_rejected() {
    let store = FakeStore::default();
    assert!(block_on(initialize_store(&store, &FixedClock(1), command("op-1", 0))).is_ok());
    let before = store.snapshot();

    let again = block_on(initialize_store(&store, &FixedClock(2), command("op-2", 1)));

    assert_eq!(again, Err(DomainError::AlreadyInitialized));
    assert_eq!(store.snapshot(), before);
}

#[test]
fn invalid_operation_id_is_rejected_before_the_port_is_called() {
    let store = FakeStore::default();
    let too_long = "x".repeat(129);
    for value in ["", too_long.as_str(), "op\u{7}1"] {
        let result = block_on(initialize_store(&store, &FixedClock(1), command(value, 0)));
        assert!(
            matches!(result, Err(DomainError::InvalidCommand(_))),
            "{value:?}: {result:?}"
        );
    }
    assert_eq!(store.calls(), 0);
}

#[test]
fn port_revision_conflict_at_commit_maps_to_domain_conflict() {
    let store = FakeStore::default();
    *store
        .fail_next_commit
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner) = Some(StoreError::RevisionConflict {
        expected: Revision::ZERO,
        actual: Revision::new(1),
    });

    let result = block_on(initialize_store(&store, &FixedClock(1), command("op-1", 0)));

    assert_eq!(
        result,
        Err(DomainError::RevisionConflict {
            expected: Revision::ZERO,
            actual: Revision::new(1),
        })
    );
}

#[test]
fn backend_failure_at_commit_is_surfaced_and_nothing_is_persisted() {
    let store = FakeStore::default();
    *store
        .fail_next_commit
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner) =
        Some(StoreError::Backend("disk full".to_string()));

    let result = block_on(initialize_store(&store, &FixedClock(1), command("op-1", 0)));

    assert_eq!(
        result,
        Err(DomainError::Store(StoreError::Backend(
            "disk full".to_string()
        )))
    );
    assert_eq!(store.snapshot(), (None, 0));
}

#[test]
fn get_store_info_on_empty_store_is_none() {
    let store = FakeStore::default();
    assert_eq!(block_on(get_store_info(&store)), Ok(None));
}
