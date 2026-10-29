//! Concrete adapters for the ports owned by `inquello-domain`.
//!
//! [`SqliteWorkingStore`] is Inquello's local working store: a separate SQLite file,
//! written only through domain commands, that records the `store_info` record and
//! durable operation receipts, and (Story 1.14) Engagements, folders and private
//! Tasks through the domain's `OrganiseStore` port, and (Story 1.15) Task states
//! through its `TaskStateStore` port. [`SystemClock`] implements the domain's
//! clock port.

mod clock;
mod error;
mod location;
mod organise;
mod sqlite;
mod states;
mod store;

pub use clock::SystemClock;
pub use error::OpenError;
pub use sqlite::MINIMUM_SQLITE_VERSION;
pub use sqlite::check_sqlite_version;
pub use store::SqliteWorkingStore;
