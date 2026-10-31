//! Concrete adapters for the ports owned by `inquello-domain`.
//!
//! [`SqliteWorkingStore`] is Inquello's local working store: a separate SQLite file,
//! written only through domain commands, that records the `store_info` record and
//! durable operation receipts, and (Story 1.14) Engagements, folders and private
//! Tasks through the domain's `OrganiseStore` port, and (Story 1.15) Task states
//! through its `TaskStateStore` port, and (Story 1.18) Task broad modes through its
//! `BroadModeStore` port, and (Story 1.20) a person's own command rules and
//! permission requests through its `UserRuleStore` and `PermissionStore`
//! ports. [`SystemClock`] implements the domain's clock port.

mod broad_modes;
mod clock;
mod error;
mod location;
mod organise;
mod permissions;
mod routes;
mod sqlite;
mod states;
mod store;

pub use clock::SystemClock;
pub use error::OpenError;
pub use sqlite::MINIMUM_SQLITE_VERSION;
pub use sqlite::check_sqlite_version;
pub use store::SqliteWorkingStore;

pub mod anthropic;

mod usage;

mod tasks;

pub mod data_provenance;
