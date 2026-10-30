use super::*;
use crate::organise::{Actor, TaskId};
use crate::{Clock, DomainError, OperationId, ReceiptStatus, Revision, StoreError};
use serde_json::json;

#[derive(Clone, Debug)]
pub struct ConfigureRoute {
    pub operation_id: String,
    pub expected_revision: Revision,
    pub configuration: RouteConfigurationInput,
}

#[derive(Clone, Debug)]
pub struct SetTaskRoute {
    pub operation_id: String,
    pub expected_revision: Revision,
    pub task_id: String,
    pub route_id: String,
    pub configuration_revision: Revision,
}

async fn require_creator<S: RouteStore>(store: &S, actor: Actor, task_id: TaskId) -> Result<RouteTask, DomainError> {
    match store.load_route_task(task_id).await.map_err(DomainError::Store)? {
        Some(task) if task.creator == actor.principal_id => Ok(task),
        _ => Err(DomainError::NotFound),
    }
}

pub async fn task_route<S: RouteStore>(store: &S, actor: Actor, task_id: &str) -> Result<TaskRoute, DomainError> {
    let task_id = TaskId::parse(task_id)?;
    let task = require_creator(store, actor, task_id).await?;
    let (revision, current) = store.load_task_route(task_id).await.map_err(DomainError::Store)?;
    let stale_configuration = if let Some(record) = &current {
        let (candidate_revision, _) = store.load_candidate_route(actor.principal_id, record.configuration.route_id())
            .await.map_err(DomainError::Store)?;
        candidate_revision != record.configuration_revision
    } else { false };
    Ok(TaskRoute { task_id, workspace_id: task.workspace_id, revision, current, stale_configuration })
}

/// Only the bound principal's candidates can be read. There is no caller-supplied owner.
pub async fn candidate_routes<S: RouteStore>(store: &S, actor: Actor) -> Result<Vec<CandidateRouteRecord>, DomainError> {
    let mut records = Vec::new();
    for id in RouteId::ALL {
        let (_, record) = store.load_candidate_route(actor.principal_id, id).await.map_err(DomainError::Store)?;
        if let Some(record) = record { records.push(record); }
    }
    Ok(records)
}

pub async fn configure_route<S: RouteStore, C: Clock>(store: &S, clock: &C, actor: Actor, command: ConfigureRoute) -> Result<CandidateRouteOutcome, DomainError> {
    let operation_id = OperationId::parse(&command.operation_id)?;
    let configuration = RouteConfiguration::parse(command.configuration)?;
    let request = serde_json::to_string(&configuration.input()).map_err(|_| DomainError::InvalidCommand("invalid route configuration".into()))?;
    let route_id = configuration.route_id();
    if let Some(outcome) = replay_candidate(store, actor, &operation_id, route_id, command.expected_revision, &request).await? { return Ok(outcome); }
    let record = CandidateRouteRecord {
        principal_id: actor.principal_id, configuration,
        revision: command.expected_revision.next()?, recorded_at: clock.now(),
    };
    let receipt = CandidateRouteReceipt {
        operation_id: operation_id.clone(), principal_id: actor.principal_id, route_id,
        expected_revision: command.expected_revision, resulting_revision: record.revision,
        request: request.clone(), status: ReceiptStatus::Applied, recorded_at: record.recorded_at,
    };
    let result = store.commit_candidate_route(CandidateRouteChange { expected_revision: command.expected_revision, record: record.clone(), receipt: receipt.clone() }).await;
    match result {
        Ok(()) => Ok(CandidateRouteOutcome { receipt, record, replayed: false }),
        Err(error) => {
            if matches!(error, StoreError::RevisionConflict { .. } | StoreError::DuplicateOperation { .. }) {
                if let Some(outcome) = replay_candidate(store, actor, &operation_id, route_id, command.expected_revision, &request).await? { return Ok(outcome); }
            }
            Err(domain_store(error))
        }
    }
}

async fn replay_candidate<S: RouteStore>(store: &S, actor: Actor, operation_id: &OperationId, route_id: RouteId, expected: Revision, request: &str) -> Result<Option<CandidateRouteOutcome>, DomainError> {
    let Some(receipt) = store.find_candidate_route_receipt(operation_id).await.map_err(domain_store)? else { return Ok(None); };
    if receipt.principal_id != actor.principal_id || receipt.route_id != route_id || receipt.expected_revision != expected || receipt.request != request {
        return Err(DomainError::OperationConflict { operation_id: operation_id.clone() });
    }
    let record = store.load_candidate_route_record(actor.principal_id, route_id, receipt.resulting_revision).await.map_err(DomainError::Store)?
        .ok_or_else(|| DomainError::Store(StoreError::Corrupt("route receipt names missing candidate".into())))?;
    Ok(Some(CandidateRouteOutcome { receipt, record, replayed: true }))
}

/// A selection is explicit and references an exact candidate revision. Selecting
/// any route (even the same route again) changes the attempt/continuation epoch.
/// The runtime must cancel old work before acknowledging the new revision.
pub async fn set_task_route<S: RouteStore, C: Clock>(store: &S, clock: &C, actor: Actor, command: SetTaskRoute) -> Result<RouteOutcome, DomainError> {
    let task_id = TaskId::parse(&command.task_id)?;
    // Privacy is checked before receipt lookup, including replays.
    require_creator(store, actor, task_id).await?;
    let operation_id = OperationId::parse(&command.operation_id)?;
    let route_id = RouteId::parse(&command.route_id).ok_or_else(|| DomainError::InvalidCommand("unsupported processing route".into()))?;
    let request = json!({ "task_id": task_id.to_string(), "route_id": route_id.as_str(), "configuration_revision": command.configuration_revision.get() }).to_string();
    if let Some(outcome) = replay_selection(store, actor, &operation_id, task_id, command.expected_revision, &request).await? { return Ok(outcome); }
    let (candidate_revision, candidate) = store.load_candidate_route(actor.principal_id, route_id).await.map_err(DomainError::Store)?;
    if candidate_revision != command.configuration_revision {
        // A concurrent identical operation may have committed before the
        // candidate was replaced. Re-read its receipt before returning stale.
        if let Some(outcome) = replay_selection(store, actor, &operation_id, task_id, command.expected_revision, &request).await? { return Ok(outcome); }
        return Err(DomainError::RevisionConflict { expected: command.configuration_revision, actual: candidate_revision });
    }
    let candidate = candidate.ok_or_else(|| DomainError::InvalidCommand("configure the selected route first".into()))?;
    let record = TaskRouteRecord {
        task_id, configuration_revision: candidate.revision, configuration: candidate.configuration,
        principal_id: actor.principal_id, revision: command.expected_revision.next()?, recorded_at: clock.now(),
    };
    let receipt = RouteReceipt {
        operation_id: operation_id.clone(), principal_id: actor.principal_id, task_id,
        expected_revision: command.expected_revision, resulting_revision: record.revision,
        request: request.clone(), status: ReceiptStatus::Applied, recorded_at: record.recorded_at,
    };
    match store.commit_task_route(RouteChange { expected_revision: command.expected_revision, record: record.clone(), receipt: receipt.clone() }).await {
        Ok(()) => Ok(RouteOutcome { receipt, record, replayed: false }),
        Err(error) => {
            if matches!(error, StoreError::RevisionConflict { .. } | StoreError::DuplicateOperation { .. }) {
                if let Some(outcome) = replay_selection(store, actor, &operation_id, task_id, command.expected_revision, &request).await? { return Ok(outcome); }
            }
            Err(domain_store(error))
        }
    }
}

async fn replay_selection<S: RouteStore>(store: &S, actor: Actor, operation_id: &OperationId, task_id: TaskId, expected: Revision, request: &str) -> Result<Option<RouteOutcome>, DomainError> {
    let Some(receipt) = store.find_route_receipt(operation_id).await.map_err(domain_store)? else { return Ok(None); };
    if receipt.principal_id != actor.principal_id || receipt.task_id != task_id || receipt.expected_revision != expected || receipt.request != request {
        return Err(DomainError::OperationConflict { operation_id: operation_id.clone() });
    }
    let record = store.load_task_route_record(task_id, receipt.resulting_revision).await.map_err(DomainError::Store)?
        .ok_or_else(|| DomainError::Store(StoreError::Corrupt("route receipt names missing selection".into())))?;
    Ok(Some(RouteOutcome { receipt, record, replayed: true }))
}

fn domain_store(error: StoreError) -> DomainError {
    match error {
        StoreError::RevisionConflict { expected, actual } => DomainError::RevisionConflict { expected, actual },
        StoreError::DuplicateOperation { operation_id } => DomainError::OperationConflict { operation_id },
        error => DomainError::Store(error),
    }
}
