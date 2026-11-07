//! Task-state commands and queries over the [`TaskStateStore`] port.
//!
//! A state write follows the Story 1.4 pattern: validate the input before the
//! store is touched, answer a replay from its receipt, refuse a reused
//! operation ID, refuse a stale revision, then commit the record and its
//! receipt in one atomic step; a refusal met after the first receipt lookup
//! looks the receipt up again (R10).
//!
//! - Every dimension is independent: no transition table spans dimensions and
//!   none is derived from another. A run may be `execution_finished` with no
//!   checks, review or marker recorded.
//! - `review` and `approval_marker` are written only by a human, the session's
//!   own principal ([`DomainError::HumanActorRequired`]).
//! - Only [`ENABLED_DIMENSIONS`] have a writer yet; every other dimension is
//!   refused with [`DomainError::DimensionNotEnabled`] until its epic.
//! - Only the Task's creator reads or writes its states; anyone else gets
//!   [`DomainError::NotFound`], as for an unknown Task.

use crate::error::DomainError;
use crate::error::StoreError;
use crate::model::OperationId;
use crate::model::ReceiptStatus;
use crate::model::Revision;
use crate::organise::Actor;
use crate::organise::TaskId;
use crate::ports::Clock;
use crate::state::model::ScopeKind;
use crate::state::model::StateDimension;
use crate::state::model::StateOutcome;
use crate::state::model::StateReceipt;
use crate::state::model::StateRecord;
use crate::state::model::StateWriter;
use crate::state::model::TaskStates;
use crate::state::model::parse_state_ref;
use crate::state::ports::TaskStateChange;
use crate::state::ports::TaskStateStore;
use serde_json::json;

/// The dimensions Story 1.15 writes. The others exist as types and rules and
/// get their writers in later epics.
pub const ENABLED_DIMENSIONS: [StateDimension; 2] = [StateDimension::Task, StateDimension::Run];

/// Records one state of a Task. `expected_revision` is the Task's state
/// revision as last read (0 before the first record).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RecordTaskState {
    pub operation_id: String,
    pub expected_revision: Revision,
    pub task_id: String,
    pub dimension: String,
    pub scope_kind: String,
    pub scope_id: String,
    pub value: String,
    /// Attested by the host, never by the renderer or the model.
    pub writer: StateWriter,
}

/// Refuses a writer the dimension does not accept: `review` and
/// `approval_marker` need a human; every other dimension accepts any writer.
pub fn check_writer(dimension: StateDimension, writer: &StateWriter) -> Result<(), DomainError> {
    if dimension.requires_human() && !matches!(writer, StateWriter::Human) {
        return Err(DomainError::HumanActorRequired);
    }
    Ok(())
}

/// A validated request, before the store is consulted.
struct Prepared {
    operation_id: OperationId,
    expected: Revision,
    task_id: TaskId,
    dimension: StateDimension,
    scope_kind: ScopeKind,
    scope_id: String,
    value: &'static str,
    writer: StateWriter,
}

impl Prepared {
    fn parse(command: RecordTaskState) -> Result<Self, DomainError> {
        let task_id = TaskId::parse(&command.task_id)?;
        let dimension = StateDimension::parse(&command.dimension).ok_or_else(|| {
            DomainError::InvalidCommand("dimension is not a state dimension".to_string())
        })?;
        let value = dimension
            .value(&command.value)
            .ok_or(DomainError::InvalidValue)?;
        let scope_kind = ScopeKind::parse(&command.scope_kind)
            .filter(|kind| dimension.scope_kinds().contains(kind))
            .ok_or_else(|| {
                DomainError::InvalidCommand(format!(
                    "scope_kind is not a scope of the {} dimension",
                    dimension.as_str()
                ))
            })?;
        let scope_id = match scope_kind {
            ScopeKind::Task => {
                if command.scope_id != task_id.to_string() {
                    return Err(DomainError::InvalidCommand(
                        "a task scope must name the Task itself".to_string(),
                    ));
                }
                command.scope_id
            }
            ScopeKind::Run | ScopeKind::Output => parse_state_ref(&command.scope_id, "scope_id")?,
        };
        let writer = match command.writer {
            StateWriter::Human => StateWriter::Human,
            StateWriter::Runtime { reference } => StateWriter::Runtime {
                reference: parse_state_ref(&reference, "actor_ref")?,
            },
            StateWriter::System { reference } => StateWriter::System {
                reference: parse_state_ref(&reference, "actor_ref")?,
            },
        };
        check_writer(dimension, &writer)?;
        if !ENABLED_DIMENSIONS.contains(&dimension) {
            return Err(DomainError::DimensionNotEnabled);
        }
        Ok(Self {
            operation_id: OperationId::parse(&command.operation_id)?,
            expected: command.expected_revision,
            task_id,
            dimension,
            scope_kind,
            scope_id,
            value,
            writer,
        })
    }

    /// The actor reference: the session's principal for a human writer.
    fn actor_ref(&self, actor: Actor) -> String {
        match &self.writer {
            StateWriter::Human => actor.principal_id.to_string(),
            StateWriter::Runtime { reference } | StateWriter::System { reference } => {
                reference.clone()
            }
        }
    }

    /// Canonical JSON of the request, for the receipt.
    fn request(&self, actor: Actor) -> String {
        json!({
            "task_id": self.task_id.to_string(),
            "dimension": self.dimension.as_str(),
            "scope_kind": self.scope_kind.as_str(),
            "scope_id": self.scope_id,
            "value": self.value,
            "actor_kind": self.writer.kind().as_str(),
            "actor_ref": self.actor_ref(actor),
        })
        .to_string()
    }
}

/// Handles [`RecordTaskState`].
pub async fn record_task_state<S, C>(
    store: &S,
    clock: &C,
    actor: Actor,
    command: RecordTaskState,
) -> Result<StateOutcome, DomainError>
where
    S: TaskStateStore,
    C: Clock,
{
    let prepared = Prepared::parse(command)?;
    let request = prepared.request(actor);
    if let Some(outcome) = replay(store, actor, &prepared, &request).await? {
        return Ok(outcome);
    }
    match apply(store, clock, actor, &prepared, &request).await {
        // A concurrent request with the same operation ID may have committed
        // between the first lookup and this refusal (its new revision is what
        // refused this one): replay it, or refuse a different request.
        Err(error) if crate::commands::may_follow_concurrent_apply(&error) => {
            match replay(store, actor, &prepared, &request).await? {
                Some(outcome) => Ok(outcome),
                None => Err(error),
            }
        }
        result => result,
    }
}

/// Every state of a Task the actor created, latest first.
pub async fn task_states<S>(
    store: &S,
    actor: Actor,
    task_id: &str,
) -> Result<TaskStates, DomainError>
where
    S: TaskStateStore,
{
    let task_id = TaskId::parse(task_id)?;
    require_creator(store, actor, task_id).await?;
    let mut states = store
        .load_task_states(task_id)
        .await
        .map_err(DomainError::Store)?;
    states.records.retain(|record| record.task_id == task_id);
    states
        .records
        .sort_by_key(|record| std::cmp::Reverse(record.revision));
    Ok(states)
}

/// Refuses any principal but the Task's creator exactly as an unknown Task.
async fn require_creator<S>(store: &S, actor: Actor, task_id: TaskId) -> Result<(), DomainError>
where
    S: TaskStateStore,
{
    match store
        .load_task_creator(task_id)
        .await
        .map_err(DomainError::Store)?
    {
        Some(creator) if creator == actor.principal_id => Ok(()),
        _ => Err(DomainError::NotFound),
    }
}

async fn apply<S, C>(
    store: &S,
    clock: &C,
    actor: Actor,
    prepared: &Prepared,
    request: &str,
) -> Result<StateOutcome, DomainError>
where
    S: TaskStateStore,
    C: Clock,
{
    require_creator(store, actor, prepared.task_id).await?;
    let states = store
        .load_task_states(prepared.task_id)
        .await
        .map_err(DomainError::Store)?;
    if states.revision != prepared.expected {
        return Err(DomainError::RevisionConflict {
            expected: prepared.expected,
            actual: states.revision,
        });
    }
    let previous = states
        .records
        .iter()
        .filter(|record| {
            record.dimension == prepared.dimension
                && record.scope_kind == prepared.scope_kind
                && record.scope_id == prepared.scope_id
        })
        .count();
    let version = u64::try_from(previous)
        .ok()
        .and_then(|count| count.checked_add(1))
        .ok_or_else(|| DomainError::InvalidCommand("version overflow".to_string()))?;
    let now = clock.now();
    let record = StateRecord {
        task_id: prepared.task_id,
        dimension: prepared.dimension,
        scope_kind: prepared.scope_kind,
        scope_id: prepared.scope_id.clone(),
        value: prepared.value,
        version,
        actor_kind: prepared.writer.kind(),
        actor_ref: prepared.actor_ref(actor),
        recorded_at: now,
        revision: prepared.expected.next()?,
    };
    let receipt = StateReceipt {
        operation_id: prepared.operation_id.clone(),
        principal_id: actor.principal_id,
        task_id: prepared.task_id,
        expected_revision: prepared.expected,
        resulting_revision: record.revision,
        request: request.to_string(),
        status: ReceiptStatus::Applied,
        recorded_at: now,
    };
    let change = TaskStateChange {
        expected_revision: prepared.expected,
        record: record.clone(),
        receipt: receipt.clone(),
    };
    match store.commit_state(change).await {
        Ok(()) => Ok(StateOutcome {
            receipt,
            record,
            replayed: false,
        }),
        Err(StoreError::RevisionConflict { expected, actual }) => {
            Err(DomainError::RevisionConflict { expected, actual })
        }
        Err(error @ StoreError::DuplicateOperation { .. }) => {
            // Another writer recorded this operation ID after our lookup.
            match replay(store, actor, prepared, request).await? {
                Some(outcome) => Ok(outcome),
                None => Err(DomainError::Store(error)),
            }
        }
        Err(error) => Err(DomainError::Store(error)),
    }
}

/// Answers a repeated operation ID from its receipt and the record it created.
async fn replay<S>(
    store: &S,
    actor: Actor,
    prepared: &Prepared,
    request: &str,
) -> Result<Option<StateOutcome>, DomainError>
where
    S: TaskStateStore,
{
    let Some(receipt) = store
        .find_state_receipt(&prepared.operation_id)
        .await
        .map_err(DomainError::Store)?
    else {
        return Ok(None);
    };
    let same_request = receipt.principal_id == actor.principal_id
        && receipt.task_id == prepared.task_id
        && receipt.expected_revision == prepared.expected
        && receipt.request == request;
    if !same_request {
        return Err(DomainError::OperationConflict {
            operation_id: prepared.operation_id.clone(),
        });
    }
    let record = store
        .load_state_record(receipt.task_id, receipt.resulting_revision)
        .await
        .map_err(DomainError::Store)?
        .ok_or_else(|| {
            DomainError::Store(StoreError::Corrupt(
                "a record_state receipt names a missing record".to_string(),
            ))
        })?;
    Ok(Some(StateOutcome {
        receipt,
        record,
        replayed: true,
    }))
}

#[cfg(test)]
#[path = "commands_tests.rs"]
mod tests;
