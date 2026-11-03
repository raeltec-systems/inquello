//! Atomic processing-route records. No runtime credential/evidence state is stored.
use crate::SqliteWorkingStore;
use inquello_domain::organise::{PrincipalId, TaskId, WorkspaceId};
use inquello_domain::routes::*;
use inquello_domain::{OperationId, ReceiptStatus, Revision, StoreError, Timestamp};
use sqlx::sqlite::SqliteRow;
use sqlx::{Row, Sqlite, Transaction};
use uuid::Uuid;

const SELECTION_COLUMNS: &str = "t.task_id, t.revision, t.principal_id, t.route_id, t.configuration_revision, t.recorded_at_ms, c.configuration";
const SELECTION_JOIN: &str = "task_processing_routes t JOIN processing_route_candidates c ON c.principal_id = t.principal_id AND c.route_id = t.route_id AND c.revision = t.configuration_revision";

impl SqliteWorkingStore {
    /// Trusted disclosure dependencies: current choice plus retained executions,
    /// never a previous selection that did not execute. One extra row detects
    /// overflow; the processor refuses instead of silently dropping a dependency.
    pub async fn task_model_disclosure_bindings(
        &self,
        principal: PrincipalId,
        task: TaskId,
    ) -> Result<Vec<(RouteId, Revision, bool)>, StoreError> {
        let rows=sqlx::query("WITH refs(route_id,configuration_revision) AS (SELECT route_id,configuration_revision FROM task_processing_routes t WHERE t.principal_id=?1 AND t.task_id=?2 AND t.revision=(SELECT MAX(latest.revision) FROM task_processing_routes latest WHERE latest.task_id=t.task_id) UNION SELECT json_extract(record,'$.route_id'),json_extract(record,'$.configuration_revision') FROM task_runs WHERE principal_id=?1 AND task_id=?2 UNION SELECT json_extract(record,'$.route_id'),json_extract(record,'$.configuration_revision') FROM task_run_history WHERE task_id=?2 AND json_extract(record,'$.principal_id')=?1) SELECT refs.route_id,refs.configuration_revision,b.state FROM refs LEFT JOIN processing_model_bindings b ON b.principal_id=?1 AND b.route_id=refs.route_id AND b.configuration_revision=refs.configuration_revision WHERE EXISTS(SELECT 1 FROM tasks owned WHERE owned.task_id=?2 AND owned.creator_principal_id=?1) ORDER BY refs.route_id,refs.configuration_revision LIMIT 1025")
            .bind(principal.to_string()).bind(task.to_string()).fetch_all(self.pool()).await.map_err(backend)?;
        rows.iter()
            .map(|row| {
                let route = RouteId::parse(&text(row, "route_id")?)
                    .ok_or_else(|| corrupt("invalid disclosure route"))?;
                let state: Option<String> = row.try_get("state").map_err(backend)?;
                Ok((
                    route,
                    rev(row, "configuration_revision")?,
                    state.as_deref() == Some("active"),
                ))
            })
            .collect()
    }
}

impl RouteStore for SqliteWorkingStore {
    async fn tasks_for_model_binding(
        &self,
        principal_id: PrincipalId,
        route_id: RouteId,
        revision: Revision,
    ) -> Result<Vec<TaskId>, StoreError> {
        let rows = sqlx::query("SELECT owned.task_id FROM tasks owned WHERE owned.creator_principal_id=?1 AND (EXISTS(SELECT 1 FROM task_processing_routes t WHERE t.task_id=owned.task_id AND t.principal_id=?1 AND t.route_id=?2 AND t.configuration_revision=?3 AND t.revision=(SELECT MAX(current.revision) FROM task_processing_routes current WHERE current.task_id=t.task_id)) OR EXISTS(SELECT 1 FROM task_runs r WHERE r.task_id=owned.task_id AND r.principal_id=?1 AND json_extract(r.record,'$.route_id')=?2 AND json_extract(r.record,'$.configuration_revision')=?3) OR EXISTS(SELECT 1 FROM task_run_history h WHERE h.task_id=owned.task_id AND json_extract(h.record,'$.principal_id')=?1 AND json_extract(h.record,'$.route_id')=?2 AND json_extract(h.record,'$.configuration_revision')=?3)) ORDER BY owned.task_id")
            .bind(principal_id.to_string()).bind(route_id.as_str()).bind(db(revision)?).fetch_all(self.pool()).await.map_err(backend)?;
        rows.iter()
            .map(|row| uuid(row, "task_id").map(TaskId::from_uuid))
            .collect()
    }
    async fn list_model_bindings(
        &self,
        principal_id: PrincipalId,
    ) -> Result<Vec<ModelBinding>, StoreError> {
        let rows = sqlx::query("SELECT c.*, b.binding_id, b.state, b.revision AS binding_revision FROM processing_model_bindings b JOIN processing_route_candidates c ON c.principal_id=b.principal_id AND c.route_id=b.route_id AND c.revision=b.configuration_revision WHERE b.principal_id=? ORDER BY c.route_id, c.revision")
            .bind(principal_id.to_string()).fetch_all(self.pool()).await.map_err(backend)?;
        rows.iter().map(binding).collect()
    }

    async fn load_model_binding(
        &self,
        principal_id: PrincipalId,
        binding_id: &str,
    ) -> Result<Option<ModelBinding>, StoreError> {
        let row = sqlx::query("SELECT c.*, b.binding_id, b.state, b.revision AS binding_revision FROM processing_model_bindings b JOIN processing_route_candidates c ON c.principal_id=b.principal_id AND c.route_id=b.route_id AND c.revision=b.configuration_revision WHERE b.principal_id=? AND b.binding_id=?")
            .bind(principal_id.to_string()).bind(binding_id).fetch_optional(self.pool()).await.map_err(backend)?;
        row.as_ref().map(binding).transpose()
    }

    async fn load_configuration_binding(
        &self,
        principal_id: PrincipalId,
        route_id: RouteId,
        revision: Revision,
    ) -> Result<Option<ModelBinding>, StoreError> {
        let row = sqlx::query("SELECT c.*, b.binding_id, b.state, b.revision AS binding_revision FROM processing_model_bindings b JOIN processing_route_candidates c ON c.principal_id=b.principal_id AND c.route_id=b.route_id AND c.revision=b.configuration_revision WHERE b.principal_id=? AND b.route_id=? AND b.configuration_revision=?")
            .bind(principal_id.to_string()).bind(route_id.as_str()).bind(db(revision)?).fetch_optional(self.pool()).await.map_err(backend)?;
        row.as_ref().map(binding).transpose()
    }

    async fn find_model_binding_receipt(
        &self,
        operation_id: &OperationId,
        command: &str,
    ) -> Result<Option<ModelBindingReceipt>, StoreError> {
        let row = sqlx::query("SELECT * FROM processing_route_receipts WHERE operation_id=?")
            .bind(operation_id.as_str())
            .fetch_optional(self.pool())
            .await
            .map_err(backend)?;
        let Some(row) = row else {
            return Ok(None);
        };
        if text(&row, "command")? != command {
            return Err(StoreError::DuplicateOperation {
                operation_id: operation_id.clone(),
            });
        }
        Ok(Some(ModelBindingReceipt {
            operation_id: operation_id.clone(),
            principal_id: PrincipalId::from_uuid(uuid(&row, "principal_id")?),
            binding_id: text(&row, "scope_id")?,
            command: command.into(),
            expected_revision: rev(&row, "expected_revision")?,
            resulting_revision: rev(&row, "resulting_revision")?,
            request: text(&row, "request")?,
            recorded_at: timestamp(&row)?,
        }))
    }

    async fn commit_model_binding_state(
        &self,
        receipt: ModelBindingReceipt,
        state: ModelBindingState,
    ) -> Result<(), StoreError> {
        let source = match (receipt.command.as_str(), state) {
            (REVOKE_MODEL_BINDING_COMMAND, ModelBindingState::Revoked) => None,
            (REVALIDATE_MODEL_BINDING_COMMAND, ModelBindingState::Active) => {
                Some("legacy-superseded")
            }
            _ => return Err(corrupt("invalid model binding transition")),
        };
        let expected_request =
            serde_json::json!({"binding_id": receipt.binding_id, "state": state.as_str()})
                .to_string();
        if receipt.expected_revision.next().ok() != Some(receipt.resulting_revision)
            || receipt.request != expected_request
        {
            return Err(corrupt("inconsistent model binding change"));
        }
        let mut tx = self
            .pool()
            .begin_with("BEGIN IMMEDIATE")
            .await
            .map_err(backend)?;
        check_operation(&mut tx, &receipt.operation_id).await?;
        let row = sqlx::query("SELECT revision, state FROM processing_model_bindings WHERE principal_id=? AND binding_id=?")
            .bind(receipt.principal_id.to_string()).bind(&receipt.binding_id).fetch_optional(&mut *tx).await.map_err(backend)?
            .ok_or_else(|| corrupt("missing owned model binding"))?;
        check_revision(
            receipt.expected_revision,
            row.try_get("revision").map_err(backend)?,
        )?;
        let old_state = text(&row, "state")?;
        if old_state == "revoked" || source.is_some_and(|required| old_state != required) {
            return Err(corrupt("model binding transition unavailable"));
        }
        sqlx::query("UPDATE processing_model_bindings SET state=?, revision=? WHERE principal_id=? AND binding_id=?")
            .bind(state.as_str()).bind(db(receipt.resulting_revision)?).bind(receipt.principal_id.to_string()).bind(&receipt.binding_id)
            .execute(&mut *tx).await.map_err(backend)?;
        insert_receipt(
            &mut tx,
            &receipt.operation_id,
            receipt.principal_id,
            &receipt.command,
            &receipt.binding_id,
            receipt.expected_revision,
            receipt.resulting_revision,
            &receipt.request,
            receipt.recorded_at,
        )
        .await?;
        tx.commit().await.map_err(backend)
    }

    async fn load_route_task(&self, task_id: TaskId) -> Result<Option<RouteTask>, StoreError> {
        let row =
            sqlx::query("SELECT creator_principal_id, workspace_id FROM tasks WHERE task_id = ?")
                .bind(task_id.to_string())
                .fetch_optional(self.pool())
                .await
                .map_err(backend)?;
        row.map(|r| {
            Ok(RouteTask {
                creator: PrincipalId::from_uuid(uuid(&r, "creator_principal_id")?),
                workspace_id: WorkspaceId::from_uuid(uuid(&r, "workspace_id")?),
            })
        })
        .transpose()
    }

    async fn load_task_route(
        &self,
        task_id: TaskId,
    ) -> Result<(Revision, Option<TaskRouteRecord>), StoreError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT {SELECTION_COLUMNS} FROM {SELECTION_JOIN} WHERE t.task_id = ? ORDER BY t.revision DESC LIMIT 1")))
            .bind(task_id.to_string()).fetch_optional(self.pool()).await.map_err(backend)?;
        let record = row.as_ref().map(selection).transpose()?;
        Ok((
            record.as_ref().map_or(Revision::ZERO, |r| r.revision),
            record,
        ))
    }

    async fn load_task_route_record(
        &self,
        task_id: TaskId,
        revision: Revision,
    ) -> Result<Option<TaskRouteRecord>, StoreError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT {SELECTION_COLUMNS} FROM {SELECTION_JOIN} WHERE t.task_id = ? AND t.revision = ?")))
            .bind(task_id.to_string()).bind(db(revision)?).fetch_optional(self.pool()).await.map_err(backend)?;
        row.as_ref().map(selection).transpose()
    }

    async fn find_route_receipt(
        &self,
        operation_id: &OperationId,
    ) -> Result<Option<RouteReceipt>, StoreError> {
        let row = sqlx::query("SELECT * FROM processing_route_receipts WHERE operation_id = ?")
            .bind(operation_id.as_str())
            .fetch_optional(self.pool())
            .await
            .map_err(backend)?;
        let Some(row) = row else {
            return Ok(None);
        };
        // An operation cannot be reused across candidate/selection commands.
        if text(&row, "command")? != SET_TASK_ROUTE_COMMAND {
            return Err(StoreError::DuplicateOperation {
                operation_id: operation_id.clone(),
            });
        }
        Ok(Some(RouteReceipt {
            operation_id: operation_id.clone(),
            principal_id: PrincipalId::from_uuid(uuid(&row, "principal_id")?),
            task_id: TaskId::from_uuid(uuid(&row, "scope_id")?),
            expected_revision: rev(&row, "expected_revision")?,
            resulting_revision: rev(&row, "resulting_revision")?,
            request: text(&row, "request")?,
            status: receipt_status(&row)?,
            recorded_at: timestamp(&row)?,
        }))
    }

    async fn load_candidate_route(
        &self,
        principal_id: PrincipalId,
        route_id: RouteId,
    ) -> Result<(Revision, Option<CandidateRouteRecord>), StoreError> {
        let row = sqlx::query("SELECT * FROM processing_route_candidates WHERE principal_id = ? AND route_id = ? ORDER BY revision DESC LIMIT 1")
            .bind(principal_id.to_string()).bind(route_id.as_str()).fetch_optional(self.pool()).await.map_err(backend)?;
        let record = row.as_ref().map(candidate).transpose()?;
        Ok((
            record.as_ref().map_or(Revision::ZERO, |r| r.revision),
            record,
        ))
    }

    async fn load_candidate_route_record(
        &self,
        principal_id: PrincipalId,
        route_id: RouteId,
        revision: Revision,
    ) -> Result<Option<CandidateRouteRecord>, StoreError> {
        let row = sqlx::query("SELECT * FROM processing_route_candidates WHERE principal_id = ? AND route_id = ? AND revision = ?")
            .bind(principal_id.to_string()).bind(route_id.as_str()).bind(db(revision)?).fetch_optional(self.pool()).await.map_err(backend)?;
        row.as_ref().map(candidate).transpose()
    }

    async fn find_candidate_route_receipt(
        &self,
        operation_id: &OperationId,
    ) -> Result<Option<CandidateRouteReceipt>, StoreError> {
        let row = sqlx::query("SELECT * FROM processing_route_receipts WHERE operation_id = ?")
            .bind(operation_id.as_str())
            .fetch_optional(self.pool())
            .await
            .map_err(backend)?;
        let Some(row) = row else {
            return Ok(None);
        };
        let command = text(&row, "command")?;
        if ![CONFIGURE_ROUTE_COMMAND, RESOLVE_MODEL_BINDING_COMMAND].contains(&command.as_str()) {
            return Err(StoreError::DuplicateOperation {
                operation_id: operation_id.clone(),
            });
        }
        let route_id = RouteId::parse(&text(&row, "scope_id")?)
            .ok_or_else(|| corrupt("unknown route receipt scope"))?;
        Ok(Some(CandidateRouteReceipt {
            operation_id: operation_id.clone(),
            command,
            principal_id: PrincipalId::from_uuid(uuid(&row, "principal_id")?),
            route_id,
            expected_revision: rev(&row, "expected_revision")?,
            resulting_revision: rev(&row, "resulting_revision")?,
            request: text(&row, "request")?,
            status: receipt_status(&row)?,
            recorded_at: timestamp(&row)?,
        }))
    }

    async fn commit_candidate_route(&self, change: CandidateRouteChange) -> Result<(), StoreError> {
        let CandidateRouteChange {
            expected_revision,
            record,
            receipt,
        } = change;
        if expected_revision.next().ok() != Some(record.revision)
            || receipt.expected_revision != expected_revision
            || receipt.resulting_revision != record.revision
            || receipt.principal_id != record.principal_id
            || receipt.route_id != record.configuration.route_id()
            || receipt.recorded_at != record.recorded_at
            || receipt.status != ReceiptStatus::Applied
        {
            return Err(corrupt("inconsistent candidate route change"));
        }
        let configuration = serde_json::to_string(&record.configuration.input())
            .map_err(|_| corrupt("invalid configuration"))?;
        let valid_request = if receipt.command == CONFIGURE_ROUTE_COMMAND {
            receipt.request == configuration
        } else if receipt.command == RESOLVE_MODEL_BINDING_COMMAND {
            serde_json::from_str::<serde_json::Value>(&receipt.request)
                .ok()
                .is_some_and(|value| {
                    value.as_object().is_some_and(|fields| fields.len() == 3)
                        && value["catalog_version"].as_str().is_some_and(|v| {
                            v.len() == 64 && v.bytes().all(|b| b.is_ascii_hexdigit())
                        })
                        && value["choice_id"].as_str().is_some_and(|v| {
                            v.len() == 64 && v.bytes().all(|b| b.is_ascii_hexdigit())
                        })
                        && value["configuration"]
                            == serde_json::to_value(record.configuration.input())
                                .unwrap_or_default()
                })
        } else {
            false
        };
        if !valid_request {
            return Err(corrupt("candidate receipt/configuration mismatch"));
        }
        let mut tx = self
            .pool()
            .begin_with("BEGIN IMMEDIATE")
            .await
            .map_err(backend)?;
        check_operation(&mut tx, &receipt.operation_id).await?;
        let current: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(revision), 0) FROM processing_route_candidates WHERE principal_id = ? AND route_id = ?")
            .bind(record.principal_id.to_string()).bind(record.configuration.route_id().as_str()).fetch_one(&mut *tx).await.map_err(backend)?;
        check_revision(expected_revision, current)?;
        sqlx::query("INSERT INTO processing_route_candidates (principal_id, route_id, revision, configuration, recorded_at_ms) VALUES (?, ?, ?, ?, ?)")
            .bind(record.principal_id.to_string()).bind(record.configuration.route_id().as_str()).bind(db(record.revision)?)
            .bind(configuration).bind(record.recorded_at.unix_millis()).execute(&mut *tx).await.map_err(backend)?;
        sqlx::query("INSERT INTO processing_model_bindings(principal_id,route_id,configuration_revision,binding_id,state,revision) VALUES(?,?,?,?,'active',1)")
            .bind(record.principal_id.to_string()).bind(record.configuration.route_id().as_str()).bind(db(record.revision)?)
            .bind(Uuid::new_v4().to_string()).execute(&mut *tx).await.map_err(backend)?;
        insert_receipt(
            &mut tx,
            &receipt.operation_id,
            record.principal_id,
            &receipt.command,
            receipt.route_id.as_str(),
            expected_revision,
            record.revision,
            &receipt.request,
            record.recorded_at,
        )
        .await?;
        tx.commit().await.map_err(backend)
    }

    async fn commit_task_route(&self, change: RouteChange) -> Result<(), StoreError> {
        let RouteChange {
            usage_capabilities,
            expected_revision,
            expected_binding_revision,
            record,
            receipt,
        } = change;
        if expected_revision.next().ok() != Some(record.revision)
            || receipt.expected_revision != expected_revision
            || receipt.resulting_revision != record.revision
            || receipt.principal_id != record.principal_id
            || receipt.task_id != record.task_id
            || receipt.recorded_at != record.recorded_at
            || receipt.status != ReceiptStatus::Applied
        {
            return Err(corrupt("inconsistent Task route change"));
        }
        let canonical = serde_json::json!({ "task_id": record.task_id.to_string(), "route_id": record.configuration.route_id().as_str(), "configuration_revision": record.configuration_revision.get() }).to_string();
        if receipt.request != canonical {
            return Err(corrupt("selection receipt/configuration mismatch"));
        }
        let mut tx = self
            .pool()
            .begin_with("BEGIN IMMEDIATE")
            .await
            .map_err(backend)?;
        check_operation(&mut tx, &receipt.operation_id).await?;
        let creator: Option<String> =
            sqlx::query_scalar("SELECT creator_principal_id FROM tasks WHERE task_id = ?")
                .bind(record.task_id.to_string())
                .fetch_optional(&mut *tx)
                .await
                .map_err(backend)?;
        if creator.as_deref() != Some(record.principal_id.to_string().as_str()) {
            return Err(corrupt("Task route creator mismatch"));
        }
        let pending: Option<i64> = sqlx::query_scalar("SELECT 1 WHERE EXISTS(SELECT 1 FROM task_runs WHERE task_id=? AND json_extract(record,'$.status') IN ('reserved','bound','dispatching','running','uncertain')) OR EXISTS(SELECT 1 FROM task_lifecycle WHERE task_id=? AND json_extract(receipt,'$.status') IN ('reserved','dispatching','uncertain'))")
            .bind(record.task_id.to_string()).bind(record.task_id.to_string()).fetch_optional(&mut *tx).await.map_err(backend)?;
        if pending.is_some() {
            return Err(corrupt(
                "finish or stop pending work before changing its model",
            ));
        }
        let binding_revision: Option<i64> = sqlx::query_scalar("SELECT revision FROM processing_model_bindings WHERE principal_id=? AND route_id=? AND configuration_revision=? AND state='active'")
            .bind(record.principal_id.to_string()).bind(record.configuration.route_id().as_str()).bind(db(record.configuration_revision)?).fetch_optional(&mut *tx).await.map_err(backend)?;
        check_revision(
            expected_binding_revision,
            binding_revision.ok_or_else(|| corrupt("selected model binding is unavailable"))?,
        )?;
        let candidate_row = sqlx::query("SELECT c.* FROM processing_route_candidates c JOIN processing_model_bindings b ON b.principal_id=c.principal_id AND b.route_id=c.route_id AND b.configuration_revision=c.revision WHERE c.principal_id=? AND c.route_id=? AND c.revision=? AND b.state='active'")
            .bind(record.principal_id.to_string()).bind(record.configuration.route_id().as_str()).bind(db(record.configuration_revision)?).fetch_optional(&mut *tx).await.map_err(backend)?;
        let candidate = candidate_row
            .as_ref()
            .map(candidate)
            .transpose()?
            .ok_or_else(|| corrupt("missing route candidate"))?;
        if candidate.configuration != record.configuration {
            return Err(corrupt("selection metadata does not match candidate"));
        }
        let current: i64 = sqlx::query_scalar(
            "SELECT COALESCE(MAX(revision), 0) FROM task_processing_routes WHERE task_id = ?",
        )
        .bind(record.task_id.to_string())
        .fetch_one(&mut *tx)
        .await
        .map_err(backend)?;
        check_revision(expected_revision, current)?;
        if let Some(caps) = usage_capabilities {
            let previous: Option<String> = sqlx::query_scalar(
                "SELECT record FROM task_usage_settings WHERE task_id=? ORDER BY revision DESC LIMIT 1",
            ).bind(record.task_id.to_string()).fetch_optional(&mut *tx).await.map_err(backend)?;
            let settings = if let Some(previous) = previous {
                let previous: inquello_domain::usage::TaskUsageSettings =
                    serde_json::from_str(&previous)
                        .map_err(|_| corrupt("invalid usage settings"))?;
                if previous.route_revision != expected_revision.get() {
                    return Err(corrupt(
                        "saved model settings changed; selection was not applied",
                    ));
                }
                inquello_domain::usage::TaskUsageSettings {
                    revision: previous
                        .revision
                        .checked_add(1)
                        .filter(|v| *v <= i64::MAX as u64)
                        .ok_or_else(|| corrupt("usage settings revision overflow"))?,
                    route_revision: record.revision.get(),
                    choices: previous.choices,
                }
            } else {
                let retained: i64 =
                    sqlx::query_scalar("SELECT COUNT(*) FROM task_runs WHERE task_id=?")
                        .bind(record.task_id.to_string())
                        .fetch_one(&mut *tx)
                        .await
                        .map_err(backend)?;
                if retained != 0 {
                    return Err(corrupt("retained conversation settings unavailable"));
                }
                inquello_domain::usage::TaskUsageSettings {
                    revision: 1,
                    route_revision: record.revision.get(),
                    choices: caps.defaults,
                }
            };
            if !caps.reasoning.contains(&settings.choices.reasoning)
                || !caps.speeds.contains(&settings.choices.speed)
            {
                return Err(corrupt("selected model does not support saved choices"));
            }
            let json =
                serde_json::to_string(&settings).map_err(|_| corrupt("invalid usage settings"))?;
            sqlx::query("INSERT INTO task_usage_settings(task_id,revision,record) VALUES(?,?,?)")
                .bind(record.task_id.to_string())
                .bind(settings.revision as i64)
                .bind(json)
                .execute(&mut *tx)
                .await
                .map_err(backend)?;
        }
        sqlx::query("INSERT INTO task_processing_routes (task_id, revision, principal_id, route_id, configuration_revision, recorded_at_ms) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(record.task_id.to_string()).bind(db(record.revision)?).bind(record.principal_id.to_string())
            .bind(record.configuration.route_id().as_str()).bind(db(record.configuration_revision)?).bind(record.recorded_at.unix_millis())
            .execute(&mut *tx).await.map_err(backend)?;
        // Keep the prior incarnation byte-for-byte before changing the current
        // terminal run's binding. The receipt/history continues to name it.
        sqlx::query("INSERT OR IGNORE INTO task_run_history(task_id,run_id,record) SELECT task_id,json_extract(record,'$.run_id'),record FROM task_runs WHERE task_id=?")
            .bind(record.task_id.to_string()).execute(&mut *tx).await.map_err(backend)?;
        sqlx::query("UPDATE task_runs SET record=json_set(record,'$.route_id',?,'$.configuration_revision',?) WHERE task_id=?")
            .bind(record.configuration.route_id().as_str()).bind(db(record.configuration_revision)?).bind(record.task_id.to_string()).execute(&mut *tx).await.map_err(backend)?;
        insert_receipt(
            &mut tx,
            &receipt.operation_id,
            record.principal_id,
            SET_TASK_ROUTE_COMMAND,
            &record.task_id.to_string(),
            expected_revision,
            record.revision,
            &receipt.request,
            record.recorded_at,
        )
        .await?;
        tx.commit().await.map_err(backend)
    }
}

async fn check_operation(
    tx: &mut Transaction<'_, Sqlite>,
    operation_id: &OperationId,
) -> Result<(), StoreError> {
    let exists: Option<i64> =
        sqlx::query_scalar("SELECT 1 FROM processing_route_receipts WHERE operation_id = ?")
            .bind(operation_id.as_str())
            .fetch_optional(&mut **tx)
            .await
            .map_err(backend)?;
    if exists.is_some() {
        return Err(StoreError::DuplicateOperation {
            operation_id: operation_id.clone(),
        });
    }
    Ok(())
}

#[expect(
    clippy::too_many_arguments,
    reason = "one validated atomic receipt row"
)]
async fn insert_receipt(
    tx: &mut Transaction<'_, Sqlite>,
    operation_id: &OperationId,
    principal_id: PrincipalId,
    command: &str,
    scope: &str,
    expected: Revision,
    resulting: Revision,
    request: &str,
    time: Timestamp,
) -> Result<(), StoreError> {
    sqlx::query("INSERT INTO processing_route_receipts (operation_id, principal_id, command, scope_id, expected_revision, resulting_revision, request, status, recorded_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, 'applied', ?)")
        .bind(operation_id.as_str()).bind(principal_id.to_string()).bind(command).bind(scope).bind(db(expected)?).bind(db(resulting)?)
        .bind(request).bind(time.unix_millis()).execute(&mut **tx).await.map_err(backend)?;
    Ok(())
}

fn configuration(row: &SqliteRow) -> Result<RouteConfiguration, StoreError> {
    let input = serde_json::from_str::<RouteConfigurationInput>(&text(row, "configuration")?)
        .map_err(|_| corrupt("invalid stored route configuration"))?;
    let value = RouteConfiguration::parse(input)
        .map_err(|_| corrupt("unsupported stored route configuration"))?;
    if value.route_id().as_str() != text(row, "route_id")? {
        return Err(corrupt("route ID/configuration mismatch"));
    }
    Ok(value)
}
fn candidate(row: &SqliteRow) -> Result<CandidateRouteRecord, StoreError> {
    Ok(CandidateRouteRecord {
        principal_id: PrincipalId::from_uuid(uuid(row, "principal_id")?),
        configuration: configuration(row)?,
        revision: rev(row, "revision")?,
        recorded_at: timestamp(row)?,
    })
}
fn binding(row: &SqliteRow) -> Result<ModelBinding, StoreError> {
    let state = match text(row, "state")?.as_str() {
        "active" => ModelBindingState::Active,
        "revoked" => ModelBindingState::Revoked,
        "legacy-superseded" => ModelBindingState::LegacySuperseded,
        _ => return Err(corrupt("unknown model binding state")),
    };
    Ok(ModelBinding {
        binding_id: text(row, "binding_id")?,
        candidate: candidate(row)?,
        state,
        revision: rev(row, "binding_revision")?,
    })
}
fn selection(row: &SqliteRow) -> Result<TaskRouteRecord, StoreError> {
    Ok(TaskRouteRecord {
        task_id: TaskId::from_uuid(uuid(row, "task_id")?),
        principal_id: PrincipalId::from_uuid(uuid(row, "principal_id")?),
        configuration: configuration(row)?,
        configuration_revision: rev(row, "configuration_revision")?,
        revision: rev(row, "revision")?,
        recorded_at: timestamp(row)?,
    })
}
fn check_revision(expected: Revision, actual: i64) -> Result<(), StoreError> {
    let actual =
        Revision::new(u64::try_from(actual).map_err(|_| corrupt("negative route revision"))?);
    if actual != expected {
        return Err(StoreError::RevisionConflict { expected, actual });
    }
    Ok(())
}
fn receipt_status(row: &SqliteRow) -> Result<ReceiptStatus, StoreError> {
    if text(row, "status")? != "applied" {
        return Err(corrupt("unknown route receipt status"));
    }
    Ok(ReceiptStatus::Applied)
}
fn text(row: &SqliteRow, key: &str) -> Result<String, StoreError> {
    row.try_get(key).map_err(backend)
}
fn uuid(row: &SqliteRow, key: &str) -> Result<Uuid, StoreError> {
    Uuid::parse_str(&text(row, key)?).map_err(|_| corrupt("invalid route UUID"))
}
fn rev(row: &SqliteRow, key: &str) -> Result<Revision, StoreError> {
    let value: i64 = row.try_get(key).map_err(backend)?;
    Ok(Revision::new(
        u64::try_from(value).map_err(|_| corrupt("negative route revision"))?,
    ))
}
fn timestamp(row: &SqliteRow) -> Result<Timestamp, StoreError> {
    Ok(Timestamp::from_unix_millis(
        row.try_get("recorded_at_ms").map_err(backend)?,
    ))
}
fn db(value: Revision) -> Result<i64, StoreError> {
    i64::try_from(value.get()).map_err(|_| corrupt("route revision exceeds SQLite range"))
}
fn corrupt(message: &str) -> StoreError {
    StoreError::Corrupt(message.to_string())
}
fn backend(error: sqlx::Error) -> StoreError {
    StoreError::Backend(error.to_string())
}
