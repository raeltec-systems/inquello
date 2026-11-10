//! Domain values for Task states (Story 1.15): seven separate dimensions, each
//! with its own vocabulary, recorded as scoped, versioned records.

use crate::error::DomainError;
use crate::model::OperationId;
use crate::model::ReceiptStatus;
use crate::model::Revision;
use crate::model::Timestamp;
use crate::organise::PrincipalId;
use crate::organise::TaskId;

/// The longest accepted run or output reference, or actor reference, in bytes.
pub const STATE_REF_MAX_BYTES: usize = 128;

/// One state dimension. Each has its own vocabulary; no value is shared and
/// none means "done".
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum StateDimension {
    Task,
    Run,
    Output,
    Checks,
    Review,
    ApprovalMarker,
    DeliveryMarker,
}

impl StateDimension {
    /// Every dimension, in display order.
    pub const ALL: [StateDimension; 7] = [
        StateDimension::Task,
        StateDimension::Run,
        StateDimension::Output,
        StateDimension::Checks,
        StateDimension::Review,
        StateDimension::ApprovalMarker,
        StateDimension::DeliveryMarker,
    ];

    pub const fn as_str(self) -> &'static str {
        match self {
            StateDimension::Task => "task",
            StateDimension::Run => "run",
            StateDimension::Output => "output",
            StateDimension::Checks => "checks",
            StateDimension::Review => "review",
            StateDimension::ApprovalMarker => "approval_marker",
            StateDimension::DeliveryMarker => "delivery_marker",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        Self::ALL
            .into_iter()
            .find(|dimension| dimension.as_str() == value)
    }

    /// The exact values this dimension accepts.
    pub const fn vocabulary(self) -> &'static [&'static str] {
        match self {
            StateDimension::Task => &["planned", "running", "blocked", "interrupted"],
            StateDimension::Run => &[
                "running",
                "blocked",
                "interrupted",
                "execution_finished",
                "failed",
            ],
            StateDimension::Output => &["produced"],
            StateDimension::Checks => &["incomplete", "complete"],
            StateDimension::Review => &["requested", "revision_requested", "decision_recorded"],
            StateDimension::ApprovalMarker => &["noted_locally"],
            StateDimension::DeliveryMarker => &["attempted", "confirmed", "uncertain"],
        }
    }

    /// The vocabulary entry equal to `value`, if this dimension has one.
    pub fn value(self, value: &str) -> Option<&'static str> {
        self.vocabulary()
            .iter()
            .copied()
            .find(|candidate| *candidate == value)
    }

    /// The scope kinds a record of this dimension may name.
    pub const fn scope_kinds(self) -> &'static [ScopeKind] {
        match self {
            StateDimension::Task => &[ScopeKind::Task],
            StateDimension::Run => &[ScopeKind::Run],
            StateDimension::Output => &[ScopeKind::Output],
            StateDimension::Checks
            | StateDimension::Review
            | StateDimension::ApprovalMarker
            | StateDimension::DeliveryMarker => {
                &[ScopeKind::Task, ScopeKind::Run, ScopeKind::Output]
            }
        }
    }

    /// Whether only a human (a signed-in principal) may write this dimension.
    /// Model output must never mint a human decision.
    pub const fn requires_human(self) -> bool {
        matches!(
            self,
            StateDimension::Review | StateDimension::ApprovalMarker
        )
    }
}

/// What a state record is about.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum ScopeKind {
    /// The Task itself; the scope ID is the Task ID.
    Task,
    /// One run, named by a runtime reference.
    Run,
    /// One output version, named by an output/version reference.
    Output,
}

impl ScopeKind {
    pub const ALL: [ScopeKind; 3] = [ScopeKind::Task, ScopeKind::Run, ScopeKind::Output];

    pub const fn as_str(self) -> &'static str {
        match self {
            ScopeKind::Task => "task",
            ScopeKind::Run => "run",
            ScopeKind::Output => "output",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|kind| kind.as_str() == value)
    }
}

/// Who recorded a state.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ActorKind {
    /// A signed-in principal; the reference is the principal ID.
    Human,
    /// The agent runtime; the reference names the runtime source.
    Runtime,
    /// The trusted host (desktop main); the reference names the host.
    System,
}

impl ActorKind {
    pub const ALL: [ActorKind; 3] = [ActorKind::Human, ActorKind::Runtime, ActorKind::System];

    pub const fn as_str(self) -> &'static str {
        match self {
            ActorKind::Human => "human",
            ActorKind::Runtime => "runtime",
            ActorKind::System => "system",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|kind| kind.as_str() == value)
    }
}

/// The writer of one state change, as the host attests it. A human writer is
/// always the session's own principal: no payload can name another one.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum StateWriter {
    Human,
    Runtime { reference: String },
    System { reference: String },
}

impl StateWriter {
    pub const fn kind(&self) -> ActorKind {
        match self {
            StateWriter::Human => ActorKind::Human,
            StateWriter::Runtime { .. } => ActorKind::Runtime,
            StateWriter::System { .. } => ActorKind::System,
        }
    }
}

/// A run or output reference, or a non-human actor reference: 1 to
/// [`STATE_REF_MAX_BYTES`] bytes, no whitespace or control characters.
pub(crate) fn parse_state_ref(value: &str, field: &str) -> Result<String, DomainError> {
    if value.is_empty() || value.len() > STATE_REF_MAX_BYTES {
        return Err(DomainError::InvalidCommand(format!(
            "{field} must be 1 to {STATE_REF_MAX_BYTES} bytes"
        )));
    }
    if value.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err(DomainError::InvalidCommand(format!(
            "{field} must contain only printable characters"
        )));
    }
    Ok(value.to_string())
}

/// One recorded state. Records are never changed: a new value is a new record
/// with the next `version` of its (dimension, scope) and the next Task-state
/// `revision`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StateRecord {
    pub task_id: TaskId,
    pub dimension: StateDimension,
    pub scope_kind: ScopeKind,
    pub scope_id: String,
    /// An entry of `dimension.vocabulary()`.
    pub value: &'static str,
    /// 1 for the first record of this (dimension, scope), then one more per record.
    pub version: u64,
    pub actor_kind: ActorKind,
    pub actor_ref: String,
    pub recorded_at: Timestamp,
    /// The Task's state revision this record created.
    pub revision: Revision,
}

/// Every state recorded for one Task. A dimension with no record is "not
/// recorded"; nothing is defaulted.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TaskStates {
    pub task_id: TaskId,
    /// The revision of the Task's state history: 0 before the first record,
    /// then the revision of its latest record.
    pub revision: Revision,
    /// Latest first.
    pub records: Vec<StateRecord>,
}

impl TaskStates {
    /// One dimension's records, latest first.
    pub fn history(&self, dimension: StateDimension) -> impl Iterator<Item = &StateRecord> {
        self.records
            .iter()
            .filter(move |record| record.dimension == dimension)
    }

    /// The most recent record of one dimension, if any.
    pub fn latest(&self, dimension: StateDimension) -> Option<&StateRecord> {
        self.history(dimension).next()
    }
}

/// The command name a state receipt records.
pub const RECORD_STATE_COMMAND: &str = "record_state";

/// The durable record of one applied state write, scoped to the Task's state
/// history. `request` holds the canonical request, so a reused operation ID
/// with any other request (or another principal) is refused.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StateReceipt {
    pub operation_id: OperationId,
    pub principal_id: PrincipalId,
    pub task_id: TaskId,
    pub expected_revision: Revision,
    pub resulting_revision: Revision,
    /// Canonical JSON of the validated request.
    pub request: String,
    pub status: ReceiptStatus,
    pub recorded_at: Timestamp,
}

/// The result of a state write: the receipt and the record it created.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StateOutcome {
    pub receipt: StateReceipt,
    pub record: StateRecord,
    /// True when the receipt came from an earlier application of the same operation.
    pub replayed: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn dimensions_round_trip_and_keep_separate_vocabularies() {
        for dimension in StateDimension::ALL {
            assert_eq!(StateDimension::parse(dimension.as_str()), Some(dimension));
        }
        assert_eq!(StateDimension::parse("done"), None);
        assert_eq!(StateDimension::parse("approval"), None);
        // No dimension accepts a shared "done", "accepted" or "approved".
        for dimension in StateDimension::ALL {
            for value in ["done", "accepted", "approved", "complete_and_approved"] {
                assert_eq!(dimension.value(value), None, "{dimension:?} {value}");
            }
        }
        assert_eq!(
            StateDimension::Run.value("execution_finished"),
            Some("execution_finished")
        );
        assert_eq!(StateDimension::Task.value("execution_finished"), None);
        assert_eq!(StateDimension::Checks.value("complete"), Some("complete"));
        assert_eq!(
            StateDimension::ApprovalMarker.vocabulary(),
            &["noted_locally"]
        );
    }

    #[test]
    fn only_review_and_the_approval_marker_require_a_human() {
        let human_only: Vec<_> = StateDimension::ALL
            .into_iter()
            .filter(|dimension| dimension.requires_human())
            .collect();
        assert_eq!(
            human_only,
            vec![StateDimension::Review, StateDimension::ApprovalMarker]
        );
    }

    #[test]
    fn scope_and_actor_kinds_round_trip() {
        for kind in ScopeKind::ALL {
            assert_eq!(ScopeKind::parse(kind.as_str()), Some(kind));
        }
        for kind in ActorKind::ALL {
            assert_eq!(ActorKind::parse(kind.as_str()), Some(kind));
        }
        assert_eq!(ScopeKind::parse("artifact"), None);
        assert_eq!(ActorKind::parse("model"), None);
    }

    #[test]
    fn state_refs_are_bounded_and_printable() {
        assert_eq!(
            parse_state_ref("run-1", "scope_id"),
            Ok("run-1".to_string())
        );
        assert!(parse_state_ref("", "scope_id").is_err());
        assert!(parse_state_ref("a b", "scope_id").is_err());
        assert!(parse_state_ref("a\u{7}", "scope_id").is_err());
        assert!(parse_state_ref(&"x".repeat(STATE_REF_MAX_BYTES + 1), "scope_id").is_err());
    }
}
