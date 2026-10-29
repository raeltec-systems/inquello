//! A Task's broader execution mode (Story 1.18): an explicit per-Task choice,
//! never a global or per-user default, stored as a versioned record with an
//! operation ID, an expected revision and a receipt.
//!
//! - `standard`, `no_prompt` or `full_access`. A broader mode is set only by a
//!   human (the session's principal), only with the confirmation that names its
//!   reach ([`BroadMode::reach`]), and only while the effective policy permits
//!   it; otherwise [`DomainError::BroadModeNotPermitted`] names the governing
//!   rule.
//! - A recorded mode the current policy no longer permits is reported as
//!   suspended and the Task runs as standard; it is never silently kept.
//! - The mode is a "Broader execution mode", never review, approval or
//!   acceptance.
//! - Only the Task's creator reads or writes it; anyone else gets
//!   [`DomainError::NotFound`], as for an unknown Task.

use crate::error::DomainError;
use crate::error::StoreError;
use crate::execution_policy::effective::EffectivePolicy;
use crate::execution_policy::effective::SettingSource;
use crate::execution_policy::section::ApprovalBehaviour;
use crate::execution_policy::section::SandboxLevel;
use crate::model::OperationId;
use crate::model::ReceiptStatus;
use crate::model::Revision;
use crate::model::Timestamp;
use crate::organise::Actor;
use crate::organise::PrincipalId;
use crate::organise::TaskId;
use crate::organise::WorkspaceId;
use crate::ports::Clock;
use crate::state::ActorKind;
use crate::state::StateWriter;
use serde_json::json;
use std::future::Future;

/// The label every broader mode carries. Never review or approval wording.
pub const BROAD_MODE_LABEL: &str = "Broader execution mode";

/// The command name a broad-mode receipt records.
pub const SET_BROAD_MODE_COMMAND: &str = "set_broad_mode";

/// A Task's execution mode.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum BroadMode {
    Standard,
    NoPrompt,
    FullAccess,
}

impl BroadMode {
    pub const ALL: [BroadMode; 3] = [
        BroadMode::Standard,
        BroadMode::NoPrompt,
        BroadMode::FullAccess,
    ];

    pub const fn as_str(self) -> &'static str {
        match self {
            BroadMode::Standard => "standard",
            BroadMode::NoPrompt => "no_prompt",
            BroadMode::FullAccess => "full_access",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|mode| mode.as_str() == value)
    }

    pub const fn is_broad(self) -> bool {
        !matches!(self, BroadMode::Standard)
    }

    /// The short name shown with the label.
    pub const fn title(self) -> &'static str {
        match self {
            BroadMode::Standard => "Standard",
            BroadMode::NoPrompt => "No prompt",
            BroadMode::FullAccess => "Full access",
        }
    }

    /// The reach statement the person confirms. A broader mode is set only
    /// with exactly this text as its confirmation.
    pub const fn reach(self) -> &'static str {
        match self {
            BroadMode::Standard => {
                "Standard: commands on this Task run inside the sandbox on this device, and you are asked before actions as the policy requires."
            }
            BroadMode::NoPrompt => {
                "No prompt: commands on this Task run inside the sandbox on this device, and you will not be asked before actions."
            }
            BroadMode::FullAccess => {
                "Full access: commands on this Task run without sandbox limits on this device, and you will not be asked before actions."
            }
        }
    }
}

/// One recorded mode. Records are never changed: a new choice is a new record
/// with the next revision of the Task's broad-mode history.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BroadModeRecord {
    pub task_id: TaskId,
    pub mode: BroadMode,
    pub actor_kind: ActorKind,
    pub actor_ref: String,
    pub recorded_at: Timestamp,
    /// The broad-mode revision this record created.
    pub revision: Revision,
}

/// The Task facts a broad-mode command needs.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct BroadModeTask {
    pub creator: PrincipalId,
    pub workspace_id: WorkspaceId,
}

/// A Task's recorded broad mode.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TaskBroadMode {
    pub task_id: TaskId,
    pub workspace_id: WorkspaceId,
    /// 0 before the first record, then the revision of the latest.
    pub revision: Revision,
    /// The latest record; `None` means standard, never set.
    pub current: Option<BroadModeRecord>,
}

impl TaskBroadMode {
    /// The recorded mode: standard when nothing was ever recorded.
    pub fn recorded(&self) -> BroadMode {
        self.current
            .as_ref()
            .map_or(BroadMode::Standard, |record| record.mode)
    }
}

/// The durable record of one applied broad-mode write.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BroadModeReceipt {
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

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BroadModeOutcome {
    pub receipt: BroadModeReceipt,
    pub record: BroadModeRecord,
    pub replayed: bool,
}

/// One new record and its receipt, applied atomically and only while the
/// Task's broad-mode revision equals `expected_revision`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BroadModeChange {
    pub expected_revision: Revision,
    pub record: BroadModeRecord,
    pub receipt: BroadModeReceipt,
}

/// Durable storage for Task broad modes.
pub trait BroadModeStore: Send + Sync {
    fn find_broad_mode_receipt(
        &self,
        operation_id: &OperationId,
    ) -> impl Future<Output = Result<Option<BroadModeReceipt>, StoreError>> + Send;

    /// The Task's creator and Workspace, if the Task exists.
    fn load_broad_mode_task(
        &self,
        task_id: TaskId,
    ) -> impl Future<Output = Result<Option<BroadModeTask>, StoreError>> + Send;

    /// The latest record of the Task (if any) and its broad-mode revision.
    fn load_broad_mode(
        &self,
        task_id: TaskId,
    ) -> impl Future<Output = Result<(Revision, Option<BroadModeRecord>), StoreError>> + Send;

    /// The record that created broad-mode revision `revision` of the Task.
    fn load_broad_mode_record(
        &self,
        task_id: TaskId,
        revision: Revision,
    ) -> impl Future<Output = Result<Option<BroadModeRecord>, StoreError>> + Send;

    /// Atomically applies `change`. Returns
    /// [`StoreError::DuplicateOperation`] when the operation ID already has a
    /// receipt (checked first, under the same write lock) and
    /// [`StoreError::RevisionConflict`] when the revision differs.
    fn commit_broad_mode(
        &self,
        change: BroadModeChange,
    ) -> impl Future<Output = Result<(), StoreError>> + Send;
}

/// Whether the effective policy permits `mode`; otherwise the governing rule.
pub fn check_permitted(policy: &EffectivePolicy, mode: BroadMode) -> Result<(), SettingSource> {
    let setting = match mode {
        BroadMode::Standard => return Ok(()),
        BroadMode::NoPrompt => policy.no_prompt,
        BroadMode::FullAccess => policy.full_access,
    };
    if setting.value {
        Ok(())
    } else {
        Err(setting.source)
    }
}

/// How a Task's recorded mode stands under the current policy.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BroadModeStatus {
    /// Standard: nothing broader recorded.
    Standard,
    /// A broader mode is recorded and permitted.
    Active(BroadMode),
    /// A broader mode is recorded but the policy no longer permits it; the
    /// Task runs as standard. `rule` governs.
    Suspended {
        mode: BroadMode,
        rule: SettingSource,
    },
}

impl BroadModeStatus {
    pub fn of(policy: &EffectivePolicy, recorded: BroadMode) -> Self {
        if !recorded.is_broad() {
            return BroadModeStatus::Standard;
        }
        match check_permitted(policy, recorded) {
            Ok(()) => BroadModeStatus::Active(recorded),
            Err(rule) => BroadModeStatus::Suspended {
                mode: recorded,
                rule,
            },
        }
    }

    /// The mode the Task actually runs in.
    pub const fn effective_mode(self) -> BroadMode {
        match self {
            BroadModeStatus::Active(mode) => mode,
            BroadModeStatus::Standard | BroadModeStatus::Suspended { .. } => BroadMode::Standard,
        }
    }

    pub const fn kind(self) -> &'static str {
        match self {
            BroadModeStatus::Standard => "standard",
            BroadModeStatus::Active(_) => "active",
            BroadModeStatus::Suspended { .. } => "suspended",
        }
    }
}

/// The sandbox and approval settings a thread of the Task gets, derived only
/// from the effective policy and the Task's broad mode.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ThreadSettings {
    pub sandbox: SandboxLevel,
    pub approval: ApprovalBehaviour,
    pub network: bool,
    pub mode: BroadMode,
}

pub fn thread_settings(policy: &EffectivePolicy, status: BroadModeStatus) -> ThreadSettings {
    let standard_sandbox = policy.sandbox.value.min(SandboxLevel::WorkspaceWrite);
    match status.effective_mode() {
        BroadMode::Standard => ThreadSettings {
            sandbox: standard_sandbox,
            approval: policy.approval.value,
            network: policy.network.value,
            mode: BroadMode::Standard,
        },
        BroadMode::NoPrompt => ThreadSettings {
            sandbox: standard_sandbox,
            approval: ApprovalBehaviour::Never,
            network: policy.network.value,
            mode: BroadMode::NoPrompt,
        },
        BroadMode::FullAccess => ThreadSettings {
            sandbox: SandboxLevel::FullAccess,
            approval: ApprovalBehaviour::Never,
            // Validation requires network for full access: there is no
            // sandbox to limit it.
            network: true,
            mode: BroadMode::FullAccess,
        },
    }
}

/// Sets a Task's broad mode. `confirmation` must be exactly the mode's
/// [`BroadMode::reach`] for a broader mode and absent for `standard`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SetBroadMode {
    pub operation_id: String,
    pub expected_revision: Revision,
    pub task_id: String,
    pub mode: String,
    pub confirmation: Option<String>,
    /// Attested by the host, never by the renderer or the model.
    pub writer: StateWriter,
}

struct Prepared {
    operation_id: OperationId,
    expected: Revision,
    task_id: TaskId,
    mode: BroadMode,
    writer: StateWriter,
}

impl Prepared {
    fn parse(command: SetBroadMode) -> Result<Self, DomainError> {
        let task_id = TaskId::parse(&command.task_id)?;
        let mode = BroadMode::parse(&command.mode).ok_or_else(|| {
            DomainError::InvalidCommand(
                "mode must be standard, no_prompt or full_access".to_string(),
            )
        })?;
        let writer = match command.writer {
            StateWriter::Human => StateWriter::Human,
            StateWriter::Runtime { reference } => StateWriter::Runtime {
                reference: crate::state::parse_state_ref(&reference, "actor_ref")?,
            },
            StateWriter::System { reference } => StateWriter::System {
                reference: crate::state::parse_state_ref(&reference, "actor_ref")?,
            },
        };
        if mode.is_broad() {
            if !matches!(writer, StateWriter::Human) {
                return Err(DomainError::HumanActorRequired);
            }
            if command.confirmation.as_deref() != Some(mode.reach()) {
                return Err(DomainError::InvalidCommand(
                    "a broader execution mode needs the explicit confirmation of its reach"
                        .to_string(),
                ));
            }
        } else if command.confirmation.is_some() {
            return Err(DomainError::InvalidCommand(
                "the standard mode takes no confirmation".to_string(),
            ));
        }
        Ok(Self {
            operation_id: OperationId::parse(&command.operation_id)?,
            expected: command.expected_revision,
            task_id,
            mode,
            writer,
        })
    }

    fn actor_ref(&self, actor: Actor) -> String {
        match &self.writer {
            StateWriter::Human => actor.principal_id.to_string(),
            StateWriter::Runtime { reference } | StateWriter::System { reference } => {
                reference.clone()
            }
        }
    }

    fn request(&self, actor: Actor) -> String {
        json!({
            "task_id": self.task_id.to_string(),
            "mode": self.mode.as_str(),
            "confirmed": self.mode.is_broad(),
            "actor_kind": self.writer.kind().as_str(),
            "actor_ref": self.actor_ref(actor),
        })
        .to_string()
    }
}

/// Refuses any principal but the Task's creator exactly as an unknown Task.
async fn require_creator<S>(
    store: &S,
    actor: Actor,
    task_id: TaskId,
) -> Result<BroadModeTask, DomainError>
where
    S: BroadModeStore,
{
    match store
        .load_broad_mode_task(task_id)
        .await
        .map_err(DomainError::Store)?
    {
        Some(task) if task.creator == actor.principal_id => Ok(task),
        _ => Err(DomainError::NotFound),
    }
}

/// The Task's recorded broad mode, for its creator only.
pub async fn task_broad_mode<S>(
    store: &S,
    actor: Actor,
    task_id: &str,
) -> Result<TaskBroadMode, DomainError>
where
    S: BroadModeStore,
{
    let task_id = TaskId::parse(task_id)?;
    let task = require_creator(store, actor, task_id).await?;
    let (revision, current) = store
        .load_broad_mode(task_id)
        .await
        .map_err(DomainError::Store)?;
    Ok(TaskBroadMode {
        task_id,
        workspace_id: task.workspace_id,
        revision,
        current: current.filter(|record| record.task_id == task_id),
    })
}

/// Handles [`SetBroadMode`] under `policy`, the effective policy of the
/// Task's Workspace on this device.
pub async fn set_broad_mode<S, C>(
    store: &S,
    clock: &C,
    actor: Actor,
    policy: &EffectivePolicy,
    command: SetBroadMode,
) -> Result<BroadModeOutcome, DomainError>
where
    S: BroadModeStore,
    C: Clock,
{
    let prepared = Prepared::parse(command)?;
    let request = prepared.request(actor);
    if let Some(outcome) = replay(store, actor, &prepared, &request).await? {
        return Ok(outcome);
    }
    match apply(store, clock, actor, policy, &prepared, &request).await {
        // A concurrent request with the same operation ID may have committed
        // between the first lookup and this refusal: replay it (R10).
        Err(error) if crate::commands::may_follow_concurrent_apply(&error) => {
            match replay(store, actor, &prepared, &request).await? {
                Some(outcome) => Ok(outcome),
                None => Err(error),
            }
        }
        result => result,
    }
}

async fn apply<S, C>(
    store: &S,
    clock: &C,
    actor: Actor,
    policy: &EffectivePolicy,
    prepared: &Prepared,
    request: &str,
) -> Result<BroadModeOutcome, DomainError>
where
    S: BroadModeStore,
    C: Clock,
{
    let task = require_creator(store, actor, prepared.task_id).await?;
    if task.workspace_id != policy.workspace_id {
        return Err(DomainError::WorkspaceMismatch);
    }
    check_permitted(policy, prepared.mode)
        .map_err(|rule| DomainError::BroadModeNotPermitted { rule })?;
    let (revision, _) = store
        .load_broad_mode(prepared.task_id)
        .await
        .map_err(DomainError::Store)?;
    if revision != prepared.expected {
        return Err(DomainError::RevisionConflict {
            expected: prepared.expected,
            actual: revision,
        });
    }
    let now = clock.now();
    let record = BroadModeRecord {
        task_id: prepared.task_id,
        mode: prepared.mode,
        actor_kind: prepared.writer.kind(),
        actor_ref: prepared.actor_ref(actor),
        recorded_at: now,
        revision: prepared.expected.next()?,
    };
    let receipt = BroadModeReceipt {
        operation_id: prepared.operation_id.clone(),
        principal_id: actor.principal_id,
        task_id: prepared.task_id,
        expected_revision: prepared.expected,
        resulting_revision: record.revision,
        request: request.to_string(),
        status: ReceiptStatus::Applied,
        recorded_at: now,
    };
    let change = BroadModeChange {
        expected_revision: prepared.expected,
        record: record.clone(),
        receipt: receipt.clone(),
    };
    match store.commit_broad_mode(change).await {
        Ok(()) => Ok(BroadModeOutcome {
            receipt,
            record,
            replayed: false,
        }),
        Err(StoreError::RevisionConflict { expected, actual }) => {
            Err(DomainError::RevisionConflict { expected, actual })
        }
        Err(error @ StoreError::DuplicateOperation { .. }) => {
            match replay(store, actor, prepared, request).await? {
                Some(outcome) => Ok(outcome),
                None => Err(DomainError::Store(error)),
            }
        }
        Err(error) => Err(DomainError::Store(error)),
    }
}

async fn replay<S>(
    store: &S,
    actor: Actor,
    prepared: &Prepared,
    request: &str,
) -> Result<Option<BroadModeOutcome>, DomainError>
where
    S: BroadModeStore,
{
    let Some(receipt) = store
        .find_broad_mode_receipt(&prepared.operation_id)
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
        .load_broad_mode_record(receipt.task_id, receipt.resulting_revision)
        .await
        .map_err(DomainError::Store)?
        .ok_or_else(|| {
            DomainError::Store(StoreError::Corrupt(
                "a set_broad_mode receipt names a missing record".to_string(),
            ))
        })?;
    Ok(Some(BroadModeOutcome {
        receipt,
        record,
        replayed: true,
    }))
}
