//! The SQLite implementation of the domain's [`UserRuleStore`] and
//! [`PermissionStore`] ports (Story 1.20).

use crate::store::SqliteWorkingStore;
use inquello_domain::OperationId;
use inquello_domain::ReceiptStatus;
use inquello_domain::Revision;
use inquello_domain::StoreError;
use inquello_domain::Timestamp;
use inquello_domain::execution_policy::BroadModeTask;
use inquello_domain::execution_policy::CommandEvaluation;
use inquello_domain::execution_policy::DECIDE_PERMISSION_COMMAND;
use inquello_domain::execution_policy::DeciderKind;
use inquello_domain::execution_policy::NewPermissionRequest;
use inquello_domain::execution_policy::PermissionDecision;
use inquello_domain::execution_policy::PermissionDecisionChange;
use inquello_domain::execution_policy::PermissionOutcome;
use inquello_domain::execution_policy::PermissionReceipt;
use inquello_domain::execution_policy::PermissionRequest;
use inquello_domain::execution_policy::PermissionStore;
use inquello_domain::execution_policy::REQUEST_PERMISSION_COMMAND;
use inquello_domain::execution_policy::RequestOrigin;
use inquello_domain::execution_policy::SET_USER_RULES_COMMAND;
use inquello_domain::execution_policy::UserRuleStore;
use inquello_domain::execution_policy::UserRulesChange;
use inquello_domain::execution_policy::UserRulesReceipt;
use inquello_domain::execution_policy::UserRulesRecord;
use inquello_domain::execution_policy::rules_from_value;
use inquello_domain::execution_policy::rules_to_value;
use inquello_domain::organise::PermissionRequestId;
use inquello_domain::organise::PrincipalId;
use inquello_domain::organise::TaskId;
use inquello_domain::organise::WorkspaceId;
use sqlx::Row;
use sqlx::sqlite::SqliteRow;
use uuid::Uuid;

const RULE_COLUMNS: &str = "principal_id, revision, rules, recorded_at_ms";
const REQUEST_COLUMNS: &str = "r.request_id, r.principal_id, r.task_id, r.workspace_id, r.origin, \
     r.evaluation, r.created_at_ms, r.expires_at_ms, r.used_at_ms, d.outcome, d.actor_kind, \
     d.actor_ref, d.decided_at_ms";
const REQUEST_FROM: &str =
    "permission_requests r LEFT JOIN permission_decisions d ON d.request_id = r.request_id";

impl UserRuleStore for SqliteWorkingStore {
    async fn find_user_rules_receipt(
        &self,
        operation_id: &OperationId,
    ) -> Result<Option<UserRulesReceipt>, StoreError> {
        let row = sqlx::query(
            "SELECT operation_id, principal_id, command, expected_revision, resulting_revision, \
             request, status, recorded_at_ms FROM user_rule_receipts WHERE operation_id = ?",
        )
        .bind(operation_id.as_str())
        .fetch_optional(self.pool())
        .await
        .map_err(backend)?;
        row.as_ref().map(rules_receipt_from_row).transpose()
    }

    async fn load_user_rules(
        &self,
        principal_id: PrincipalId,
    ) -> Result<Option<UserRulesRecord>, StoreError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            "SELECT {RULE_COLUMNS} FROM user_command_rules WHERE principal_id = ? \
             ORDER BY revision DESC LIMIT 1"
        )))
        .bind(principal_id.to_string())
        .fetch_optional(self.pool())
        .await
        .map_err(backend)?;
        row.as_ref().map(rules_from_row).transpose()
    }

    async fn load_user_rules_record(
        &self,
        principal_id: PrincipalId,
        revision: Revision,
    ) -> Result<Option<UserRulesRecord>, StoreError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            "SELECT {RULE_COLUMNS} FROM user_command_rules WHERE principal_id = ? AND revision = ?"
        )))
        .bind(principal_id.to_string())
        .bind(to_db(revision)?)
        .fetch_optional(self.pool())
        .await
        .map_err(backend)?;
        row.as_ref().map(rules_from_row).transpose()
    }

    async fn commit_user_rules(&self, change: UserRulesChange) -> Result<(), StoreError> {
        let UserRulesChange {
            expected_revision,
            record,
            receipt,
        } = change;
        let consistent = expected_revision.next().ok() == Some(record.revision)
            && receipt.expected_revision == expected_revision
            && receipt.resulting_revision == record.revision
            && receipt.principal_id == record.principal_id;
        if !consistent {
            return Err(StoreError::Backend(
                "user-rules change revisions are inconsistent".to_string(),
            ));
        }
        // IMMEDIATE takes the write lock first, so the revision read cannot go
        // stale before the writes; dropping the transaction rolls back.
        let mut tx = self
            .pool()
            .begin_with("BEGIN IMMEDIATE")
            .await
            .map_err(backend)?;
        // A receipt recorded by a concurrent writer of the same operation wins
        // over the revision check, so the caller replays (or refuses) it (R10).
        let recorded: Option<i64> =
            sqlx::query_scalar("SELECT 1 FROM user_rule_receipts WHERE operation_id = ?")
                .bind(receipt.operation_id.as_str())
                .fetch_optional(&mut *tx)
                .await
                .map_err(backend)?;
        if recorded.is_some() {
            return Err(StoreError::DuplicateOperation {
                operation_id: receipt.operation_id,
            });
        }
        let principal = record.principal_id.to_string();
        let actual: i64 = sqlx::query_scalar(
            "SELECT COALESCE(MAX(revision), 0) FROM user_command_rules WHERE principal_id = ?",
        )
        .bind(&principal)
        .fetch_one(&mut *tx)
        .await
        .map_err(backend)?;
        let actual = Revision::new(from_db(actual, "revision")?);
        if actual != expected_revision {
            return Err(StoreError::RevisionConflict {
                expected: expected_revision,
                actual,
            });
        }
        sqlx::query(
            "INSERT INTO user_command_rules (principal_id, revision, rules, recorded_at_ms) \
             VALUES (?, ?, ?, ?)",
        )
        .bind(&principal)
        .bind(to_db(record.revision)?)
        .bind(rules_to_value(&record.rules).to_string())
        .bind(record.recorded_at.unix_millis())
        .execute(&mut *tx)
        .await
        .map_err(backend)?;
        sqlx::query(
            "INSERT INTO user_rule_receipts (operation_id, principal_id, command, \
             expected_revision, resulting_revision, request, status, recorded_at_ms) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(receipt.operation_id.as_str())
        .bind(&principal)
        .bind(SET_USER_RULES_COMMAND)
        .bind(to_db(receipt.expected_revision)?)
        .bind(to_db(receipt.resulting_revision)?)
        .bind(&receipt.request)
        .bind(receipt.status.as_str())
        .bind(receipt.recorded_at.unix_millis())
        .execute(&mut *tx)
        .await
        .map_err(|error| duplicate_or_backend(error, &receipt.operation_id))?;
        tx.commit().await.map_err(backend)
    }
}

impl PermissionStore for SqliteWorkingStore {
    async fn find_permission_receipt(
        &self,
        operation_id: &OperationId,
    ) -> Result<Option<PermissionReceipt>, StoreError> {
        let row = sqlx::query(
            "SELECT operation_id, principal_id, command, request_id, expected_revision, \
             resulting_revision, request, status, recorded_at_ms FROM permission_receipts \
             WHERE operation_id = ?",
        )
        .bind(operation_id.as_str())
        .fetch_optional(self.pool())
        .await
        .map_err(backend)?;
        row.as_ref().map(permission_receipt_from_row).transpose()
    }

    async fn load_permission_task(
        &self,
        task_id: TaskId,
    ) -> Result<Option<BroadModeTask>, StoreError> {
        let row =
            sqlx::query("SELECT creator_principal_id, workspace_id FROM tasks WHERE task_id = ?")
                .bind(task_id.to_string())
                .fetch_optional(self.pool())
                .await
                .map_err(backend)?;
        row.map(|row| {
            Ok(BroadModeTask {
                creator: PrincipalId::from_uuid(uuid(&row, "creator_principal_id")?),
                workspace_id: WorkspaceId::from_uuid(uuid(&row, "workspace_id")?),
            })
        })
        .transpose()
    }

    async fn load_permission_request(
        &self,
        request_id: PermissionRequestId,
    ) -> Result<Option<PermissionRequest>, StoreError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            "SELECT {REQUEST_COLUMNS} FROM {REQUEST_FROM} WHERE r.request_id = ?"
        )))
        .bind(request_id.to_string())
        .fetch_optional(self.pool())
        .await
        .map_err(backend)?;
        row.as_ref().map(request_from_row).transpose()
    }

    async fn list_undecided_requests(
        &self,
        principal_id: PrincipalId,
        task_id: Option<TaskId>,
    ) -> Result<Vec<PermissionRequest>, StoreError> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            "SELECT {REQUEST_COLUMNS} FROM {REQUEST_FROM} WHERE r.principal_id = ? \
             AND (? IS NULL OR r.task_id = ?) AND d.request_id IS NULL \
             ORDER BY r.created_at_ms, r.request_id"
        )))
        .bind(principal_id.to_string())
        .bind(task_id.map(|task| task.to_string()))
        .bind(task_id.map(|task| task.to_string()))
        .fetch_all(self.pool())
        .await
        .map_err(backend)?;
        rows.iter().map(request_from_row).collect()
    }

    async fn commit_permission_request(
        &self,
        change: NewPermissionRequest,
    ) -> Result<(), StoreError> {
        let NewPermissionRequest { request, receipt } = change;
        if receipt.request_id != request.request_id
            || receipt.command != REQUEST_PERMISSION_COMMAND
            || request.decision.is_some()
        {
            return Err(StoreError::Backend(
                "permission request change is inconsistent".to_string(),
            ));
        }
        let mut tx = self
            .pool()
            .begin_with("BEGIN IMMEDIATE")
            .await
            .map_err(backend)?;
        if receipt_recorded(&mut tx, &receipt.operation_id).await? {
            return Err(StoreError::DuplicateOperation {
                operation_id: receipt.operation_id,
            });
        }
        let exists: Option<i64> =
            sqlx::query_scalar("SELECT 1 FROM permission_requests WHERE request_id = ?")
                .bind(request.request_id.to_string())
                .fetch_optional(&mut *tx)
                .await
                .map_err(backend)?;
        if exists.is_some() {
            return Err(StoreError::RevisionConflict {
                expected: Revision::ZERO,
                actual: Revision::new(1),
            });
        }
        sqlx::query(
            "INSERT INTO permission_requests (request_id, principal_id, task_id, workspace_id, \
             origin, evaluation, created_at_ms, expires_at_ms, used_at_ms) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)",
        )
        .bind(request.request_id.to_string())
        .bind(request.principal_id.to_string())
        .bind(request.task_id.to_string())
        .bind(request.workspace_id.to_string())
        .bind(request.origin.as_str())
        .bind(request.evaluation.to_value().to_string())
        .bind(request.created_at.unix_millis())
        .bind(request.expires_at.unix_millis())
        .execute(&mut *tx)
        .await
        .map_err(backend)?;
        insert_receipt(&mut tx, &receipt).await?;
        tx.commit().await.map_err(backend)
    }

    async fn commit_permission_decision(
        &self,
        change: PermissionDecisionChange,
    ) -> Result<(), StoreError> {
        let PermissionDecisionChange {
            request_id,
            decision,
            receipt,
        } = change;
        if receipt.request_id != request_id || receipt.command != DECIDE_PERMISSION_COMMAND {
            return Err(StoreError::Backend(
                "permission decision change is inconsistent".to_string(),
            ));
        }
        let mut tx = self
            .pool()
            .begin_with("BEGIN IMMEDIATE")
            .await
            .map_err(backend)?;
        if receipt_recorded(&mut tx, &receipt.operation_id).await? {
            return Err(StoreError::DuplicateOperation {
                operation_id: receipt.operation_id,
            });
        }
        let decided: Option<i64> =
            sqlx::query_scalar("SELECT 1 FROM permission_decisions WHERE request_id = ?")
                .bind(request_id.to_string())
                .fetch_optional(&mut *tx)
                .await
                .map_err(backend)?;
        if decided.is_some() {
            return Err(StoreError::RevisionConflict {
                expected: Revision::new(1),
                actual: Revision::new(2),
            });
        }
        sqlx::query(
            "INSERT INTO permission_decisions (request_id, outcome, actor_kind, actor_ref, \
             decided_at_ms) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(request_id.to_string())
        .bind(decision.outcome.as_str())
        .bind(decision.actor_kind.as_str())
        .bind(&decision.actor_ref)
        .bind(decision.decided_at.unix_millis())
        .execute(&mut *tx)
        .await
        .map_err(backend)?;
        insert_receipt(&mut tx, &receipt).await?;
        tx.commit().await.map_err(backend)
    }

    async fn mark_permission_used(
        &self,
        request_id: PermissionRequestId,
        at: Timestamp,
    ) -> Result<bool, StoreError> {
        let result = sqlx::query(
            "UPDATE permission_requests SET used_at_ms = ? WHERE request_id = ? \
             AND used_at_ms IS NULL AND EXISTS (SELECT 1 FROM permission_decisions d \
             WHERE d.request_id = permission_requests.request_id AND d.outcome = 'allowed')",
        )
        .bind(at.unix_millis())
        .bind(request_id.to_string())
        .execute(self.pool())
        .await
        .map_err(backend)?;
        Ok(result.rows_affected() == 1)
    }
}

async fn receipt_recorded(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    operation_id: &OperationId,
) -> Result<bool, StoreError> {
    let recorded: Option<i64> =
        sqlx::query_scalar("SELECT 1 FROM permission_receipts WHERE operation_id = ?")
            .bind(operation_id.as_str())
            .fetch_optional(&mut **tx)
            .await
            .map_err(backend)?;
    Ok(recorded.is_some())
}

async fn insert_receipt(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    receipt: &PermissionReceipt,
) -> Result<(), StoreError> {
    sqlx::query(
        "INSERT INTO permission_receipts (operation_id, principal_id, command, request_id, \
         expected_revision, resulting_revision, request, status, recorded_at_ms) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(receipt.operation_id.as_str())
    .bind(receipt.principal_id.to_string())
    .bind(&receipt.command)
    .bind(receipt.request_id.to_string())
    .bind(to_db(receipt.expected_revision)?)
    .bind(to_db(receipt.resulting_revision)?)
    .bind(&receipt.request)
    .bind(receipt.status.as_str())
    .bind(receipt.recorded_at.unix_millis())
    .execute(&mut **tx)
    .await
    .map_err(|error| duplicate_or_backend(error, &receipt.operation_id))?;
    Ok(())
}

fn duplicate_or_backend(error: sqlx::Error, operation_id: &OperationId) -> StoreError {
    if error
        .as_database_error()
        .is_some_and(sqlx::error::DatabaseError::is_unique_violation)
    {
        StoreError::DuplicateOperation {
            operation_id: operation_id.clone(),
        }
    } else {
        backend(error)
    }
}

fn status(row: &SqliteRow, table: &str) -> Result<ReceiptStatus, StoreError> {
    let status: String = row.try_get("status").map_err(backend)?;
    ReceiptStatus::parse(&status)
        .ok_or_else(|| corrupt(format!("{table}.status: unknown {status:?}")))
}

fn operation(row: &SqliteRow, table: &str) -> Result<OperationId, StoreError> {
    let operation_id: String = row.try_get("operation_id").map_err(backend)?;
    OperationId::parse(&operation_id)
        .map_err(|error| corrupt(format!("{table}.operation_id: {error}")))
}

fn rules_receipt_from_row(row: &SqliteRow) -> Result<UserRulesReceipt, StoreError> {
    let command: String = row.try_get("command").map_err(backend)?;
    if command != SET_USER_RULES_COMMAND {
        return Err(corrupt(format!(
            "user_rule_receipts.command: unknown {command:?}"
        )));
    }
    Ok(UserRulesReceipt {
        operation_id: operation(row, "user_rule_receipts")?,
        principal_id: PrincipalId::from_uuid(uuid(row, "principal_id")?),
        expected_revision: revision(row, "expected_revision")?,
        resulting_revision: revision(row, "resulting_revision")?,
        request: row.try_get("request").map_err(backend)?,
        status: status(row, "user_rule_receipts")?,
        recorded_at: timestamp(row, "recorded_at_ms")?,
    })
}

fn rules_from_row(row: &SqliteRow) -> Result<UserRulesRecord, StoreError> {
    let rules: String = row.try_get("rules").map_err(backend)?;
    let rules: serde_json::Value = serde_json::from_str(&rules)
        .map_err(|error| corrupt(format!("user_command_rules.rules: {error}")))?;
    Ok(UserRulesRecord {
        principal_id: PrincipalId::from_uuid(uuid(row, "principal_id")?),
        revision: revision(row, "revision")?,
        rules: rules_from_value(&rules)
            .map_err(|error| corrupt(format!("user_command_rules.rules: {error}")))?,
        recorded_at: timestamp(row, "recorded_at_ms")?,
    })
}

fn permission_receipt_from_row(row: &SqliteRow) -> Result<PermissionReceipt, StoreError> {
    let command: String = row.try_get("command").map_err(backend)?;
    if command != REQUEST_PERMISSION_COMMAND && command != DECIDE_PERMISSION_COMMAND {
        return Err(corrupt(format!(
            "permission_receipts.command: unknown {command:?}"
        )));
    }
    Ok(PermissionReceipt {
        operation_id: operation(row, "permission_receipts")?,
        principal_id: PrincipalId::from_uuid(uuid(row, "principal_id")?),
        command,
        request_id: PermissionRequestId::from_uuid(uuid(row, "request_id")?),
        expected_revision: revision(row, "expected_revision")?,
        resulting_revision: revision(row, "resulting_revision")?,
        request: row.try_get("request").map_err(backend)?,
        status: status(row, "permission_receipts")?,
        recorded_at: timestamp(row, "recorded_at_ms")?,
    })
}

fn request_from_row(row: &SqliteRow) -> Result<PermissionRequest, StoreError> {
    let origin: String = row.try_get("origin").map_err(backend)?;
    let origin = RequestOrigin::parse(&origin)
        .ok_or_else(|| corrupt(format!("permission_requests.origin: unknown {origin:?}")))?;
    let evaluation: String = row.try_get("evaluation").map_err(backend)?;
    let evaluation: serde_json::Value = serde_json::from_str(&evaluation)
        .map_err(|error| corrupt(format!("permission_requests.evaluation: {error}")))?;
    let evaluation = CommandEvaluation::from_value(&evaluation)
        .map_err(|error| corrupt(format!("permission_requests.evaluation: {error}")))?;
    let outcome: Option<String> = row.try_get("outcome").map_err(backend)?;
    let decision = match outcome {
        None => None,
        Some(outcome) => {
            let outcome = PermissionOutcome::parse(&outcome).ok_or_else(|| {
                corrupt(format!("permission_decisions.outcome: unknown {outcome:?}"))
            })?;
            let kind: String = row.try_get("actor_kind").map_err(backend)?;
            let actor_kind = DeciderKind::parse(&kind).ok_or_else(|| {
                corrupt(format!("permission_decisions.actor_kind: unknown {kind:?}"))
            })?;
            Some(PermissionDecision {
                outcome,
                actor_kind,
                actor_ref: row.try_get("actor_ref").map_err(backend)?,
                decided_at: timestamp(row, "decided_at_ms")?,
            })
        }
    };
    let used_at: Option<i64> = row.try_get("used_at_ms").map_err(backend)?;
    Ok(PermissionRequest {
        request_id: PermissionRequestId::from_uuid(uuid(row, "request_id")?),
        principal_id: PrincipalId::from_uuid(uuid(row, "principal_id")?),
        task_id: TaskId::from_uuid(uuid(row, "task_id")?),
        workspace_id: WorkspaceId::from_uuid(uuid(row, "workspace_id")?),
        origin,
        evaluation,
        created_at: timestamp(row, "created_at_ms")?,
        expires_at: timestamp(row, "expires_at_ms")?,
        decision,
        used_at: used_at.map(Timestamp::from_unix_millis),
    })
}

fn uuid(row: &SqliteRow, column: &str) -> Result<Uuid, StoreError> {
    let value: String = row.try_get(column).map_err(backend)?;
    Uuid::parse_str(&value).map_err(|error| corrupt(format!("{column}: {error}")))
}

fn revision(row: &SqliteRow, column: &str) -> Result<Revision, StoreError> {
    let value: i64 = row.try_get(column).map_err(backend)?;
    Ok(Revision::new(from_db(value, column)?))
}

fn timestamp(row: &SqliteRow, column: &str) -> Result<Timestamp, StoreError> {
    let value: i64 = row.try_get(column).map_err(backend)?;
    Ok(Timestamp::from_unix_millis(value))
}

fn corrupt(message: String) -> StoreError {
    StoreError::Corrupt(message)
}

fn backend(error: sqlx::Error) -> StoreError {
    StoreError::Backend(error.to_string())
}

fn to_db(revision: Revision) -> Result<i64, StoreError> {
    i64::try_from(revision.get())
        .map_err(|_| StoreError::Backend(format!("revision {revision} exceeds SQLite range")))
}

fn from_db(value: i64, column: &str) -> Result<u64, StoreError> {
    u64::try_from(value).map_err(|_| corrupt(format!("{column} is negative")))
}

impl inquello_domain::execution_policy::AutomatedReviewStore for SqliteWorkingStore {
    async fn commit_automated_review(&self, change: inquello_domain::execution_policy::AutomatedReviewChange) -> Result<(), StoreError> {
        let inquello_domain::execution_policy::AutomatedReviewChange { request, decision, receipt, attribution } = change;
        let stale = || StoreError::RevisionConflict { expected: Revision::new(1), actual: Revision::new(2) };
        if receipt.request_id != request.request_id || receipt.principal_id != request.principal_id
            || decision.actor_kind != DeciderKind::AutomatedReviewer || decision.actor_ref != attribution.invocation_id {
            return Err(StoreError::Backend("invalid automated review change".into()));
        }
        let mut tx = self.pool().begin_with("BEGIN IMMEDIATE").await.map_err(backend)?;
        // The same write lock covers all DB freshness checks and all three writes.
        let row = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT {REQUEST_COLUMNS} FROM {REQUEST_FROM} WHERE r.request_id = ?")))
            .bind(request.request_id.to_string()).fetch_optional(&mut *tx).await.map_err(backend)?.ok_or_else(stale)?;
        let current = request_from_row(&row)?;
        let now: i64 = sqlx::query_scalar("SELECT CAST(unixepoch('subsec') * 1000 AS INTEGER)")
            .fetch_one(&mut *tx).await.map_err(backend)?;
        if current != request || current.decision.is_some() || current.used_at.is_some() || current.expires_at.unix_millis() <= now { return Err(stale()); }
        let creator: Option<String> = sqlx::query_scalar("SELECT creator_principal_id FROM tasks WHERE task_id = ?")
            .bind(request.task_id.to_string()).fetch_optional(&mut *tx).await.map_err(backend)?;
        if creator.as_deref() != Some(&request.principal_id.to_string()) { return Err(stale()); }
        let revisions: (i64, i64, i64, i64) = sqlx::query_as(
            "SELECT (SELECT COALESCE(MAX(revision),0) FROM task_processing_routes WHERE task_id = ?), \
            (SELECT COALESCE(MAX(revision),0) FROM processing_route_candidates WHERE principal_id = ? AND route_id = ?), \
            (SELECT COALESCE(MAX(revision),0) FROM user_command_rules WHERE principal_id = ?), \
            (SELECT COALESCE(MAX(revision),0) FROM task_broad_modes WHERE task_id = ?)")
            .bind(request.task_id.to_string()).bind(request.principal_id.to_string()).bind(&attribution.route_id)
            .bind(request.principal_id.to_string()).bind(request.task_id.to_string())
            .fetch_one(&mut *tx).await.map_err(backend)?;
        if revisions != (to_db(attribution.route_revision)?, to_db(attribution.configuration_revision)?,
            to_db(attribution.user_rules_revision)?, to_db(attribution.broad_mode_revision)?) { return Err(stale()); }
        let selected: Option<(String, i64)> = sqlx::query_as("SELECT route_id, configuration_revision FROM task_processing_routes WHERE task_id = ? ORDER BY revision DESC LIMIT 1")
            .bind(request.task_id.to_string()).fetch_optional(&mut *tx).await.map_err(backend)?;
        if selected != Some((attribution.route_id.clone(), to_db(attribution.configuration_revision)?)) { return Err(stale()); }
        sqlx::query("INSERT INTO automated_permission_reviews (invocation_id, request_id, attempt_id, attribution, recorded_at_ms) VALUES (?, ?, ?, ?, ?)")
            .bind(&attribution.invocation_id).bind(request.request_id.to_string()).bind(&attribution.attempt_id)
            .bind(attribution.to_value().to_string()).bind(now).execute(&mut *tx).await.map_err(backend)?;
        sqlx::query("INSERT INTO permission_decisions (request_id,outcome,actor_kind,actor_ref,decided_at_ms) VALUES (?, ?, 'automated_reviewer', ?, ?)")
            .bind(request.request_id.to_string()).bind(decision.outcome.as_str()).bind(&decision.actor_ref).bind(now)
            .execute(&mut *tx).await.map_err(backend)?;
        insert_receipt(&mut tx, &receipt).await?;
        tx.commit().await.map_err(backend)
    }
}
