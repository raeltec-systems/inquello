//! Task states (Story 1.15): execution, checks, review, approval and delivery
//! kept apart, so that "done" never collapses them into one word (FR-44, AD-6).
//!
//! - Seven dimensions, each with its own exact vocabulary
//!   ([`StateDimension::vocabulary`]): `task`, `run`, `output`, `checks`,
//!   `review`, `approval_marker` and `delivery_marker`.
//! - Each change is a new immutable [`StateRecord`] scoped to the Task, a run
//!   or an output/version reference, with its version within that (dimension,
//!   scope), its actor and the Task-state revision it created. A dimension
//!   with no record is "not recorded"; nothing is defaulted.
//! - The approval and delivery markers are local working markers only, never
//!   an authoritative sign-off or proof of delivery, and carry no external
//!   reference.
//! - No transition table spans dimensions.

mod commands;
mod model;
mod ports;

pub use commands::ENABLED_DIMENSIONS;
pub use commands::RecordTaskState;
pub use commands::check_writer;
pub use commands::record_task_state;
pub use commands::task_states;
pub use model::ActorKind;
pub use model::RECORD_STATE_COMMAND;
pub use model::STATE_REF_MAX_BYTES;
pub use model::ScopeKind;
pub use model::StateDimension;
pub use model::StateOutcome;
pub use model::StateReceipt;
pub use model::StateRecord;
pub use model::StateWriter;
pub use model::TaskStates;
pub use ports::TaskStateChange;
pub use ports::TaskStateStore;
