//! The Story 1.4 I/O and edge-case matrix against a real store in a temp directory.

use inquello_adapters::MINIMUM_SQLITE_VERSION;
use inquello_adapters::OpenError;
use inquello_adapters::SqliteWorkingStore;
use inquello_adapters::SystemClock;
use inquello_adapters::check_sqlite_version;
use inquello_domain::CommandKind;
use inquello_domain::CommandOutcome;
use inquello_domain::DomainError;
use inquello_domain::InitializeStore;
use inquello_domain::OperationId;
use inquello_domain::Receipt;
use inquello_domain::ReceiptStatus;
use inquello_domain::Revision;
use inquello_domain::STORE_SCHEMA_VERSION;
use inquello_domain::StateChange;
use inquello_domain::StoreError;
use inquello_domain::StoreInfo;
use inquello_domain::Timestamp;
use inquello_domain::WorkingStore;
use inquello_domain::get_store_info;
use inquello_domain::initialize_store;
use pretty_assertions::assert_eq;
use std::path::Path;
use std::path::PathBuf;
use tempfile::TempDir;

struct Fixture {
    _dir: TempDir,
    path: PathBuf,
    agent_root: PathBuf,
}

/// A temp directory with a protected `store/` and a separate agent-writable `work/`.
fn fixture() -> Fixture {
    let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("tempdir: {error}"));
    let store_dir = dir.path().join("store");
    let agent_root = dir.path().join("work");
    for directory in [&store_dir, &agent_root] {
        std::fs::create_dir(directory).unwrap_or_else(|error| panic!("mkdir: {error}"));
    }
    Fixture {
        path: store_dir.join("inquello.sqlite"),
        agent_root,
        _dir: dir,
    }
}

async fn open(fixture: &Fixture) -> SqliteWorkingStore {
    SqliteWorkingStore::open(&fixture.path, std::slice::from_ref(&fixture.agent_root))
        .await
        .unwrap_or_else(|error| panic!("open store: {error}"))
}

fn command(operation_id: &str, expected_revision: u64) -> InitializeStore {
    InitializeStore {
        operation_id: operation_id.to_string(),
        expected_revision: Revision::new(expected_revision),
    }
}

fn op(value: &str) -> OperationId {
    OperationId::parse(value).unwrap_or_else(|error| panic!("op id: {error}"))
}

async fn info(store: &SqliteWorkingStore) -> Option<StoreInfo> {
    get_store_info(store)
        .await
        .unwrap_or_else(|error| panic!("get_store_info: {error}"))
}

async fn receipt(store: &SqliteWorkingStore, operation_id: &str) -> Option<Receipt> {
    store
        .find_receipt(&op(operation_id))
        .await
        .unwrap_or_else(|error| panic!("find_receipt: {error}"))
}

async fn initialize(store: &SqliteWorkingStore, operation_id: &str) -> CommandOutcome {
    initialize_store(store, &SystemClock, command(operation_id, 0))
        .await
        .unwrap_or_else(|error| panic!("initialize: {error}"))
}

#[tokio::test]
async fn initialize_creates_store_info_at_revision_one_with_applied_receipt() {
    let fixture = fixture();
    let store = open(&fixture).await;
    assert_eq!(info(&store).await, None);

    let outcome = initialize(&store, "op-init").await;

    assert!(!outcome.replayed);
    assert_eq!(outcome.receipt.operation_id, op("op-init"));
    assert_eq!(outcome.receipt.command, CommandKind::InitializeStore);
    assert_eq!(outcome.receipt.expected_revision, Revision::ZERO);
    assert_eq!(outcome.receipt.resulting_revision, Revision::new(1));
    assert_eq!(outcome.receipt.status, ReceiptStatus::Applied);
    let stored = info(&store).await.unwrap_or_else(|| panic!("store_info"));
    assert_eq!(stored.revision, Revision::new(1));
    assert_eq!(stored.schema_version, STORE_SCHEMA_VERSION);
    assert_eq!(stored.created_at, outcome.receipt.recorded_at);
    assert_eq!(receipt(&store, "op-init").await, Some(outcome.receipt));
}

#[tokio::test]
async fn replay_returns_the_stored_receipt_without_reapplying() {
    let fixture = fixture();
    let store = open(&fixture).await;
    let first = initialize(&store, "op-init").await;
    let before = info(&store).await;

    let second = initialize_store(&store, &SystemClock, command("op-init", 0)).await;

    assert_eq!(
        second,
        Ok(CommandOutcome {
            receipt: first.receipt,
            replayed: true,
        })
    );
    assert_eq!(info(&store).await, before);
}

#[tokio::test]
async fn reusing_an_operation_id_for_a_different_revision_is_rejected() {
    let fixture = fixture();
    let store = open(&fixture).await;
    let first = initialize(&store, "op-init").await;
    let before = info(&store).await;

    let reused = initialize_store(&store, &SystemClock, command("op-init", 1)).await;

    assert_eq!(
        reused,
        Err(DomainError::OperationConflict {
            operation_id: op("op-init"),
        })
    );
    assert_eq!(info(&store).await, before);
    assert_eq!(receipt(&store, "op-init").await, Some(first.receipt));
}

#[tokio::test]
async fn stale_expected_revision_writes_nothing() {
    let fixture = fixture();
    let store = open(&fixture).await;

    let on_empty = initialize_store(&store, &SystemClock, command("op-ahead", 2)).await;
    assert_eq!(
        on_empty,
        Err(DomainError::RevisionConflict {
            expected: Revision::new(2),
            actual: Revision::ZERO,
        })
    );
    assert_eq!(info(&store).await, None);
    assert_eq!(receipt(&store, "op-ahead").await, None);

    initialize(&store, "op-init").await;
    let before = info(&store).await;
    let stale = initialize_store(&store, &SystemClock, command("op-stale", 0)).await;
    assert_eq!(
        stale,
        Err(DomainError::RevisionConflict {
            expected: Revision::ZERO,
            actual: Revision::new(1),
        })
    );
    assert_eq!(info(&store).await, before);
    assert_eq!(receipt(&store, "op-stale").await, None);
}

#[tokio::test]
async fn invalid_operation_ids_are_rejected_and_nothing_is_written() {
    let fixture = fixture();
    let store = open(&fixture).await;
    let too_long = "x".repeat(129);
    for value in ["", too_long.as_str(), "op\n1", "op\u{1b}1"] {
        let result = initialize_store(&store, &SystemClock, command(value, 0)).await;
        assert!(
            matches!(result, Err(DomainError::InvalidCommand(_))),
            "{value:?}: {result:?}"
        );
    }
    assert_eq!(info(&store).await, None);
}

#[tokio::test]
async fn linked_sqlite_meets_the_floor() {
    let fixture = fixture();
    let store = open(&fixture).await;

    let version = store
        .sqlite_version()
        .await
        .unwrap_or_else(|error| panic!("sqlite_version: {error}"));

    assert!(
        check_sqlite_version(&version).is_ok(),
        "linked SQLite {version} is older than {MINIMUM_SQLITE_VERSION}"
    );
}

#[test]
fn sqlite_older_than_the_floor_is_refused() {
    let refused = check_sqlite_version("3.51.2");
    assert!(
        matches!(&refused, Err(OpenError::UnsupportedSqlite { found }) if found == "3.51.2"),
        "{refused:?}"
    );
}

#[tokio::test]
async fn store_inside_an_agent_writable_root_is_refused_without_creating_it() {
    let fixture = fixture();
    let inside = fixture.agent_root.join("nested");
    std::fs::create_dir(&inside).unwrap_or_else(|error| panic!("mkdir: {error}"));
    let path = inside.join("inquello.sqlite");

    let refused = SqliteWorkingStore::open(&path, std::slice::from_ref(&fixture.agent_root)).await;

    assert!(
        matches!(refused, Err(OpenError::StoreLocationNotProtected { .. })),
        "{refused:?}"
    );
    assert!(!path.exists());
}

#[tokio::test]
async fn relative_and_dot_dot_paths_into_a_writable_root_are_refused() {
    let fixture = fixture();
    let sneaky = fixture
        .path
        .parent()
        .unwrap_or_else(|| panic!("store dir"))
        .join("..")
        .join("work")
        .join("inquello.sqlite");

    let refused =
        SqliteWorkingStore::open(&sneaky, std::slice::from_ref(&fixture.agent_root)).await;

    assert!(
        matches!(refused, Err(OpenError::StoreLocationNotProtected { .. })),
        "{refused:?}"
    );
}

#[cfg(unix)]
#[tokio::test]
async fn symlink_into_a_writable_root_is_refused() {
    let fixture = fixture();
    let link = fixture
        .path
        .parent()
        .unwrap_or_else(|| panic!("store dir"))
        .join("link-to-work");
    std::os::unix::fs::symlink(&fixture.agent_root, &link)
        .unwrap_or_else(|error| panic!("symlink: {error}"));

    let refused = SqliteWorkingStore::open(
        &link.join("inquello.sqlite"),
        std::slice::from_ref(&fixture.agent_root),
    )
    .await;

    assert!(
        matches!(refused, Err(OpenError::StoreLocationNotProtected { .. })),
        "{refused:?}"
    );
    assert!(!fixture.agent_root.join("inquello.sqlite").exists());
}

#[tokio::test]
async fn failure_between_state_and_receipt_rolls_back_both() {
    let fixture = fixture();
    let store = open(&fixture).await;
    let first = initialize(&store, "op-init").await;
    let before = info(&store).await.unwrap_or_else(|| panic!("store_info"));

    // Inject a failure after the state write: this change's receipt reuses an
    // operation ID that already has a receipt, so the store_info update succeeds
    // and the receipt insert then fails inside the same transaction.
    let change = StateChange {
        expected_revision: Revision::new(1),
        store_info: StoreInfo {
            revision: Revision::new(2),
            ..before.clone()
        },
        receipt: Receipt {
            operation_id: op("op-init"),
            command: CommandKind::InitializeStore,
            expected_revision: Revision::new(1),
            resulting_revision: Revision::new(2),
            status: ReceiptStatus::Applied,
            recorded_at: Timestamp::from_unix_millis(1),
        },
    };
    let result = store.commit(change).await;

    assert_eq!(
        result,
        Err(StoreError::DuplicateOperation {
            operation_id: op("op-init"),
        })
    );
    assert_eq!(info(&store).await, Some(before));
    assert_eq!(receipt(&store, "op-init").await, Some(first.receipt));

    // The store still accepts writes at the unchanged revision afterwards.
    let fresh = StateChange {
        expected_revision: Revision::new(1),
        store_info: StoreInfo {
            revision: Revision::new(2),
            ..info(&store).await.unwrap_or_else(|| panic!("store_info"))
        },
        receipt: Receipt {
            operation_id: op("op-next"),
            command: CommandKind::InitializeStore,
            expected_revision: Revision::new(1),
            resulting_revision: Revision::new(2),
            status: ReceiptStatus::Applied,
            recorded_at: Timestamp::from_unix_millis(2),
        },
    };
    assert_eq!(store.commit(fresh).await, Ok(()));
    assert_eq!(
        info(&store).await.map(|stored| stored.revision),
        Some(Revision::new(2))
    );
}

#[tokio::test]
async fn port_refuses_a_stale_commit_without_writing() {
    let fixture = fixture();
    let store = open(&fixture).await;
    initialize(&store, "op-init").await;
    let before = info(&store).await.unwrap_or_else(|| panic!("store_info"));

    let stale = StateChange {
        expected_revision: Revision::ZERO,
        store_info: StoreInfo {
            revision: Revision::new(1),
            ..before.clone()
        },
        receipt: Receipt {
            operation_id: op("op-stale"),
            command: CommandKind::InitializeStore,
            expected_revision: Revision::ZERO,
            resulting_revision: Revision::new(1),
            status: ReceiptStatus::Applied,
            recorded_at: Timestamp::from_unix_millis(1),
        },
    };

    assert_eq!(
        store.commit(stale).await,
        Err(StoreError::RevisionConflict {
            expected: Revision::ZERO,
            actual: Revision::new(1),
        })
    );
    assert_eq!(info(&store).await, Some(before));
    assert_eq!(receipt(&store, "op-stale").await, None);
}

#[tokio::test]
async fn reopen_keeps_store_id_revision_and_receipts() {
    let fixture = fixture();
    let store = open(&fixture).await;
    let outcome = initialize(&store, "op-init").await;
    let before = info(&store).await;
    store.close().await;
    drop(store);

    let reopened = open(&fixture).await;

    assert_eq!(info(&reopened).await, before);
    assert_eq!(
        receipt(&reopened, "op-init").await,
        Some(outcome.receipt.clone())
    );
    let replay = initialize_store(&reopened, &SystemClock, command("op-init", 0)).await;
    assert_eq!(
        replay,
        Ok(CommandOutcome {
            receipt: outcome.receipt,
            replayed: true,
        })
    );
}

#[tokio::test]
async fn store_uses_wal_in_a_separate_file() {
    let fixture = fixture();
    let store = open(&fixture).await;
    initialize(&store, "op-init").await;

    assert!(store.path().is_absolute());
    assert!(wal_path(store.path()).exists(), "WAL file missing");
}

#[cfg(unix)]
#[tokio::test]
async fn store_files_are_owner_only() {
    use std::os::unix::fs::PermissionsExt;

    let fixture = fixture();
    let store = open(&fixture).await;
    initialize(&store, "op-init").await;

    for path in [store.path().to_path_buf(), wal_path(store.path())] {
        let mode = std::fs::metadata(&path)
            .unwrap_or_else(|error| panic!("metadata {}: {error}", path.display()))
            .permissions()
            .mode();
        assert_eq!(mode & 0o777, 0o600, "{}", path.display());
    }
}

#[cfg(unix)]
#[tokio::test]
async fn reopening_tightens_a_loosened_store_file() {
    use std::os::unix::fs::PermissionsExt;

    let fixture = fixture();
    let store = open(&fixture).await;
    store.close().await;
    std::fs::set_permissions(&fixture.path, std::fs::Permissions::from_mode(0o644))
        .unwrap_or_else(|error| panic!("chmod: {error}"));

    let reopened = open(&fixture).await;

    let mode = std::fs::metadata(reopened.path())
        .unwrap_or_else(|error| panic!("metadata: {error}"))
        .permissions()
        .mode();
    assert_eq!(mode & 0o777, 0o600);
}

fn wal_path(path: &Path) -> PathBuf {
    let mut wal = path.as_os_str().to_owned();
    wal.push("-wal");
    PathBuf::from(wal)
}
