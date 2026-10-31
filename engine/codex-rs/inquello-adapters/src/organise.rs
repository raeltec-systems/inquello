//! The SQLite implementation of the domain's [`OrganiseStore`] port (Story 1.14).

use crate::store::SqliteWorkingStore;
use inquello_domain::OperationId;
use inquello_domain::ReceiptStatus;
use inquello_domain::Revision;
use inquello_domain::StoreError;
use inquello_domain::Timestamp;
use inquello_domain::organise::Engagement;
use inquello_domain::organise::EngagementId;
use inquello_domain::organise::Folder;
use inquello_domain::organise::FolderId;
use inquello_domain::organise::KnownWorkspace;
use inquello_domain::organise::OrganiseChange;
use inquello_domain::organise::OrganiseCommandKind;
use inquello_domain::organise::OrganiseReceipt;
use inquello_domain::organise::OrganiseRecord;
use inquello_domain::organise::OrganiseStore;
use inquello_domain::organise::PeriodDate;
use inquello_domain::organise::PrincipalId;
use inquello_domain::organise::ServiceEngagementId;
use inquello_domain::organise::Task;
use inquello_domain::organise::TaskId;
use inquello_domain::organise::Visibility;
use inquello_domain::organise::WorkspaceId;
use inquello_domain::organise::WorkspaceLabel;
use inquello_domain::organise::WorkspaceTree;
use sqlx::Row;
use sqlx::Sqlite;
use sqlx::Transaction;
use sqlx::sqlite::SqliteRow;
use uuid::Uuid;

const ENGAGEMENT_COLUMNS: &str = "engagement_id, workspace_id, service_engagement_id, name, \
     objectives, scope, client_entity, period_start, period_end, revision, created_at_ms, \
     updated_at_ms";
const FOLDER_COLUMNS: &str =
    "folder_id, engagement_id, workspace_id, name, revision, created_at_ms, updated_at_ms";
const TASK_COLUMNS: &str = "task_id, workspace_id, creator_principal_id, engagement_id, \
     folder_id, title, runtime_thread_id, source_refs, artifact_refs, visibility, revision, \
     created_at_ms, updated_at_ms";
const LABEL_COLUMNS: &str = "principal_id, workspace_id, name, revision, updated_at_ms";

impl OrganiseStore for SqliteWorkingStore {
    async fn find_organise_receipt(
        &self,
        operation_id: &OperationId,
    ) -> Result<Option<OrganiseReceipt>, StoreError> {
        let row = sqlx::query(
            "SELECT operation_id, principal_id, command, resource_id, expected_revision, \
             resulting_revision, request, status, recorded_at_ms FROM organise_receipts \
             WHERE operation_id = ?",
        )
        .bind(operation_id.as_str())
        .fetch_optional(self.pool())
        .await
        .map_err(backend)?;
        row.as_ref().map(receipt_from_row).transpose()
    }

    async fn load_engagement(
        &self,
        engagement_id: EngagementId,
    ) -> Result<Option<Engagement>, StoreError> {
        let sql = format!("SELECT {ENGAGEMENT_COLUMNS} FROM engagements WHERE engagement_id = ?");
        let row = sqlx::query(sqlx::AssertSqlSafe(sql))
            .bind(engagement_id.to_string())
            .fetch_optional(self.pool())
            .await
            .map_err(backend)?;
        row.as_ref().map(engagement_from_row).transpose()
    }

    async fn find_engagement_by_service_id(
        &self,
        service_engagement_id: ServiceEngagementId,
    ) -> Result<Option<Engagement>, StoreError> {
        let sql =
            format!("SELECT {ENGAGEMENT_COLUMNS} FROM engagements WHERE service_engagement_id = ?");
        let row = sqlx::query(sqlx::AssertSqlSafe(sql))
            .bind(service_engagement_id.to_string())
            .fetch_optional(self.pool())
            .await
            .map_err(backend)?;
        row.as_ref().map(engagement_from_row).transpose()
    }

    async fn load_folder(&self, folder_id: FolderId) -> Result<Option<Folder>, StoreError> {
        let sql = format!("SELECT {FOLDER_COLUMNS} FROM folders WHERE folder_id = ?");
        let row = sqlx::query(sqlx::AssertSqlSafe(sql))
            .bind(folder_id.to_string())
            .fetch_optional(self.pool())
            .await
            .map_err(backend)?;
        row.as_ref().map(folder_from_row).transpose()
    }

    async fn load_task(&self, task_id: TaskId) -> Result<Option<Task>, StoreError> {
        let sql = format!("SELECT {TASK_COLUMNS} FROM tasks WHERE task_id = ?");
        let row = sqlx::query(sqlx::AssertSqlSafe(sql))
            .bind(task_id.to_string())
            .fetch_optional(self.pool())
            .await
            .map_err(backend)?;
        row.as_ref().map(task_from_row).transpose()
    }

    async fn load_workspace_label(
        &self,
        principal_id: PrincipalId,
        workspace_id: WorkspaceId,
    ) -> Result<Option<WorkspaceLabel>, StoreError> {
        let sql = format!(
            "SELECT {LABEL_COLUMNS} FROM workspace_labels WHERE principal_id = ? AND workspace_id = ?"
        );
        let row = sqlx::query(sqlx::AssertSqlSafe(sql))
            .bind(principal_id.to_string())
            .bind(workspace_id.to_string())
            .fetch_optional(self.pool())
            .await
            .map_err(backend)?;
        row.as_ref().map(label_from_row).transpose()
    }

    async fn commit_organise(&self, change: OrganiseChange) -> Result<(), StoreError> {
        let OrganiseChange {
            expected_revision,
            record,
            receipt,
        } = change;
        let consistent = expected_revision.next().ok() == Some(record.revision())
            && receipt.expected_revision == expected_revision
            && receipt.resulting_revision == record.revision()
            && receipt.resource_id == record.resource_id();
        if !consistent {
            return Err(StoreError::Backend(
                "organise change revisions are inconsistent".to_string(),
            ));
        }

        // IMMEDIATE takes the write lock first, so the revision read cannot go
        // stale before the writes; dropping the transaction rolls everything back.
        let mut tx = self
            .pool()
            .begin_with("BEGIN IMMEDIATE")
            .await
            .map_err(backend)?;
        // A receipt recorded by a concurrent writer of the same operation wins
        // over the revision and uniqueness checks, so the caller replays (or
        // refuses) it instead of reporting that writer's change as a conflict.
        let recorded: Option<i64> =
            sqlx::query_scalar("SELECT 1 FROM organise_receipts WHERE operation_id = ?")
                .bind(receipt.operation_id.as_str())
                .fetch_optional(&mut *tx)
                .await
                .map_err(backend)?;
        if recorded.is_some() {
            return Err(StoreError::DuplicateOperation {
                operation_id: receipt.operation_id,
            });
        }
        let actual = current_revision(&mut tx, &record).await?;
        if actual != expected_revision {
            return Err(StoreError::RevisionConflict {
                expected: expected_revision,
                actual,
            });
        }
        write_record(&mut tx, &record, expected_revision).await?;
        if expected_revision == Revision::ZERO && receipt.command == OrganiseCommandKind::CreateTask {
            if let OrganiseRecord::Task(task) = &record {
                if task.creator_principal_id != receipt.principal_id || task.runtime_thread_id.is_some() || !task.source_refs.is_empty() || !task.artifact_refs.is_empty() {
                    return Err(StoreError::Backend("native draft provenance is inconsistent".into()));
                }
                sqlx::query("INSERT INTO task_metadata_provenance(task_id,principal_id,workspace_id,provenance_kind) VALUES(?,?,?,'draft_metadata')")
                    .bind(task.task_id.to_string()).bind(task.creator_principal_id.to_string()).bind(task.workspace_id.to_string())
                    .execute(&mut *tx).await.map_err(backend)?;
            }
        }


        sqlx::query(
            "INSERT INTO organise_receipts (operation_id, principal_id, command, resource_id, \
             expected_revision, resulting_revision, request, status, recorded_at_ms) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(receipt.operation_id.as_str())
        .bind(receipt.principal_id.to_string())
        .bind(receipt.command.as_str())
        .bind(receipt.resource_id.to_string())
        .bind(to_db(receipt.expected_revision)?)
        .bind(to_db(receipt.resulting_revision)?)
        .bind(&receipt.request)
        .bind(receipt.status.as_str())
        .bind(receipt.recorded_at.unix_millis())
        .execute(&mut *tx)
        .await
        .map_err(|error| {
            if error
                .as_database_error()
                .is_some_and(sqlx::error::DatabaseError::is_unique_violation)
            {
                StoreError::DuplicateOperation {
                    operation_id: receipt.operation_id.clone(),
                }
            } else {
                backend(error)
            }
        })?;

        tx.commit().await.map_err(backend)
    }

    async fn load_workspace_tree(
        &self,
        workspace_id: WorkspaceId,
        creator: PrincipalId,
    ) -> Result<WorkspaceTree, StoreError> {
        let workspace = workspace_id.to_string();
        let engagements = sqlx::query(sqlx::AssertSqlSafe(format!(
            "SELECT {ENGAGEMENT_COLUMNS} FROM engagements WHERE workspace_id = ? \
             ORDER BY name COLLATE NOCASE, created_at_ms, engagement_id"
        )))
        .bind(&workspace)
        .fetch_all(self.pool())
        .await
        .map_err(backend)?;
        let folders = sqlx::query(sqlx::AssertSqlSafe(format!(
            "SELECT {FOLDER_COLUMNS} FROM folders WHERE workspace_id = ? \
             ORDER BY name COLLATE NOCASE, created_at_ms, folder_id"
        )))
        .bind(&workspace)
        .fetch_all(self.pool())
        .await
        .map_err(backend)?;
        // Only the creator's own Tasks: membership never lists another creator's.
        let tasks = sqlx::query(sqlx::AssertSqlSafe(format!(
            "SELECT {TASK_COLUMNS} FROM tasks WHERE workspace_id = ? AND creator_principal_id = ? \
             ORDER BY created_at_ms, task_id"
        )))
        .bind(&workspace)
        .bind(creator.to_string())
        .fetch_all(self.pool())
        .await
        .map_err(backend)?;
        Ok(WorkspaceTree {
            engagements: engagements
                .iter()
                .map(engagement_from_row)
                .collect::<Result<_, _>>()?,
            folders: folders
                .iter()
                .map(folder_from_row)
                .collect::<Result<_, _>>()?,
            tasks: tasks.iter().map(task_from_row).collect::<Result<_, _>>()?,
        })
    }

    async fn load_known_workspaces(
        &self,
        principal_id: PrincipalId,
    ) -> Result<Vec<KnownWorkspace>, StoreError> {
        let principal = principal_id.to_string();
        let rows = sqlx::query(
            "SELECT known.workspace_id AS known_workspace_id, labels.principal_id, \
             labels.workspace_id, labels.name, labels.revision, labels.updated_at_ms \
             FROM (SELECT workspace_id FROM workspace_labels WHERE principal_id = ?1 \
                   UNION SELECT workspace_id FROM tasks WHERE creator_principal_id = ?1) AS known \
             LEFT JOIN workspace_labels AS labels \
               ON labels.principal_id = ?1 AND labels.workspace_id = known.workspace_id \
             ORDER BY labels.name COLLATE NOCASE, known.workspace_id",
        )
        .bind(&principal)
        .fetch_all(self.pool())
        .await
        .map_err(backend)?;
        rows.iter()
            .map(|row| {
                let workspace_id = workspace_id(row, "known_workspace_id")?;
                let has_label: Option<String> = row.try_get("name").map_err(backend)?;
                let label = match has_label {
                    Some(_) => Some(label_from_row(row)?),
                    None => None,
                };
                Ok(KnownWorkspace {
                    workspace_id,
                    label,
                })
            })
            .collect()
    }
}

async fn current_revision(
    tx: &mut Transaction<'_, Sqlite>,
    record: &OrganiseRecord,
) -> Result<Revision, StoreError> {
    let (sql, keys): (&'static str, Vec<String>) = match record {
        OrganiseRecord::Engagement(r) => (
            "SELECT revision FROM engagements WHERE engagement_id = ?",
            vec![r.engagement_id.to_string()],
        ),
        OrganiseRecord::Folder(r) => (
            "SELECT revision FROM folders WHERE folder_id = ?",
            vec![r.folder_id.to_string()],
        ),
        OrganiseRecord::Task(r) => (
            "SELECT revision FROM tasks WHERE task_id = ?",
            vec![r.task_id.to_string()],
        ),
        OrganiseRecord::WorkspaceLabel(r) => (
            "SELECT revision FROM workspace_labels WHERE principal_id = ? AND workspace_id = ?",
            vec![r.principal_id.to_string(), r.workspace_id.to_string()],
        ),
    };
    let mut query = sqlx::query_scalar::<_, i64>(sql);
    for key in keys {
        query = query.bind(key);
    }
    let actual = query.fetch_optional(&mut **tx).await.map_err(backend)?;
    Ok(Revision::new(from_db(actual.unwrap_or(0), "revision")?))
}

async fn write_record(
    tx: &mut Transaction<'_, Sqlite>,
    record: &OrganiseRecord,
    expected: Revision,
) -> Result<(), StoreError> {
    let create = expected == Revision::ZERO;
    let revision = to_db(record.revision())?;
    let expected = to_db(expected)?;
    let written = match record {
        OrganiseRecord::Engagement(r) => {
            let sql = if create {
                "INSERT INTO engagements (engagement_id, workspace_id, service_engagement_id, \
                 name, objectives, scope, client_entity, period_start, period_end, revision, \
                 created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"
            } else {
                "UPDATE engagements SET workspace_id = ?2, service_engagement_id = ?3, name = ?4, \
                 objectives = ?5, scope = ?6, client_entity = ?7, period_start = ?8, \
                 period_end = ?9, revision = ?10, created_at_ms = ?11, updated_at_ms = ?12 \
                 WHERE engagement_id = ?1 AND revision = ?13"
            };
            sqlx::query(sql)
                .bind(r.engagement_id.to_string())
                .bind(r.workspace_id.to_string())
                .bind(r.service_engagement_id.to_string())
                .bind(&r.name)
                .bind(&r.objectives)
                .bind(&r.scope)
                .bind(r.client_entity.as_deref())
                .bind(r.period_start.as_ref().map(PeriodDate::as_str))
                .bind(r.period_end.as_ref().map(PeriodDate::as_str))
                .bind(revision)
                .bind(r.created_at.unix_millis())
                .bind(r.updated_at.unix_millis())
                .bind_if_update(create, expected)
                .execute(&mut **tx)
                .await
        }
        OrganiseRecord::Folder(r) => {
            let sql = if create {
                "INSERT INTO folders (folder_id, engagement_id, workspace_id, name, revision, \
                 created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
            } else {
                "UPDATE folders SET engagement_id = ?2, workspace_id = ?3, name = ?4, \
                 revision = ?5, created_at_ms = ?6, updated_at_ms = ?7 \
                 WHERE folder_id = ?1 AND revision = ?8"
            };
            sqlx::query(sql)
                .bind(r.folder_id.to_string())
                .bind(r.engagement_id.to_string())
                .bind(r.workspace_id.to_string())
                .bind(&r.name)
                .bind(revision)
                .bind(r.created_at.unix_millis())
                .bind(r.updated_at.unix_millis())
                .bind_if_update(create, expected)
                .execute(&mut **tx)
                .await
        }
        OrganiseRecord::Task(r) => {
            let sql = if create {
                "INSERT INTO tasks (task_id, workspace_id, creator_principal_id, engagement_id, \
                 folder_id, title, runtime_thread_id, source_refs, artifact_refs, visibility, \
                 revision, created_at_ms, updated_at_ms) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)"
            } else {
                "UPDATE tasks SET workspace_id = ?2, creator_principal_id = ?3, \
                 engagement_id = ?4, folder_id = ?5, title = ?6, runtime_thread_id = ?7, \
                 source_refs = ?8, artifact_refs = ?9, visibility = ?10, revision = ?11, \
                 created_at_ms = ?12, updated_at_ms = ?13 WHERE task_id = ?1 AND revision = ?14"
            };
            sqlx::query(sql)
                .bind(r.task_id.to_string())
                .bind(r.workspace_id.to_string())
                .bind(r.creator_principal_id.to_string())
                .bind(r.engagement_id.map(|id| id.to_string()))
                .bind(r.folder_id.map(|id| id.to_string()))
                .bind(&r.title)
                .bind(r.runtime_thread_id.as_deref())
                .bind(refs_to_db(&r.source_refs)?)
                .bind(refs_to_db(&r.artifact_refs)?)
                .bind(r.visibility.as_str())
                .bind(revision)
                .bind(r.created_at.unix_millis())
                .bind(r.updated_at.unix_millis())
                .bind_if_update(create, expected)
                .execute(&mut **tx)
                .await
        }
        OrganiseRecord::WorkspaceLabel(r) => {
            let sql = if create {
                "INSERT INTO workspace_labels (principal_id, workspace_id, name, revision, \
                 updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5)"
            } else {
                "UPDATE workspace_labels SET name = ?3, revision = ?4, updated_at_ms = ?5 \
                 WHERE principal_id = ?1 AND workspace_id = ?2 AND revision = ?6"
            };
            sqlx::query(sql)
                .bind(r.principal_id.to_string())
                .bind(r.workspace_id.to_string())
                .bind(&r.name)
                .bind(revision)
                .bind(r.updated_at.unix_millis())
                .bind_if_update(create, expected)
                .execute(&mut **tx)
                .await
        }
    }
    .map_err(backend)?;
    if written.rows_affected() != 1 {
        return Err(StoreError::Backend(
            "the record was not written".to_string(),
        ));
    }
    Ok(())
}

/// Binds the expected revision only for an update; an insert has no such parameter.
trait BindIfUpdate: Sized {
    fn bind_if_update(self, create: bool, expected: i64) -> Self;
}

impl<'q> BindIfUpdate for sqlx::query::Query<'q, Sqlite, sqlx::sqlite::SqliteArguments> {
    fn bind_if_update(self, create: bool, expected: i64) -> Self {
        if create { self } else { self.bind(expected) }
    }
}

fn receipt_from_row(row: &SqliteRow) -> Result<OrganiseReceipt, StoreError> {
    let operation_id: String = row.try_get("operation_id").map_err(backend)?;
    let operation_id = OperationId::parse(&operation_id)
        .map_err(|error| corrupt(format!("organise_receipts.operation_id: {error}")))?;
    let command: String = row.try_get("command").map_err(backend)?;
    let command = OrganiseCommandKind::parse(&command)
        .ok_or_else(|| corrupt(format!("organise_receipts.command: unknown {command:?}")))?;
    let status: String = row.try_get("status").map_err(backend)?;
    let status = ReceiptStatus::parse(&status)
        .ok_or_else(|| corrupt(format!("organise_receipts.status: unknown {status:?}")))?;
    Ok(OrganiseReceipt {
        operation_id,
        principal_id: PrincipalId::from_uuid(uuid(row, "principal_id")?),
        command,
        resource_id: uuid(row, "resource_id")?,
        expected_revision: revision(row, "expected_revision")?,
        resulting_revision: revision(row, "resulting_revision")?,
        request: row.try_get("request").map_err(backend)?,
        status,
        recorded_at: timestamp(row, "recorded_at_ms")?,
    })
}

fn engagement_from_row(row: &SqliteRow) -> Result<Engagement, StoreError> {
    Ok(Engagement {
        engagement_id: EngagementId::from_uuid(uuid(row, "engagement_id")?),
        workspace_id: workspace_id(row, "workspace_id")?,
        service_engagement_id: ServiceEngagementId::from_uuid(uuid(row, "service_engagement_id")?),
        name: row.try_get("name").map_err(backend)?,
        objectives: row.try_get("objectives").map_err(backend)?,
        scope: row.try_get("scope").map_err(backend)?,
        client_entity: row.try_get("client_entity").map_err(backend)?,
        period_start: date(row, "period_start")?,
        period_end: date(row, "period_end")?,
        revision: revision(row, "revision")?,
        created_at: timestamp(row, "created_at_ms")?,
        updated_at: timestamp(row, "updated_at_ms")?,
    })
}

fn folder_from_row(row: &SqliteRow) -> Result<Folder, StoreError> {
    Ok(Folder {
        folder_id: FolderId::from_uuid(uuid(row, "folder_id")?),
        engagement_id: EngagementId::from_uuid(uuid(row, "engagement_id")?),
        workspace_id: workspace_id(row, "workspace_id")?,
        name: row.try_get("name").map_err(backend)?,
        revision: revision(row, "revision")?,
        created_at: timestamp(row, "created_at_ms")?,
        updated_at: timestamp(row, "updated_at_ms")?,
    })
}

fn task_from_row(row: &SqliteRow) -> Result<Task, StoreError> {
    let visibility: String = row.try_get("visibility").map_err(backend)?;
    let engagement_id: Option<String> = row.try_get("engagement_id").map_err(backend)?;
    let folder_id: Option<String> = row.try_get("folder_id").map_err(backend)?;
    Ok(Task {
        task_id: TaskId::from_uuid(uuid(row, "task_id")?),
        workspace_id: workspace_id(row, "workspace_id")?,
        creator_principal_id: PrincipalId::from_uuid(uuid(row, "creator_principal_id")?),
        engagement_id: engagement_id
            .map(|id| parse_uuid(&id, "tasks.engagement_id").map(EngagementId::from_uuid))
            .transpose()?,
        folder_id: folder_id
            .map(|id| parse_uuid(&id, "tasks.folder_id").map(FolderId::from_uuid))
            .transpose()?,
        title: row.try_get("title").map_err(backend)?,
        runtime_thread_id: row.try_get("runtime_thread_id").map_err(backend)?,
        source_refs: refs_from_db(row, "source_refs")?,
        artifact_refs: refs_from_db(row, "artifact_refs")?,
        visibility: Visibility::parse(&visibility)
            .ok_or_else(|| corrupt(format!("tasks.visibility: unknown {visibility:?}")))?,
        revision: revision(row, "revision")?,
        created_at: timestamp(row, "created_at_ms")?,
        updated_at: timestamp(row, "updated_at_ms")?,
    })
}

fn label_from_row(row: &SqliteRow) -> Result<WorkspaceLabel, StoreError> {
    Ok(WorkspaceLabel {
        principal_id: PrincipalId::from_uuid(uuid(row, "principal_id")?),
        workspace_id: workspace_id(row, "workspace_id")?,
        name: row.try_get("name").map_err(backend)?,
        revision: revision(row, "revision")?,
        updated_at: timestamp(row, "updated_at_ms")?,
    })
}

fn parse_uuid(value: &str, column: &str) -> Result<Uuid, StoreError> {
    Uuid::parse_str(value).map_err(|error| corrupt(format!("{column}: {error}")))
}

fn uuid(row: &SqliteRow, column: &str) -> Result<Uuid, StoreError> {
    let value: String = row.try_get(column).map_err(backend)?;
    parse_uuid(&value, column)
}

fn workspace_id(row: &SqliteRow, column: &str) -> Result<WorkspaceId, StoreError> {
    uuid(row, column).map(WorkspaceId::from_uuid)
}

fn date(row: &SqliteRow, column: &str) -> Result<Option<PeriodDate>, StoreError> {
    let value: Option<String> = row.try_get(column).map_err(backend)?;
    value
        .map(|value| {
            PeriodDate::parse(&value, column).map_err(|error| corrupt(format!("{column}: {error}")))
        })
        .transpose()
}

fn revision(row: &SqliteRow, column: &str) -> Result<Revision, StoreError> {
    let value: i64 = row.try_get(column).map_err(backend)?;
    Ok(Revision::new(from_db(value, column)?))
}

fn timestamp(row: &SqliteRow, column: &str) -> Result<Timestamp, StoreError> {
    let value: i64 = row.try_get(column).map_err(backend)?;
    Ok(Timestamp::from_unix_millis(value))
}

fn refs_to_db(refs: &[String]) -> Result<String, StoreError> {
    serde_json::to_string(refs).map_err(|error| StoreError::Backend(error.to_string()))
}

fn refs_from_db(row: &SqliteRow, column: &str) -> Result<Vec<String>, StoreError> {
    let value: String = row.try_get(column).map_err(backend)?;
    serde_json::from_str(&value).map_err(|error| corrupt(format!("tasks.{column}: {error}")))
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
