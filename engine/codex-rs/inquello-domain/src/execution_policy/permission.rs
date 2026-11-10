//! Permission requests and permission decisions (Story 1.20).
//!
//! - A request asks the Task's creator for permission to take one exact
//!   action (in this story, one command). It carries the command's
//!   [`CommandEvaluation`]: the exact command, its destination and
//!   consequences, and the controlling rule. It is labelled "Permission to
//!   act", never review or approval.
//! - A request is decided once: allowed (by the person, or by the automatic
//!   reviewer when it is active), denied, or expired (by the host, when no
//!   one decided in time). A decided or expired request is no longer pending
//!   ([`DomainError::RequestNotPending`]).
//! - An allowed request authorizes that single action once, inside the
//!   Task's profile: [`use_permission`] consumes it for exactly the command
//!   it names. Allowing widens nothing and adds no rule.
//! - Permission decisions never write the Story 1.15 `review` or
//!   `approval_marker` dimensions: this module has no access to Task states.
//! - Only the Task's creator reads or decides a request; anyone else gets
//!   [`DomainError::NotFound`], as for an unknown request.

use crate::DomainError;
use crate::OperationId;
use crate::ReceiptStatus;
use crate::Revision;
use crate::StoreError;
use crate::Timestamp;
use crate::execution_policy::BroadModeTask;
use crate::execution_policy::command_rules::CommandEvaluation;
use crate::execution_policy::command_rules::ReviewerVerdict;
use crate::execution_policy::command_rules::RuleDecision;
use crate::execution_policy::command_rules::bounded_reviewer_verdict;
use crate::organise::Actor;
use crate::organise::PermissionRequestId;
use crate::organise::PrincipalId;
use crate::organise::TaskId;
use crate::organise::WorkspaceId;
use crate::ports::Clock;
use serde_json::json;
use std::future::Future;

/// The label every permission request carries.
pub const PERMISSION_LABEL: &str = "Permission to act";
/// What a stale card says.
pub const NO_LONGER_PENDING: &str = "This request is no longer pending";

pub const REQUEST_PERMISSION_COMMAND: &str = "request_permission";
pub const DECIDE_PERMISSION_COMMAND: &str = "decide_permission";

/// The shortest and longest time a request may wait for a decision.
pub const MIN_REQUEST_TTL_MS: u64 = 1_000;
pub const MAX_REQUEST_TTL_MS: u64 = 86_400_000;

/// Where a request comes from. Story 1.25's model-originated requests use
/// the same path with `Runtime`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum RequestOrigin {
    /// `inquello/tools/exec`.
    ToolsExec,
    /// A runtime escalation.
    Runtime,
}

impl RequestOrigin {
    pub const fn as_str(self) -> &'static str {
        match self {
            RequestOrigin::ToolsExec => "tools_exec",
            RequestOrigin::Runtime => "runtime",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "tools_exec" => Some(RequestOrigin::ToolsExec),
            "runtime" => Some(RequestOrigin::Runtime),
            _ => None,
        }
    }
}

/// How a request was decided.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum PermissionOutcome {
    Allowed,
    Denied,
    Expired,
}

impl PermissionOutcome {
    pub const fn as_str(self) -> &'static str {
        match self {
            PermissionOutcome::Allowed => "allowed",
            PermissionOutcome::Denied => "denied",
            PermissionOutcome::Expired => "expired",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "allowed" => Some(PermissionOutcome::Allowed),
            "denied" => Some(PermissionOutcome::Denied),
            "expired" => Some(PermissionOutcome::Expired),
            _ => None,
        }
    }
}

/// Who decided a request.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum DeciderKind {
    /// The signed-in person; the reference is the principal ID.
    Human,
    /// The automatic permission reviewer, when active.
    AutomatedReviewer,
    /// The trusted host, for an expiry or a decline-by-default.
    System,
}

impl DeciderKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            DeciderKind::Human => "human",
            DeciderKind::AutomatedReviewer => "automated_reviewer",
            DeciderKind::System => "system",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "human" => Some(DeciderKind::Human),
            "automated_reviewer" => Some(DeciderKind::AutomatedReviewer),
            "system" => Some(DeciderKind::System),
            _ => None,
        }
    }
}

/// The recorded decision of one request.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PermissionDecision {
    pub outcome: PermissionOutcome,
    pub actor_kind: DeciderKind,
    pub actor_ref: String,
    pub decided_at: Timestamp,
}

/// Where a request stands now.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum RequestStatus {
    Pending,
    Allowed,
    Denied,
    Expired,
}

impl RequestStatus {
    pub const fn as_str(self) -> &'static str {
        match self {
            RequestStatus::Pending => "pending",
            RequestStatus::Allowed => "allowed",
            RequestStatus::Denied => "denied",
            RequestStatus::Expired => "expired",
        }
    }
}

/// One permission request. The request itself is never changed; its
/// decision is recorded once, and an allowed request is marked used once.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PermissionRequest {
    pub request_id: PermissionRequestId,
    pub principal_id: PrincipalId,
    pub task_id: TaskId,
    pub workspace_id: WorkspaceId,
    pub origin: RequestOrigin,
    pub evaluation: CommandEvaluation,
    pub created_at: Timestamp,
    pub expires_at: Timestamp,
    pub decision: Option<PermissionDecision>,
    /// When the allowed action ran (once).
    pub used_at: Option<Timestamp>,
}

impl PermissionRequest {
    /// 1 while undecided, 2 once decided.
    pub fn revision(&self) -> Revision {
        Revision::new(if self.decision.is_some() { 2 } else { 1 })
    }

    /// The status at `now`: an undecided request past its expiry is expired.
    pub fn status(&self, now: Timestamp) -> RequestStatus {
        match &self.decision {
            Some(decision) => match decision.outcome {
                PermissionOutcome::Allowed => RequestStatus::Allowed,
                PermissionOutcome::Denied => RequestStatus::Denied,
                PermissionOutcome::Expired => RequestStatus::Expired,
            },
            None if now.unix_millis() >= self.expires_at.unix_millis() => RequestStatus::Expired,
            None => RequestStatus::Pending,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PermissionReceipt {
    pub operation_id: OperationId,
    pub principal_id: PrincipalId,
    /// [`REQUEST_PERMISSION_COMMAND`] or [`DECIDE_PERMISSION_COMMAND`].
    pub command: String,
    pub request_id: PermissionRequestId,
    pub expected_revision: Revision,
    pub resulting_revision: Revision,
    /// Canonical JSON of the validated request.
    pub request: String,
    pub status: ReceiptStatus,
    pub recorded_at: Timestamp,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PermissionRequestOutcome {
    pub receipt: PermissionReceipt,
    pub request: PermissionRequest,
    pub replayed: bool,
}

/// A new request and its receipt, applied atomically.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NewPermissionRequest {
    pub request: PermissionRequest,
    pub receipt: PermissionReceipt,
}

/// A decision and its receipt, applied atomically and only while the request
/// is undecided.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PermissionDecisionChange {
    pub request_id: PermissionRequestId,
    pub decision: PermissionDecision,
    pub receipt: PermissionReceipt,
}

/// Durable storage for permission requests.
pub trait PermissionStore: Send + Sync {
    fn find_permission_receipt(
        &self,
        operation_id: &OperationId,
    ) -> impl Future<Output = Result<Option<PermissionReceipt>, StoreError>> + Send;

    /// The Task's creator and Workspace, if the Task exists.
    fn load_permission_task(
        &self,
        task_id: TaskId,
    ) -> impl Future<Output = Result<Option<BroadModeTask>, StoreError>> + Send;

    fn load_permission_request(
        &self,
        request_id: PermissionRequestId,
    ) -> impl Future<Output = Result<Option<PermissionRequest>, StoreError>> + Send;

    /// The principal's undecided requests (of one Task, when named), oldest first.
    fn list_undecided_requests(
        &self,
        principal_id: PrincipalId,
        task_id: Option<TaskId>,
    ) -> impl Future<Output = Result<Vec<PermissionRequest>, StoreError>> + Send;

    /// Inserts a request. Returns [`StoreError::DuplicateOperation`] when the
    /// operation ID already has a receipt (checked first) and
    /// [`StoreError::RevisionConflict`] (expected 0, actual 1) when the
    /// request ID exists.
    fn commit_permission_request(
        &self,
        change: NewPermissionRequest,
    ) -> impl Future<Output = Result<(), StoreError>> + Send;

    /// Records a decision. Returns [`StoreError::DuplicateOperation`] when
    /// the operation ID already has a receipt (checked first) and
    /// [`StoreError::RevisionConflict`] (expected 1, actual 2) when the
    /// request is already decided.
    fn commit_permission_decision(
        &self,
        change: PermissionDecisionChange,
    ) -> impl Future<Output = Result<(), StoreError>> + Send;

    /// Marks an allowed, unused request used. Returns whether it was marked.
    fn mark_permission_used(
        &self,
        request_id: PermissionRequestId,
        at: Timestamp,
    ) -> impl Future<Output = Result<bool, StoreError>> + Send;
}

/// Asks for permission to take the action `evaluation` describes.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RequestPermission {
    pub operation_id: String,
    pub request_id: String,
    pub task_id: String,
    pub origin: String,
    /// Computed by the host from the Task's rules and policy, never by the
    /// renderer or the model.
    pub evaluation: CommandEvaluation,
    /// How long the request waits for a decision.
    pub ttl_ms: u64,
}

/// Decides a request.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DecidePermission {
    pub operation_id: String,
    /// 1: the request's revision while undecided.
    pub expected_revision: Revision,
    pub request_id: String,
    /// `allowed`, `denied` or `expired`.
    pub outcome: String,
    pub decider: Decider,
}

/// Who decides, attested by the host.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Decider {
    /// The session's principal.
    Human,
    /// The automatic permission reviewer; the host passes it only while the
    /// reviewer is active.
    AutomatedReviewer { reference: String },
    /// The host: expiry or decline-by-default only.
    System { reference: String },
}

impl Decider {
    const fn kind(&self) -> DeciderKind {
        match self {
            Decider::Human => DeciderKind::Human,
            Decider::AutomatedReviewer { .. } => DeciderKind::AutomatedReviewer,
            Decider::System { .. } => DeciderKind::System,
        }
    }
}

async fn require_creator<S>(
    store: &S,
    actor: Actor,
    task_id: TaskId,
) -> Result<BroadModeTask, DomainError>
where
    S: PermissionStore,
{
    match store
        .load_permission_task(task_id)
        .await
        .map_err(DomainError::Store)?
    {
        Some(task) if task.creator == actor.principal_id => Ok(task),
        _ => Err(DomainError::NotFound),
    }
}

/// One of the principal's requests; anyone else's is [`DomainError::NotFound`].
pub async fn permission_request<S>(
    store: &S,
    actor: Actor,
    request_id: &str,
) -> Result<PermissionRequest, DomainError>
where
    S: PermissionStore,
{
    let request_id = PermissionRequestId::parse(request_id)?;
    match store
        .load_permission_request(request_id)
        .await
        .map_err(DomainError::Store)?
    {
        Some(request) if request.principal_id == actor.principal_id => Ok(request),
        _ => Err(DomainError::NotFound),
    }
}

/// The principal's pending requests at `now` (of one Task, when named; the
/// Task must be theirs).
pub async fn pending_requests<S>(
    store: &S,
    actor: Actor,
    task_id: Option<&str>,
    now: Timestamp,
) -> Result<Vec<PermissionRequest>, DomainError>
where
    S: PermissionStore,
{
    let task_id = match task_id {
        Some(task_id) => {
            let task_id = TaskId::parse(task_id)?;
            require_creator(store, actor, task_id).await?;
            Some(task_id)
        }
        None => None,
    };
    Ok(store
        .list_undecided_requests(actor.principal_id, task_id)
        .await
        .map_err(DomainError::Store)?
        .into_iter()
        .filter(|request| request.principal_id == actor.principal_id)
        .filter(|request| request.status(now) == RequestStatus::Pending)
        .collect())
}

/// Records a pending request. A forbidden command is never requested: it is
/// refused before a request exists.
pub async fn request_permission<S, C>(
    store: &S,
    clock: &C,
    actor: Actor,
    command: RequestPermission,
) -> Result<PermissionRequestOutcome, DomainError>
where
    S: PermissionStore,
    C: Clock,
{
    let operation_id = OperationId::parse(&command.operation_id)?;
    let request_id = PermissionRequestId::parse(&command.request_id)?;
    let task_id = TaskId::parse(&command.task_id)?;
    let origin = RequestOrigin::parse(&command.origin).ok_or_else(|| {
        DomainError::InvalidCommand("origin must be tools_exec or runtime".to_string())
    })?;
    if !(MIN_REQUEST_TTL_MS..=MAX_REQUEST_TTL_MS).contains(&command.ttl_ms) {
        return Err(DomainError::InvalidCommand(format!(
            "ttl_ms must be {MIN_REQUEST_TTL_MS} to {MAX_REQUEST_TTL_MS}"
        )));
    }
    if command.evaluation.decision == RuleDecision::Forbid {
        return Err(DomainError::InvalidCommand(
            "a forbidden command cannot be requested".to_string(),
        ));
    }
    if command.evaluation.command.is_empty() {
        return Err(DomainError::InvalidCommand(
            "the command must not be empty".to_string(),
        ));
    }
    let request_json = json!({
        "request_id": request_id.to_string(),
        "task_id": task_id.to_string(),
        "origin": origin.as_str(),
        "ttl_ms": command.ttl_ms,
        "evaluation": command.evaluation.to_value(),
    })
    .to_string();
    let replay_key = ReplayKey {
        operation_id: &operation_id,
        request_id,
        expected: Revision::ZERO,
        request: &request_json,
    };
    if let Some(outcome) = replay(store, actor, &replay_key).await? {
        return Ok(outcome);
    }
    let applied = async {
        let task = require_creator(store, actor, task_id).await?;
        let now = clock.now();
        let ttl = i64::try_from(command.ttl_ms).unwrap_or(i64::MAX);
        let request = PermissionRequest {
            request_id,
            principal_id: actor.principal_id,
            task_id,
            workspace_id: task.workspace_id,
            origin,
            evaluation: command.evaluation.clone(),
            created_at: now,
            expires_at: Timestamp::from_unix_millis(now.unix_millis().saturating_add(ttl)),
            decision: None,
            used_at: None,
        };
        let receipt = PermissionReceipt {
            operation_id: operation_id.clone(),
            principal_id: actor.principal_id,
            command: REQUEST_PERMISSION_COMMAND.to_string(),
            request_id,
            expected_revision: Revision::ZERO,
            resulting_revision: Revision::new(1),
            request: request_json.clone(),
            status: ReceiptStatus::Applied,
            recorded_at: now,
        };
        store
            .commit_permission_request(NewPermissionRequest {
                request: request.clone(),
                receipt: receipt.clone(),
            })
            .await
            .map_err(store_error)?;
        Ok(PermissionRequestOutcome {
            receipt,
            request,
            replayed: false,
        })
    }
    .await;
    settle(store, actor, &replay_key, applied).await
}

/// Decides a pending request.
///
/// - A person (`Human`) allows or denies.
/// - The automatic reviewer allows or denies, bounded by the same rules: an
///   allow is recorded only for a request that asks ([`bounded_reviewer_verdict`]).
/// - The host (`System`) only expires or denies; it never allows.
/// - A decided request, or one past its expiry, is
///   [`DomainError::RequestNotPending`]; nothing is recorded.
pub async fn decide_permission<S, C>(
    store: &S,
    clock: &C,
    actor: Actor,
    command: DecidePermission,
) -> Result<PermissionRequestOutcome, DomainError>
where
    S: PermissionStore,
    C: Clock,
{
    let operation_id = OperationId::parse(&command.operation_id)?;
    let request_id = PermissionRequestId::parse(&command.request_id)?;
    let outcome = PermissionOutcome::parse(&command.outcome).ok_or_else(|| {
        DomainError::InvalidCommand("outcome must be allowed, denied or expired".to_string())
    })?;
    let (kind, actor_ref) = match &command.decider {
        Decider::Human => (DeciderKind::Human, actor.principal_id.to_string()),
        Decider::AutomatedReviewer { reference } | Decider::System { reference } => (
            command.decider.kind(),
            crate::state::parse_state_ref(reference, "actor_ref")?,
        ),
    };
    match (kind, outcome) {
        (DeciderKind::System, PermissionOutcome::Allowed) => {
            return Err(DomainError::HumanActorRequired);
        }
        (DeciderKind::Human | DeciderKind::AutomatedReviewer, PermissionOutcome::Expired) => {
            return Err(DomainError::InvalidCommand(
                "only the host records an expiry".to_string(),
            ));
        }
        _ => {}
    }
    let request_json = json!({
        "request_id": request_id.to_string(),
        "outcome": outcome.as_str(),
        "actor_kind": kind.as_str(),
        "actor_ref": actor_ref,
    })
    .to_string();
    let replay_key = ReplayKey {
        operation_id: &operation_id,
        request_id,
        expected: command.expected_revision,
        request: &request_json,
    };
    if let Some(outcome) = replay(store, actor, &replay_key).await? {
        return Ok(outcome);
    }
    let applied = async {
        let request = permission_request(store, actor, &request_id.to_string()).await?;
        let now = clock.now();
        if request.revision() != command.expected_revision {
            if request.decision.is_some() {
                return Err(DomainError::RequestNotPending);
            }
            return Err(DomainError::RevisionConflict {
                expected: command.expected_revision,
                actual: request.revision(),
            });
        }
        let status = request.status(now);
        let expiring = kind == DeciderKind::System && outcome == PermissionOutcome::Expired;
        if status != RequestStatus::Pending && !(expiring && status == RequestStatus::Expired) {
            return Err(DomainError::RequestNotPending);
        }
        let outcome =
            if kind == DeciderKind::AutomatedReviewer && outcome == PermissionOutcome::Allowed {
                match bounded_reviewer_verdict(&request.evaluation, ReviewerVerdict::Allow) {
                    ReviewerVerdict::Allow => PermissionOutcome::Allowed,
                    ReviewerVerdict::Deny => PermissionOutcome::Denied,
                }
            } else {
                outcome
            };
        let decision = PermissionDecision {
            outcome,
            actor_kind: kind,
            actor_ref: actor_ref.clone(),
            decided_at: now,
        };
        let receipt = PermissionReceipt {
            operation_id: operation_id.clone(),
            principal_id: actor.principal_id,
            command: DECIDE_PERMISSION_COMMAND.to_string(),
            request_id,
            expected_revision: command.expected_revision,
            resulting_revision: Revision::new(2),
            request: request_json.clone(),
            status: ReceiptStatus::Applied,
            recorded_at: now,
        };
        store
            .commit_permission_decision(PermissionDecisionChange {
                request_id,
                decision: decision.clone(),
                receipt: receipt.clone(),
            })
            .await
            .map_err(|error| match error {
                StoreError::RevisionConflict { .. } => DomainError::RequestNotPending,
                error => store_error(error),
            })?;
        Ok(PermissionRequestOutcome {
            receipt,
            request: PermissionRequest {
                decision: Some(decision),
                ..request
            },
            replayed: false,
        })
    }
    .await;
    settle(store, actor, &replay_key, applied).await
}

/// Consumes an allowed request for exactly the command it names, once. Any
/// other request, Task or command is [`DomainError::PermissionNotGranted`].
pub async fn use_permission<S, C>(
    store: &S,
    clock: &C,
    actor: Actor,
    request_id: &str,
    task_id: TaskId,
    command: &[String],
) -> Result<PermissionRequest, DomainError>
where
    S: PermissionStore,
    C: Clock,
{
    let request = match permission_request(store, actor, request_id).await {
        Err(DomainError::NotFound) => return Err(DomainError::PermissionNotGranted),
        other => other?,
    };
    let now = clock.now();
    if request.task_id != task_id
        || request.evaluation.command != command
        || request.status(now) != RequestStatus::Allowed
        || request.used_at.is_some()
    {
        return Err(DomainError::PermissionNotGranted);
    }
    if !store
        .mark_permission_used(request.request_id, now)
        .await
        .map_err(DomainError::Store)?
    {
        return Err(DomainError::PermissionNotGranted);
    }
    Ok(PermissionRequest {
        used_at: Some(now),
        ..request
    })
}

struct ReplayKey<'a> {
    operation_id: &'a OperationId,
    request_id: PermissionRequestId,
    expected: Revision,
    request: &'a str,
}

fn store_error(error: StoreError) -> DomainError {
    match error {
        StoreError::RevisionConflict { expected, actual } => {
            DomainError::RevisionConflict { expected, actual }
        }
        error => DomainError::Store(error),
    }
}

/// After an apply: a refusal that may follow a concurrent apply of the same
/// operation (R10), or a duplicate operation, replays the receipt.
async fn settle<S>(
    store: &S,
    actor: Actor,
    key: &ReplayKey<'_>,
    applied: Result<PermissionRequestOutcome, DomainError>,
) -> Result<PermissionRequestOutcome, DomainError>
where
    S: PermissionStore,
{
    match applied {
        Err(error @ DomainError::Store(StoreError::DuplicateOperation { .. })) => {
            match replay(store, actor, key).await? {
                Some(outcome) => Ok(outcome),
                None => Err(error),
            }
        }
        Err(error) if crate::commands::may_follow_concurrent_apply(&error) => {
            match replay(store, actor, key).await? {
                Some(outcome) => Ok(outcome),
                None => Err(error),
            }
        }
        result => result,
    }
}

async fn replay<S>(
    store: &S,
    actor: Actor,
    key: &ReplayKey<'_>,
) -> Result<Option<PermissionRequestOutcome>, DomainError>
where
    S: PermissionStore,
{
    let Some(receipt) = store
        .find_permission_receipt(key.operation_id)
        .await
        .map_err(DomainError::Store)?
    else {
        return Ok(None);
    };
    if receipt.principal_id != actor.principal_id
        || receipt.request_id != key.request_id
        || receipt.expected_revision != key.expected
        || receipt.request != key.request
    {
        return Err(DomainError::OperationConflict {
            operation_id: key.operation_id.clone(),
        });
    }
    let request = store
        .load_permission_request(receipt.request_id)
        .await
        .map_err(DomainError::Store)?
        .ok_or_else(|| {
            DomainError::Store(StoreError::Corrupt(
                "a permission receipt names a missing request".to_string(),
            ))
        })?;
    Ok(Some(PermissionRequestOutcome {
        receipt,
        request,
        replayed: true,
    }))
}
