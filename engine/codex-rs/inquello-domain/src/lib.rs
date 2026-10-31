//! Inquello's domain: the rules, commands and ports for local working metadata.
//!
//! Every change to working metadata goes through a domain command that carries an
//! [`OperationId`] and an expected revision. The command handler validates the input,
//! answers replays from the stored [`Receipt`], rejects operation ID reuse and stale
//! revisions, and then commits the new state together with its receipt through the
//! [`WorkingStore`] port in one atomic step.
//!
//! This crate owns the ports; adapters (such as `inquello-adapters`) implement them.
//! It depends on no storage engine, async runtime, Electron or `codex-*` crate.
//!
//! The [`authorization`] module holds the Workspace role policy and the pure
//! allow-or-deny decision the shared service evaluates (Story 1.11).
//!
//! The [`capability`] module holds the protected capability register: reviewed
//! entries compiled into the binary and a fail-closed enablement query.
//!
//! The [`organise`] module holds Engagements, folders and private Tasks and
//! their commands (Story 1.14).
//!
//! The [`execution_policy`] module holds the Workspace execution policy, the
//! effective policy over the Workspace, device and user layers, and a Task's
//! broader execution mode (Story 1.18).
//!
//! The [`state`] module holds the separate Task, run, output, checks, review,
//! approval-marker and delivery-marker states (Story 1.15).

pub mod authorization;
pub mod capability;
mod commands;
mod error;
pub mod execution_policy;
mod model;
pub mod organise;
mod ports;
pub mod state;
pub mod routes;

pub use commands::InitializeStore;
pub use commands::get_store_info;
pub use commands::initialize_store;
pub use error::DomainError;
pub use error::StoreError;
pub use model::CommandKind;
pub use model::CommandOutcome;
pub use model::OPERATION_ID_MAX_BYTES;
pub use model::OperationId;
pub use model::Receipt;
pub use model::ReceiptStatus;
pub use model::Revision;
pub use model::STORE_SCHEMA_VERSION;
pub use model::StoreId;
pub use model::StoreInfo;
pub use model::Timestamp;
pub use ports::Clock;
pub use ports::StateChange;
pub use ports::WorkingStore;

pub mod usage;

pub mod tasks;
