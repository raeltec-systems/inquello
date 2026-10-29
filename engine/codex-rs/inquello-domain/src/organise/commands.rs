//! Organise commands and queries over the [`OrganiseStore`] port.
//!
//! Every command carries an operation ID and an expected revision (0 for a
//! creation) and follows the Story 1.4 pattern: validate the input before the
//! store is touched, answer a replay from its receipt, refuse a reused operation
//! ID, refuse a stale revision, then commit the record and its receipt in one
//! atomic step. The acting principal comes from the caller's session
//! ([`Actor`]), never from a command field.
//!
//! Tasks are private to their creator: a Task command from any other principal,
//! like one naming an unknown Task, fails with [`DomainError::NotFound`], and the
//! listing returns only the actor's own Tasks.

use crate::error::DomainError;
use crate::error::StoreError;
use crate::model::OperationId;
use crate::model::ReceiptStatus;
use crate::model::Revision;
use crate::organise::model::Engagement;
use crate::organise::model::EngagementId;
use crate::organise::model::Folder;
use crate::organise::model::FolderId;
use crate::organise::model::KnownWorkspace;
use crate::organise::model::OrganiseCommandKind;
use crate::organise::model::OrganiseOutcome;
use crate::organise::model::OrganiseReceipt;
use crate::organise::model::OrganiseRecord;
use crate::organise::model::PeriodDate;
use crate::organise::model::PrincipalId;
use crate::organise::model::ServiceEngagementId;
use crate::organise::model::Task;
use crate::organise::model::TaskId;
use crate::organise::model::Visibility;
use crate::organise::model::WorkspaceId;
use crate::organise::model::WorkspaceLabel;
use crate::organise::model::WorkspaceTree;
use crate::organise::model::parse_name;
use crate::organise::model::parse_optional_date;
use crate::organise::model::parse_optional_name;
use crate::organise::model::parse_text;
use crate::organise::model::parse_thread_ref;
use crate::organise::ports::OrganiseChange;
use crate::organise::ports::OrganiseStore;
use crate::ports::Clock;
use serde_json::json;
use uuid::Uuid;

/// The signed-in principal a command acts for, bound by the host from the
/// session (never from a payload).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Actor {
    pub principal_id: PrincipalId,
}

/// Creates the local record of a shared-service Engagement the host has
/// already created (Story 1.11). `expected_revision` must be 0.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CreateEngagement {
    pub operation_id: String,
    pub expected_revision: Revision,
    pub workspace_id: String,
    pub service_engagement_id: String,
    pub name: String,
    pub objectives: String,
    pub scope: String,
    pub client_entity: Option<String>,
    pub period_start: Option<String>,
    pub period_end: Option<String>,
}

/// Renames or edits an Engagement: every editable field is replaced.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct UpdateEngagement {
    pub operation_id: String,
    pub expected_revision: Revision,
    pub workspace_id: String,
    pub engagement_id: String,
    pub name: String,
    pub objectives: String,
    pub scope: String,
    pub client_entity: Option<String>,
    pub period_start: Option<String>,
    pub period_end: Option<String>,
}

/// Creates a folder in an Engagement. `expected_revision` must be 0.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CreateFolder {
    pub operation_id: String,
    pub expected_revision: Revision,
    pub workspace_id: String,
    pub engagement_id: String,
    pub name: String,
}

/// Creates a private Task for the actor: ad hoc (no Engagement), in an
/// Engagement, or in one of its folders. `expected_revision` must be 0.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CreateTask {
    pub operation_id: String,
    pub expected_revision: Revision,
    pub workspace_id: String,
    pub engagement_id: Option<String>,
    pub folder_id: Option<String>,
    pub title: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RenameTask {
    pub operation_id: String,
    pub expected_revision: Revision,
    pub workspace_id: String,
    pub task_id: String,
    pub title: String,
}

/// Moves a Task to another Engagement and folder of the same Workspace, or to
/// none. The Task keeps its ID, thread ref, references and visibility.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MoveTask {
    pub operation_id: String,
    pub expected_revision: Revision,
    pub workspace_id: String,
    pub task_id: String,
    pub engagement_id: Option<String>,
    pub folder_id: Option<String>,
}

/// Records the runtime thread a Task runs in.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AttachThread {
    pub operation_id: String,
    pub expected_revision: Revision,
    pub workspace_id: String,
    pub task_id: String,
    pub runtime_thread_id: String,
}

/// Remembers the name the actor sees for a shared-service Workspace.
/// `expected_revision` is the label's revision, 0 for a new one.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RememberWorkspace {
    pub operation_id: String,
    pub expected_revision: Revision,
    pub workspace_id: String,
    pub name: String,
}

/// A validated request, before the store is consulted.
struct Prepared {
    operation_id: OperationId,
    kind: OrganiseCommandKind,
    expected: Revision,
    request: String,
}

impl Prepared {
    fn new(
        operation_id: &str,
        kind: OrganiseCommandKind,
        expected: Revision,
        request: serde_json::Value,
    ) -> Result<Self, DomainError> {
        Ok(Self {
            operation_id: OperationId::parse(operation_id)?,
            kind,
            expected,
            request: request.to_string(),
        })
    }
}

fn require_creation(expected: Revision) -> Result<(), DomainError> {
    if expected == Revision::ZERO {
        Ok(())
    } else {
        Err(DomainError::RevisionConflict {
            expected,
            actual: Revision::ZERO,
        })
    }
}

fn check_revision(expected: Revision, actual: Revision) -> Result<(), DomainError> {
    if expected == actual {
        Ok(())
    } else {
        Err(DomainError::RevisionConflict { expected, actual })
    }
}

fn parse_optional<T>(
    value: Option<&str>,
    parse: impl FnOnce(&str) -> Result<T, DomainError>,
) -> Result<Option<T>, DomainError> {
    value.map(parse).transpose()
}

/// The validated editable fields of an Engagement.
struct EngagementFields {
    name: String,
    objectives: String,
    scope: String,
    client_entity: Option<String>,
    period_start: Option<PeriodDate>,
    period_end: Option<PeriodDate>,
}

impl EngagementFields {
    fn parse(
        name: &str,
        objectives: &str,
        scope: &str,
        client_entity: Option<&str>,
        period_start: Option<&str>,
        period_end: Option<&str>,
    ) -> Result<Self, DomainError> {
        let fields = Self {
            name: parse_name(name, "name")?,
            objectives: parse_text(objectives, "objectives")?,
            scope: parse_text(scope, "scope")?,
            client_entity: parse_optional_name(client_entity, "client_entity")?,
            period_start: parse_optional_date(period_start, "period_start")?,
            period_end: parse_optional_date(period_end, "period_end")?,
        };
        if let (Some(start), Some(end)) = (&fields.period_start, &fields.period_end)
            && end < start
        {
            return Err(DomainError::InvalidCommand(
                "period_end must not be before period_start".to_string(),
            ));
        }
        Ok(fields)
    }

    fn to_json(&self) -> serde_json::Value {
        json!({
            "name": self.name,
            "objectives": self.objectives,
            "scope": self.scope,
            "client_entity": self.client_entity,
            "period_start": self.period_start.as_ref().map(PeriodDate::as_str),
            "period_end": self.period_end.as_ref().map(PeriodDate::as_str),
        })
    }
}

/// Handles [`CreateEngagement`].
pub async fn create_engagement<S, C>(
    store: &S,
    clock: &C,
    actor: Actor,
    command: CreateEngagement,
) -> Result<OrganiseOutcome, DomainError>
where
    S: OrganiseStore,
    C: Clock,
{
    let workspace_id = WorkspaceId::parse(&command.workspace_id)?;
    let service_engagement_id = ServiceEngagementId::parse(&command.service_engagement_id)?;
    let fields = EngagementFields::parse(
        &command.name,
        &command.objectives,
        &command.scope,
        command.client_entity.as_deref(),
        command.period_start.as_deref(),
        command.period_end.as_deref(),
    )?;
    let prepared = Prepared::new(
        &command.operation_id,
        OrganiseCommandKind::CreateEngagement,
        command.expected_revision,
        json!({
            "workspace_id": workspace_id.to_string(),
            "service_engagement_id": service_engagement_id.to_string(),
            "fields": fields.to_json(),
        }),
    )?;
    if let Some(outcome) = replay(store, actor, &prepared).await? {
        return Ok(outcome);
    }
    require_creation(prepared.expected)?;
    if store
        .find_engagement_by_service_id(service_engagement_id)
        .await
        .map_err(DomainError::Store)?
        .is_some()
    {
        return Err(DomainError::InvalidCommand(
            "the shared-service Engagement already has a local record".to_string(),
        ));
    }
    let now = clock.now();
    let record = OrganiseRecord::Engagement(Engagement {
        engagement_id: EngagementId::new_random(),
        workspace_id,
        service_engagement_id,
        name: fields.name,
        objectives: fields.objectives,
        scope: fields.scope,
        client_entity: fields.client_entity,
        period_start: fields.period_start,
        period_end: fields.period_end,
        revision: prepared.expected.next()?,
        created_at: now,
        updated_at: now,
    });
    commit(store, clock, actor, &prepared, record).await
}

/// Handles [`UpdateEngagement`].
pub async fn update_engagement<S, C>(
    store: &S,
    clock: &C,
    actor: Actor,
    command: UpdateEngagement,
) -> Result<OrganiseOutcome, DomainError>
where
    S: OrganiseStore,
    C: Clock,
{
    let workspace_id = WorkspaceId::parse(&command.workspace_id)?;
    let engagement_id = EngagementId::parse(&command.engagement_id)?;
    let fields = EngagementFields::parse(
        &command.name,
        &command.objectives,
        &command.scope,
        command.client_entity.as_deref(),
        command.period_start.as_deref(),
        command.period_end.as_deref(),
    )?;
    let prepared = Prepared::new(
        &command.operation_id,
        OrganiseCommandKind::UpdateEngagement,
        command.expected_revision,
        json!({
            "workspace_id": workspace_id.to_string(),
            "engagement_id": engagement_id.to_string(),
            "fields": fields.to_json(),
        }),
    )?;
    if let Some(outcome) = replay(store, actor, &prepared).await? {
        return Ok(outcome);
    }
    let current = store
        .load_engagement(engagement_id)
        .await
        .map_err(DomainError::Store)?
        .filter(|engagement| engagement.workspace_id == workspace_id)
        .ok_or(DomainError::NotFound)?;
    check_revision(prepared.expected, current.revision)?;
    let record = OrganiseRecord::Engagement(Engagement {
        name: fields.name,
        objectives: fields.objectives,
        scope: fields.scope,
        client_entity: fields.client_entity,
        period_start: fields.period_start,
        period_end: fields.period_end,
        revision: prepared.expected.next()?,
        updated_at: clock.now(),
        ..current
    });
    commit(store, clock, actor, &prepared, record).await
}

/// Handles [`CreateFolder`].
pub async fn create_folder<S, C>(
    store: &S,
    clock: &C,
    actor: Actor,
    command: CreateFolder,
) -> Result<OrganiseOutcome, DomainError>
where
    S: OrganiseStore,
    C: Clock,
{
    let workspace_id = WorkspaceId::parse(&command.workspace_id)?;
    let engagement_id = EngagementId::parse(&command.engagement_id)?;
    let name = parse_name(&command.name, "name")?;
    let prepared = Prepared::new(
        &command.operation_id,
        OrganiseCommandKind::CreateFolder,
        command.expected_revision,
        json!({
            "workspace_id": workspace_id.to_string(),
            "engagement_id": engagement_id.to_string(),
            "name": name,
        }),
    )?;
    if let Some(outcome) = replay(store, actor, &prepared).await? {
        return Ok(outcome);
    }
    require_creation(prepared.expected)?;
    resolve_engagement(store, workspace_id, engagement_id).await?;
    let now = clock.now();
    let record = OrganiseRecord::Folder(Folder {
        folder_id: FolderId::new_random(),
        engagement_id,
        workspace_id,
        name,
        revision: prepared.expected.next()?,
        created_at: now,
        updated_at: now,
    });
    commit(store, clock, actor, &prepared, record).await
}

/// Handles [`CreateTask`].
pub async fn create_task<S, C>(
    store: &S,
    clock: &C,
    actor: Actor,
    command: CreateTask,
) -> Result<OrganiseOutcome, DomainError>
where
    S: OrganiseStore,
    C: Clock,
{
    let workspace_id = WorkspaceId::parse(&command.workspace_id)?;
    let engagement_id = parse_optional(command.engagement_id.as_deref(), EngagementId::parse)?;
    let folder_id = parse_optional(command.folder_id.as_deref(), FolderId::parse)?;
    let title = parse_name(&command.title, "title")?;
    let prepared = Prepared::new(
        &command.operation_id,
        OrganiseCommandKind::CreateTask,
        command.expected_revision,
        json!({
            "workspace_id": workspace_id.to_string(),
            "engagement_id": engagement_id.map(|id| id.to_string()),
            "folder_id": folder_id.map(|id| id.to_string()),
            "title": title,
        }),
    )?;
    if let Some(outcome) = replay(store, actor, &prepared).await? {
        return Ok(outcome);
    }
    require_creation(prepared.expected)?;
    resolve_target(store, workspace_id, engagement_id, folder_id).await?;
    let now = clock.now();
    let record = OrganiseRecord::Task(Task {
        task_id: TaskId::new_random(),
        workspace_id,
        creator_principal_id: actor.principal_id,
        engagement_id,
        folder_id,
        title,
        runtime_thread_id: None,
        source_refs: Vec::new(),
        artifact_refs: Vec::new(),
        visibility: Visibility::Private,
        revision: prepared.expected.next()?,
        created_at: now,
        updated_at: now,
    });
    commit(store, clock, actor, &prepared, record).await
}

/// Handles [`RenameTask`].
pub async fn rename_task<S, C>(
    store: &S,
    clock: &C,
    actor: Actor,
    command: RenameTask,
) -> Result<OrganiseOutcome, DomainError>
where
    S: OrganiseStore,
    C: Clock,
{
    let workspace_id = WorkspaceId::parse(&command.workspace_id)?;
    let task_id = TaskId::parse(&command.task_id)?;
    let title = parse_name(&command.title, "title")?;
    let prepared = Prepared::new(
        &command.operation_id,
        OrganiseCommandKind::RenameTask,
        command.expected_revision,
        json!({
            "workspace_id": workspace_id.to_string(),
            "task_id": task_id.to_string(),
            "title": title,
        }),
    )?;
    if let Some(outcome) = replay(store, actor, &prepared).await? {
        return Ok(outcome);
    }
    let current = visible_task(store, actor, workspace_id, task_id).await?;
    check_revision(prepared.expected, current.revision)?;
    let record = OrganiseRecord::Task(Task {
        title,
        revision: prepared.expected.next()?,
        updated_at: clock.now(),
        ..current
    });
    commit(store, clock, actor, &prepared, record).await
}

/// Handles [`MoveTask`]. Only the Engagement and folder change: the Task keeps
/// its ID, creator, thread ref, references and private visibility.
pub async fn move_task<S, C>(
    store: &S,
    clock: &C,
    actor: Actor,
    command: MoveTask,
) -> Result<OrganiseOutcome, DomainError>
where
    S: OrganiseStore,
    C: Clock,
{
    let workspace_id = WorkspaceId::parse(&command.workspace_id)?;
    let task_id = TaskId::parse(&command.task_id)?;
    let engagement_id = parse_optional(command.engagement_id.as_deref(), EngagementId::parse)?;
    let folder_id = parse_optional(command.folder_id.as_deref(), FolderId::parse)?;
    let prepared = Prepared::new(
        &command.operation_id,
        OrganiseCommandKind::MoveTask,
        command.expected_revision,
        json!({
            "workspace_id": workspace_id.to_string(),
            "task_id": task_id.to_string(),
            "engagement_id": engagement_id.map(|id| id.to_string()),
            "folder_id": folder_id.map(|id| id.to_string()),
        }),
    )?;
    if let Some(outcome) = replay(store, actor, &prepared).await? {
        return Ok(outcome);
    }
    let current = visible_task(store, actor, workspace_id, task_id).await?;
    check_revision(prepared.expected, current.revision)?;
    resolve_target(store, workspace_id, engagement_id, folder_id).await?;
    let record = OrganiseRecord::Task(Task {
        engagement_id,
        folder_id,
        revision: prepared.expected.next()?,
        updated_at: clock.now(),
        ..current
    });
    commit(store, clock, actor, &prepared, record).await
}

/// Handles [`AttachThread`].
pub async fn attach_thread<S, C>(
    store: &S,
    clock: &C,
    actor: Actor,
    command: AttachThread,
) -> Result<OrganiseOutcome, DomainError>
where
    S: OrganiseStore,
    C: Clock,
{
    let workspace_id = WorkspaceId::parse(&command.workspace_id)?;
    let task_id = TaskId::parse(&command.task_id)?;
    let runtime_thread_id = parse_thread_ref(&command.runtime_thread_id)?;
    let prepared = Prepared::new(
        &command.operation_id,
        OrganiseCommandKind::AttachThread,
        command.expected_revision,
        json!({
            "workspace_id": workspace_id.to_string(),
            "task_id": task_id.to_string(),
            "runtime_thread_id": runtime_thread_id,
        }),
    )?;
    if let Some(outcome) = replay(store, actor, &prepared).await? {
        return Ok(outcome);
    }
    let current = visible_task(store, actor, workspace_id, task_id).await?;
    check_revision(prepared.expected, current.revision)?;
    let record = OrganiseRecord::Task(Task {
        runtime_thread_id: Some(runtime_thread_id),
        revision: prepared.expected.next()?,
        updated_at: clock.now(),
        ..current
    });
    commit(store, clock, actor, &prepared, record).await
}

/// Handles [`RememberWorkspace`].
pub async fn remember_workspace<S, C>(
    store: &S,
    clock: &C,
    actor: Actor,
    command: RememberWorkspace,
) -> Result<OrganiseOutcome, DomainError>
where
    S: OrganiseStore,
    C: Clock,
{
    let workspace_id = WorkspaceId::parse(&command.workspace_id)?;
    let name = parse_name(&command.name, "name")?;
    let prepared = Prepared::new(
        &command.operation_id,
        OrganiseCommandKind::RememberWorkspace,
        command.expected_revision,
        json!({
            "workspace_id": workspace_id.to_string(),
            "name": name,
        }),
    )?;
    if let Some(outcome) = replay(store, actor, &prepared).await? {
        return Ok(outcome);
    }
    let actual = store
        .load_workspace_label(actor.principal_id, workspace_id)
        .await
        .map_err(DomainError::Store)?
        .map_or(Revision::ZERO, |label| label.revision);
    check_revision(prepared.expected, actual)?;
    let record = OrganiseRecord::WorkspaceLabel(WorkspaceLabel {
        principal_id: actor.principal_id,
        workspace_id,
        name,
        revision: prepared.expected.next()?,
        updated_at: clock.now(),
    });
    commit(store, clock, actor, &prepared, record).await
}

/// One Workspace's Engagements and folders, and only the actor's own Tasks.
pub async fn workspace_tree<S>(
    store: &S,
    actor: Actor,
    workspace_id: &str,
) -> Result<WorkspaceTree, DomainError>
where
    S: OrganiseStore,
{
    let workspace_id = WorkspaceId::parse(workspace_id)?;
    let mut tree = store
        .load_workspace_tree(workspace_id, actor.principal_id)
        .await
        .map_err(DomainError::Store)?;
    // The port already filters; this keeps the privacy rule in the domain too.
    tree.tasks
        .retain(|task| task.creator_principal_id == actor.principal_id);
    tree.engagements
        .retain(|engagement| engagement.workspace_id == workspace_id);
    tree.folders
        .retain(|folder| folder.workspace_id == workspace_id);
    tree.tasks.retain(|task| task.workspace_id == workspace_id);
    Ok(tree)
}

/// The Workspaces this device knows for the actor.
pub async fn known_workspaces<S>(
    store: &S,
    actor: Actor,
) -> Result<Vec<KnownWorkspace>, DomainError>
where
    S: OrganiseStore,
{
    store
        .load_known_workspaces(actor.principal_id)
        .await
        .map_err(DomainError::Store)
}

/// A Task in `workspace_id` that `actor` created; anything else is
/// indistinguishable from an unknown Task.
async fn visible_task<S>(
    store: &S,
    actor: Actor,
    workspace_id: WorkspaceId,
    task_id: TaskId,
) -> Result<Task, DomainError>
where
    S: OrganiseStore,
{
    store
        .load_task(task_id)
        .await
        .map_err(DomainError::Store)?
        .filter(|task| {
            task.workspace_id == workspace_id && task.creator_principal_id == actor.principal_id
        })
        .ok_or(DomainError::NotFound)
}

async fn resolve_engagement<S>(
    store: &S,
    workspace_id: WorkspaceId,
    engagement_id: EngagementId,
) -> Result<Engagement, DomainError>
where
    S: OrganiseStore,
{
    let engagement = store
        .load_engagement(engagement_id)
        .await
        .map_err(DomainError::Store)?
        .ok_or(DomainError::NotFound)?;
    if engagement.workspace_id != workspace_id {
        return Err(DomainError::WorkspaceMismatch);
    }
    Ok(engagement)
}

/// Checks a Task placement: no Engagement (ad hoc), an Engagement of the same
/// Workspace, or one of that Engagement's folders.
async fn resolve_target<S>(
    store: &S,
    workspace_id: WorkspaceId,
    engagement_id: Option<EngagementId>,
    folder_id: Option<FolderId>,
) -> Result<(), DomainError>
where
    S: OrganiseStore,
{
    let Some(engagement_id) = engagement_id else {
        return if folder_id.is_some() {
            Err(DomainError::InvalidCommand(
                "a folder target needs its Engagement".to_string(),
            ))
        } else {
            Ok(())
        };
    };
    resolve_engagement(store, workspace_id, engagement_id).await?;
    if let Some(folder_id) = folder_id {
        let folder = store
            .load_folder(folder_id)
            .await
            .map_err(DomainError::Store)?
            .ok_or(DomainError::NotFound)?;
        if folder.workspace_id != workspace_id {
            return Err(DomainError::WorkspaceMismatch);
        }
        if folder.engagement_id != engagement_id {
            return Err(DomainError::InvalidCommand(
                "the folder belongs to another Engagement".to_string(),
            ));
        }
    }
    Ok(())
}

/// Answers a repeated operation ID from its receipt and the record as it now is.
async fn replay<S>(
    store: &S,
    actor: Actor,
    prepared: &Prepared,
) -> Result<Option<OrganiseOutcome>, DomainError>
where
    S: OrganiseStore,
{
    let Some(receipt) = store
        .find_organise_receipt(&prepared.operation_id)
        .await
        .map_err(DomainError::Store)?
    else {
        return Ok(None);
    };
    let same_request = receipt.command == prepared.kind
        && receipt.principal_id == actor.principal_id
        && receipt.expected_revision == prepared.expected
        && receipt.request == prepared.request;
    if !same_request {
        return Err(DomainError::OperationConflict {
            operation_id: prepared.operation_id.clone(),
        });
    }
    let record = load_record(store, actor, receipt.command, receipt.resource_id).await?;
    Ok(Some(OrganiseOutcome {
        receipt,
        record,
        replayed: true,
    }))
}

async fn load_record<S>(
    store: &S,
    actor: Actor,
    kind: OrganiseCommandKind,
    resource_id: Uuid,
) -> Result<OrganiseRecord, DomainError>
where
    S: OrganiseStore,
{
    let missing = || {
        DomainError::Store(StoreError::Corrupt(format!(
            "a {} receipt names a missing record",
            kind.as_str()
        )))
    };
    let record = match kind {
        OrganiseCommandKind::CreateEngagement | OrganiseCommandKind::UpdateEngagement => store
            .load_engagement(EngagementId::from_uuid(resource_id))
            .await
            .map_err(DomainError::Store)?
            .map(OrganiseRecord::Engagement),
        OrganiseCommandKind::CreateFolder => store
            .load_folder(FolderId::from_uuid(resource_id))
            .await
            .map_err(DomainError::Store)?
            .map(OrganiseRecord::Folder),
        OrganiseCommandKind::CreateTask
        | OrganiseCommandKind::RenameTask
        | OrganiseCommandKind::MoveTask
        | OrganiseCommandKind::AttachThread => store
            .load_task(TaskId::from_uuid(resource_id))
            .await
            .map_err(DomainError::Store)?
            .map(OrganiseRecord::Task),
        OrganiseCommandKind::RememberWorkspace => store
            .load_workspace_label(actor.principal_id, WorkspaceId::from_uuid(resource_id))
            .await
            .map_err(DomainError::Store)?
            .map(OrganiseRecord::WorkspaceLabel),
    };
    record.ok_or_else(missing)
}

async fn commit<S, C>(
    store: &S,
    clock: &C,
    actor: Actor,
    prepared: &Prepared,
    record: OrganiseRecord,
) -> Result<OrganiseOutcome, DomainError>
where
    S: OrganiseStore,
    C: Clock,
{
    let receipt = OrganiseReceipt {
        operation_id: prepared.operation_id.clone(),
        principal_id: actor.principal_id,
        command: prepared.kind,
        resource_id: record.resource_id(),
        expected_revision: prepared.expected,
        resulting_revision: record.revision(),
        request: prepared.request.clone(),
        status: ReceiptStatus::Applied,
        recorded_at: clock.now(),
    };
    let change = OrganiseChange {
        expected_revision: prepared.expected,
        record: record.clone(),
        receipt: receipt.clone(),
    };
    match store.commit_organise(change).await {
        Ok(()) => Ok(OrganiseOutcome {
            receipt,
            record,
            replayed: false,
        }),
        Err(StoreError::RevisionConflict { expected, actual }) => {
            Err(DomainError::RevisionConflict { expected, actual })
        }
        Err(error @ StoreError::DuplicateOperation { .. }) => {
            // Another writer recorded this operation ID after our lookup.
            match replay(store, actor, prepared).await? {
                Some(outcome) => Ok(outcome),
                None => Err(DomainError::Store(error)),
            }
        }
        Err(error) => Err(DomainError::Store(error)),
    }
}

#[cfg(test)]
#[path = "commands_tests.rs"]
mod tests;
