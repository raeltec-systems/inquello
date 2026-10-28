//! Inquello's shared-service wire contract.
//!
//! This crate is the single versioned owner of the JSON schemas that the shared
//! service and its clients exchange under `/v1`:
//!
//! - **SC-1 identity and sessions** ([`login`], [`session`]): the expiring one-use
//!   login transaction, ID-token bootstrap, rotating refresh, the bounded
//!   refresh-family revoke, and the session and membership views.
//! - **SC-2 commands** ([`command`]): the mutation envelope, the service response
//!   and the durable-receipt semantics it implies.
//! - **Errors** ([`error`]): the closed set of SC-2 error kinds.
//!
//! Conventions (SC-2): IDs are opaque UUID strings; times are UTC RFC 3339 with
//! millisecond precision; revisions and command epochs are monotonically
//! increasing integers serialized as decimal strings. The JSON files under
//! `fixtures/` are the conformance fixtures; `tests/fixtures.rs` proves every one
//! round-trips through these types unchanged.

pub mod command;
pub mod error;
pub mod login;
pub mod session;
mod values;

pub use values::CommandEpoch;
pub use values::Revision;
pub use values::rfc3339_millis;

/// The protocol major version served under `/v1`.
pub const PROTOCOL_MAJOR: u32 = 1;

/// The `schema_version` every SC-2 envelope in this contract carries.
pub const SCHEMA_VERSION: u32 = 1;
