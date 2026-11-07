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

async fn require_creator<S: RouteStore>(
    store: &S,
    actor: Actor,
    task_id: TaskId,
) -> Result<RouteTask, DomainError> {
    match store
        .load_route_task(task_id)
        .await
        .map_err(DomainError::Store)?
    {
        Some(task) if task.creator == actor.principal_id => Ok(task),
        _ => Err(DomainError::NotFound),
    }
}

pub async fn task_route<S: RouteStore>(
    store: &S,
    actor: Actor,
    task_id: &str,
) -> Result<TaskRoute, DomainError> {
    let task_id = TaskId::parse(task_id)?;
    let task = require_creator(store, actor, task_id).await?;
    let (revision, current) = store
        .load_task_route(task_id)
        .await
        .map_err(DomainError::Store)?;
    let stale_configuration = if let Some(record) = &current {
        let binding = store
            .load_configuration_binding(
                actor.principal_id,
                record.configuration.route_id(),
                record.configuration_revision,
            )
            .await
            .map_err(DomainError::Store)?;
        binding.is_none_or(|binding| binding.state != ModelBindingState::Active)
    } else {
        false
    };
    Ok(TaskRoute {
        task_id,
        workspace_id: task.workspace_id,
        revision,
        current,
        stale_configuration,
    })
}

/// Only the bound principal's candidates can be read. There is no caller-supplied owner.
pub async fn candidate_routes<S: RouteStore>(
    store: &S,
    actor: Actor,
) -> Result<Vec<CandidateRouteRecord>, DomainError> {
    let mut records = Vec::new();
    for id in RouteId::ALL {
        let (_, record) = store
            .load_candidate_route(actor.principal_id, id)
            .await
            .map_err(DomainError::Store)?;
        if let Some(record) = record {
            records.push(record);
        }
    }
    Ok(records)
}

pub async fn active_candidate<S: RouteStore>(
    store: &S,
    actor: Actor,
    route_id: RouteId,
    revision: Revision,
) -> Result<CandidateRouteRecord, DomainError> {
    store
        .load_configuration_binding(actor.principal_id, route_id, revision)
        .await
        .map_err(domain_store)?
        .filter(|binding| binding.state == ModelBindingState::Active)
        .map(|binding| binding.candidate)
        .ok_or_else(|| DomainError::InvalidCommand("selected model binding is unavailable".into()))
}

pub async fn configure_route<S: RouteStore, C: Clock>(
    store: &S,
    clock: &C,
    actor: Actor,
    command: ConfigureRoute,
) -> Result<CandidateRouteOutcome, DomainError> {
    configure_binding(store, clock, actor, command, None).await
}

pub async fn resolve_model_binding<S: RouteStore, C: Clock>(
    store: &S,
    clock: &C,
    actor: Actor,
    command: ConfigureRoute,
    catalog_version: &str,
    choice_id: &str,
) -> Result<CandidateRouteOutcome, DomainError> {
    configure_binding(
        store,
        clock,
        actor,
        command,
        Some((catalog_version, choice_id)),
    )
    .await
}

async fn configure_binding<S: RouteStore, C: Clock>(
    store: &S,
    clock: &C,
    actor: Actor,
    command: ConfigureRoute,
    catalog: Option<(&str, &str)>,
) -> Result<CandidateRouteOutcome, DomainError> {
    let operation_id = OperationId::parse(&command.operation_id)?;
    let configuration = RouteConfiguration::parse(command.configuration)?;
    let command_kind = if catalog.is_some() {
        RESOLVE_MODEL_BINDING_COMMAND
    } else {
        CONFIGURE_ROUTE_COMMAND
    };
    let request = if let Some((version, choice)) = catalog {
        json!({"catalog_version":version,"choice_id":choice,"configuration":configuration.input()})
            .to_string()
    } else {
        serde_json::to_string(&configuration.input())
            .map_err(|_| DomainError::InvalidCommand("invalid route configuration".into()))?
    };
    let route_id = configuration.route_id();
    if let Some(outcome) = replay_candidate(
        store,
        actor,
        &operation_id,
        route_id,
        command_kind,
        command.expected_revision,
        &request,
    )
    .await?
    {
        return Ok(outcome);
    }
    let record = CandidateRouteRecord {
        principal_id: actor.principal_id,
        configuration,
        revision: command.expected_revision.next()?,
        recorded_at: clock.now(),
    };
    let receipt = CandidateRouteReceipt {
        operation_id: operation_id.clone(),
        command: command_kind.into(),
        principal_id: actor.principal_id,
        route_id,
        expected_revision: command.expected_revision,
        resulting_revision: record.revision,
        request: request.clone(),
        status: ReceiptStatus::Applied,
        recorded_at: record.recorded_at,
    };
    let result = store
        .commit_candidate_route(CandidateRouteChange {
            expected_revision: command.expected_revision,
            record: record.clone(),
            receipt: receipt.clone(),
        })
        .await;
    match result {
        Ok(()) => Ok(CandidateRouteOutcome {
            receipt,
            record,
            replayed: false,
        }),
        Err(error) => {
            if matches!(
                error,
                StoreError::RevisionConflict { .. } | StoreError::DuplicateOperation { .. }
            ) && let Some(outcome) = replay_candidate(
                store,
                actor,
                &operation_id,
                route_id,
                command_kind,
                command.expected_revision,
                &request,
            )
            .await?
            {
                return Ok(outcome);
            }
            Err(domain_store(error))
        }
    }
}

async fn replay_candidate<S: RouteStore>(
    store: &S,
    actor: Actor,
    operation_id: &OperationId,
    route_id: RouteId,
    command_kind: &str,
    expected: Revision,
    request: &str,
) -> Result<Option<CandidateRouteOutcome>, DomainError> {
    let Some(receipt) = store
        .find_candidate_route_receipt(operation_id)
        .await
        .map_err(domain_store)?
    else {
        return Ok(None);
    };
    if receipt.principal_id != actor.principal_id
        || receipt.command != command_kind
        || receipt.route_id != route_id
        || receipt.expected_revision != expected
        || receipt.request != request
    {
        return Err(DomainError::OperationConflict {
            operation_id: operation_id.clone(),
        });
    }
    let record = store
        .load_candidate_route_record(actor.principal_id, route_id, receipt.resulting_revision)
        .await
        .map_err(DomainError::Store)?
        .ok_or_else(|| {
            DomainError::Store(StoreError::Corrupt(
                "route receipt names missing candidate".into(),
            ))
        })?;
    Ok(Some(CandidateRouteOutcome {
        receipt,
        record,
        replayed: true,
    }))
}

/// A selection is explicit and references an exact candidate revision. Selecting
/// any route (even the same route again) changes the attempt/continuation epoch.
/// The runtime must cancel old work before acknowledging the new revision.
pub async fn set_task_route<S: RouteStore, C: Clock>(
    store: &S,
    clock: &C,
    actor: Actor,
    command: SetTaskRoute,
) -> Result<RouteOutcome, DomainError> {
    set_task_route_with_usage(store, clock, actor, command, None).await
}

/// Align compatible choices and selection under the same receipt and transaction.
pub async fn set_task_route_with_usage<S: RouteStore, C: Clock>(
    store: &S,
    clock: &C,
    actor: Actor,
    command: SetTaskRoute,
    usage_capabilities: Option<SelectionUsageCapabilities>,
) -> Result<RouteOutcome, DomainError> {
    let task_id = TaskId::parse(&command.task_id)?;
    // Privacy is checked before receipt lookup, including replays.
    require_creator(store, actor, task_id).await?;
    let operation_id = OperationId::parse(&command.operation_id)?;
    let route_id = RouteId::parse(&command.route_id)
        .ok_or_else(|| DomainError::InvalidCommand("unsupported processing route".into()))?;
    let request = json!({ "task_id": task_id.to_string(), "route_id": route_id.as_str(), "configuration_revision": command.configuration_revision.get() }).to_string();
    if let Some(outcome) = replay_selection(
        store,
        actor,
        &operation_id,
        task_id,
        command.expected_revision,
        &request,
    )
    .await?
    {
        return Ok(outcome);
    }
    let binding = store
        .load_configuration_binding(actor.principal_id, route_id, command.configuration_revision)
        .await
        .map_err(DomainError::Store)?;
    if binding
        .as_ref()
        .is_none_or(|binding| binding.state != ModelBindingState::Active)
    {
        // A concurrent identical operation may have committed before the
        // candidate was replaced. Re-read its receipt before returning stale.
        if let Some(outcome) = replay_selection(
            store,
            actor,
            &operation_id,
            task_id,
            command.expected_revision,
            &request,
        )
        .await?
        {
            return Ok(outcome);
        }
        return Err(DomainError::InvalidCommand(
            "selected model binding is unavailable".into(),
        ));
    }
    let binding =
        binding.ok_or_else(|| DomainError::InvalidCommand("choose a model first".into()))?;
    let binding_revision = binding.revision;
    let candidate = binding.candidate;
    let record = TaskRouteRecord {
        task_id,
        configuration_revision: candidate.revision,
        configuration: candidate.configuration,
        principal_id: actor.principal_id,
        revision: command.expected_revision.next()?,
        recorded_at: clock.now(),
    };
    let receipt = RouteReceipt {
        operation_id: operation_id.clone(),
        principal_id: actor.principal_id,
        task_id,
        expected_revision: command.expected_revision,
        resulting_revision: record.revision,
        request: request.clone(),
        status: ReceiptStatus::Applied,
        recorded_at: record.recorded_at,
    };
    match store
        .commit_task_route(RouteChange {
            usage_capabilities,
            expected_revision: command.expected_revision,
            expected_binding_revision: binding_revision,
            record: record.clone(),
            receipt: receipt.clone(),
        })
        .await
    {
        Ok(()) => Ok(RouteOutcome {
            receipt,
            record,
            replayed: false,
        }),
        Err(error) => {
            if matches!(
                error,
                StoreError::RevisionConflict { .. } | StoreError::DuplicateOperation { .. }
            ) && let Some(outcome) = replay_selection(
                store,
                actor,
                &operation_id,
                task_id,
                command.expected_revision,
                &request,
            )
            .await?
            {
                return Ok(outcome);
            }
            Err(domain_store(error))
        }
    }
}

async fn replay_selection<S: RouteStore>(
    store: &S,
    actor: Actor,
    operation_id: &OperationId,
    task_id: TaskId,
    expected: Revision,
    request: &str,
) -> Result<Option<RouteOutcome>, DomainError> {
    let Some(receipt) = store
        .find_route_receipt(operation_id)
        .await
        .map_err(domain_store)?
    else {
        return Ok(None);
    };
    if receipt.principal_id != actor.principal_id
        || receipt.task_id != task_id
        || receipt.expected_revision != expected
        || receipt.request != request
    {
        return Err(DomainError::OperationConflict {
            operation_id: operation_id.clone(),
        });
    }
    let record = store
        .load_task_route_record(task_id, receipt.resulting_revision)
        .await
        .map_err(DomainError::Store)?
        .ok_or_else(|| {
            DomainError::Store(StoreError::Corrupt(
                "route receipt names missing selection".into(),
            ))
        })?;
    Ok(Some(RouteOutcome {
        receipt,
        record,
        replayed: true,
    }))
}

fn domain_store(error: StoreError) -> DomainError {
    match error {
        StoreError::RevisionConflict { expected, actual } => {
            DomainError::RevisionConflict { expected, actual }
        }
        StoreError::DuplicateOperation { operation_id } => {
            DomainError::OperationConflict { operation_id }
        }
        error => DomainError::Store(error),
    }
}

/// Trusted callers must establish exact credential and qualification authority
/// before revalidating legacy configuration. Revoked identities are permanent.
pub async fn change_model_binding_state<S: RouteStore, C: Clock>(
    store: &S,
    clock: &C,
    actor: Actor,
    operation: &str,
    binding_id: &str,
    expected_revision: Revision,
    target: ModelBindingState,
) -> Result<ModelBindingOutcome, DomainError> {
    let operation_id = OperationId::parse(operation)?;
    let binding_id = uuid::Uuid::parse_str(binding_id)
        .map_err(|_| DomainError::InvalidCommand("invalid model binding".into()))?
        .to_string();
    let binding = store
        .load_model_binding(actor.principal_id, &binding_id)
        .await
        .map_err(domain_store)?
        .ok_or(DomainError::NotFound)?;
    let command = match target {
        ModelBindingState::Revoked => REVOKE_MODEL_BINDING_COMMAND,
        ModelBindingState::Active => REVALIDATE_MODEL_BINDING_COMMAND,
        ModelBindingState::LegacySuperseded => {
            return Err(DomainError::InvalidCommand(
                "invalid model binding transition".into(),
            ));
        }
    };
    let request = json!({"binding_id": binding_id, "state": target.as_str()}).to_string();
    let replay = |receipt: ModelBindingReceipt| -> Result<ModelBindingOutcome, DomainError> {
        if receipt.principal_id != actor.principal_id
            || receipt.binding_id != binding_id
            || receipt.expected_revision != expected_revision
            || receipt.request != request
        {
            return Err(DomainError::OperationConflict {
                operation_id: operation_id.clone(),
            });
        }
        Ok(ModelBindingOutcome {
            binding: ModelBinding {
                state: target,
                revision: receipt.resulting_revision,
                ..binding.clone()
            },
            receipt,
            replayed: true,
        })
    };
    if let Some(receipt) = store
        .find_model_binding_receipt(&operation_id, command)
        .await
        .map_err(domain_store)?
    {
        return replay(receipt);
    }
    if binding.revision != expected_revision {
        return Err(DomainError::RevisionConflict {
            expected: expected_revision,
            actual: binding.revision,
        });
    }
    if binding.state == ModelBindingState::Revoked
        || (target == ModelBindingState::Active
            && binding.state != ModelBindingState::LegacySuperseded)
    {
        return Err(DomainError::InvalidCommand(
            "model binding cannot be reactivated".into(),
        ));
    }
    let receipt = ModelBindingReceipt {
        operation_id: operation_id.clone(),
        principal_id: actor.principal_id,
        binding_id: binding_id.clone(),
        command: command.into(),
        expected_revision,
        resulting_revision: expected_revision.next()?,
        request: request.clone(),
        recorded_at: clock.now(),
    };
    if let Err(error) = store
        .commit_model_binding_state(receipt.clone(), target)
        .await
    {
        if matches!(
            error,
            StoreError::RevisionConflict { .. } | StoreError::DuplicateOperation { .. }
        ) && let Some(receipt) = store
            .find_model_binding_receipt(&operation_id, command)
            .await
            .map_err(domain_store)?
        {
            return replay(receipt);
        }
        return Err(domain_store(error));
    }
    Ok(ModelBindingOutcome {
        binding: ModelBinding {
            state: target,
            revision: receipt.resulting_revision,
            ..binding
        },
        receipt,
        replayed: false,
    })
}
