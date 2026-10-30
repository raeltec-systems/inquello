//! Native-only, atomic private usage ledger. Each mutation holds a SQLite write
//! transaction from creator check through idempotency check and persistence.
use crate::SqliteWorkingStore;
use inquello_domain::organise::{PrincipalId, TaskId};
use inquello_domain::usage::*;
use inquello_domain::{DomainError, OperationId, Revision, StoreError};
use serde::{Serialize, de::DeserializeOwned};
use sqlx::{Row, Sqlite, Transaction};

type Tx<'a> = Transaction<'a, Sqlite>;
fn backend(e:sqlx::Error)->DomainError { DomainError::Store(StoreError::Backend(e.to_string())) }
fn invalid(s:&str)->DomainError { DomainError::InvalidCommand(s.into()) }
fn encode<T:Serialize>(v:&T)->Result<String,DomainError> { serde_json::to_string(v).map_err(|_|invalid("invalid usage record")) }
fn decode<T:DeserializeOwned>(s:&str)->Result<T,DomainError> { serde_json::from_str(s).map_err(|_|DomainError::Store(StoreError::Corrupt("invalid usage record".into()))) }
async fn creator(tx:&mut Tx<'_>,principal:PrincipalId,task:TaskId)->Result<(),DomainError> {
    let id:Option<String> = sqlx::query_scalar("SELECT creator_principal_id FROM tasks WHERE task_id = ?")
        .bind(task.to_string()).fetch_optional(&mut **tx).await.map_err(backend)?;
    if id.as_deref()!=Some(principal.to_string().as_str()) {return Err(DomainError::NotFound)} Ok(())
}
async fn settings(tx:&mut Tx<'_>,task:TaskId)->Result<Option<TaskUsageSettings>,DomainError> {
    let s:Option<String>=sqlx::query_scalar("SELECT record FROM task_usage_settings WHERE task_id = ? ORDER BY revision DESC LIMIT 1")
        .bind(task.to_string()).fetch_optional(&mut **tx).await.map_err(backend)?;
    s.as_deref().map(decode).transpose()
}
async fn route(tx:&mut Tx<'_>,principal:PrincipalId,task:TaskId,expected:u64)->Result<(),DomainError> {
    let r=sqlx::query("SELECT t.revision, t.configuration_revision, (SELECT MAX(c.revision) FROM processing_route_candidates c WHERE c.principal_id = t.principal_id AND c.route_id = t.route_id) AS candidate_revision FROM task_processing_routes t WHERE t.task_id = ? AND t.principal_id = ? ORDER BY t.revision DESC LIMIT 1")
        .bind(task.to_string()).bind(principal.to_string()).fetch_optional(&mut **tx).await.map_err(backend)?;
    let Some(r)=r else {return Err(invalid("select a processing route first"))};
    let actual:i64=r.try_get("revision").map_err(backend)?;
    if u64::try_from(actual).ok()!=Some(expected) {return Err(DomainError::RevisionConflict {expected:Revision::new(expected),actual:Revision::new(actual as u64)})}
    let selected:i64=r.try_get("configuration_revision").map_err(backend)?;
    let latest:Option<i64>=r.try_get("candidate_revision").map_err(backend)?;
    if latest!=Some(selected) {return Err(invalid("route configuration changed; explicitly correct selection and settings"))} Ok(())
}
async fn load_attempt(tx:&mut Tx<'_>,principal:PrincipalId,task:TaskId,id:&str)->Result<AttemptRecord,DomainError> {
    creator(tx,principal,task).await?;
    let s:Option<String>=sqlx::query_scalar("SELECT record FROM task_usage_attempts WHERE attempt_id = ? AND task_id = ? AND principal_id = ?")
        .bind(id).bind(task.to_string()).bind(principal.to_string()).fetch_optional(&mut **tx).await.map_err(backend)?;
    decode(&s.ok_or(DomainError::NotFound)?)
}
async fn write_attempt(tx:&mut Tx<'_>,record:&AttemptRecord)->Result<(),DomainError> {
    sqlx::query("UPDATE task_usage_attempts SET record = ? WHERE attempt_id = ?")
        .bind(encode(record)?).bind(&record.snapshot.attempt_id).execute(&mut **tx).await.map_err(backend)?; Ok(())
}
impl UsageStore for SqliteWorkingStore {
    async fn read_usage(&self,principal:PrincipalId,task:TaskId)->Result<TaskUsage,DomainError> {
        let mut tx=self.pool().begin().await.map_err(backend)?; creator(&mut tx,principal,task).await?;
        let settings=settings(&mut tx,task).await?;
        let rows:Vec<String>=sqlx::query_scalar("SELECT record FROM task_usage_attempts WHERE task_id = ? AND principal_id = ? ORDER BY started_at_ms DESC, attempt_id DESC LIMIT 100")
            .bind(task.to_string()).bind(principal.to_string()).fetch_all(&mut *tx).await.map_err(backend)?;
        let attempts=rows.iter().map(|r|decode(r)).collect::<Result<Vec<_>,_>>()?;
        tx.commit().await.map_err(backend)?; Ok(TaskUsage {settings,attempts})
    }
    async fn save_usage_settings(&self,principal:PrincipalId,command:SetUsageSettings)->Result<TaskUsageSettings,DomainError> {
        let task=TaskId::parse(&command.task_id)?; let operation=OperationId::parse(&command.operation_id)?;
        let mut tx=self.pool().begin_with("BEGIN IMMEDIATE").await.map_err(backend)?; creator(&mut tx,principal,task).await?;
        let request=encode(&command)?;
        let old=sqlx::query("SELECT principal_id, task_id, request, result FROM task_usage_receipts WHERE operation_id = ?")
            .bind(operation.as_str()).fetch_optional(&mut *tx).await.map_err(backend)?;
        if let Some(old)=old {
            let owner:String=old.try_get("principal_id").map_err(backend)?; let old_task:String=old.try_get("task_id").map_err(backend)?;
            let req:String=old.try_get("request").map_err(backend)?;
            if owner!=principal.to_string() || old_task!=task.to_string() {return Err(DomainError::NotFound)}
            if req!=request {return Err(DomainError::OperationConflict {operation_id:operation})}
            return decode(&old.try_get::<String,_>("result").map_err(backend)?);
        }
        route(&mut tx,principal,task,command.route_revision).await?;
        let actual=settings(&mut tx,task).await?.map_or(0,|s|s.revision);
        if actual!=command.expected_revision {return Err(DomainError::RevisionConflict {expected:Revision::new(command.expected_revision),actual:Revision::new(actual)})}
        let revision=actual.checked_add(1).filter(|v|*v<=i64::MAX as u64).ok_or(DomainError::InvalidValue)?;
        let result=TaskUsageSettings {revision,route_revision:command.route_revision,choices:command.choices}; let json=encode(&result)?;
        sqlx::query("INSERT INTO task_usage_settings (task_id,revision,record) VALUES (?,?,?)")
            .bind(task.to_string()).bind(revision as i64).bind(&json).execute(&mut *tx).await.map_err(backend)?;
        sqlx::query("INSERT INTO task_usage_receipts (operation_id,task_id,principal_id,request,result) VALUES (?,?,?,?,?)")
            .bind(operation.as_str()).bind(task.to_string()).bind(principal.to_string()).bind(request).bind(json).execute(&mut *tx).await.map_err(backend)?;
        tx.commit().await.map_err(backend)?; Ok(result)
    }
    async fn begin_usage_attempt(&self,snapshot:AttemptSnapshot)->Result<AttemptRecord,DomainError> {
        let principal=PrincipalId::parse(&snapshot.principal_id)?; let task=TaskId::parse(&snapshot.task_id)?;
        uuid::Uuid::parse_str(&snapshot.attempt_id).map_err(|_|invalid("attempt ID must be UUID"))?;
        if snapshot.runtime_id.is_empty() || snapshot.runtime_id.len()>128 || snapshot.run_id.is_empty() || snapshot.run_id.len()>128 {return Err(invalid("invalid runtime/run identity"))}
        let mut tx=self.pool().begin_with("BEGIN IMMEDIATE").await.map_err(backend)?; creator(&mut tx,principal,task).await?;
        let exists:Option<String>=sqlx::query_scalar("SELECT record FROM task_usage_attempts WHERE attempt_id = ?").bind(&snapshot.attempt_id).fetch_optional(&mut *tx).await.map_err(backend)?;
        // Never return a reusable dispatch permit, even for an identical begin.
        if let Some(existing)=exists {
            let old:AttemptRecord=decode(&existing)?;
            if old.snapshot.principal_id!=snapshot.principal_id || old.snapshot.task_id!=snapshot.task_id {return Err(DomainError::NotFound)}
            return Err(invalid("attempt already exists; dispatch must not be replayed"));
        }
        if snapshot.operation_kind!=OperationKind::LocalTool {
            route(&mut tx,principal,task,snapshot.route_revision).await?;
            let current=settings(&mut tx,task).await?.ok_or_else(||invalid("explicitly save Task reasoning/speed defaults first"))?;
            if current.revision!=snapshot.settings_revision || current.route_revision!=snapshot.route_revision || current.choices!=snapshot.requested {return Err(invalid("Task settings changed; refresh before dispatch"))}
            if (snapshot.requested.reasoning != "default" && snapshot.requested.reasoning != snapshot.effective.reasoning) || (snapshot.requested.speed != "default" && snapshot.requested.speed != snapshot.effective.speed) {return Err(invalid("explicit settings may not be silently substituted"))}
            let r=sqlx::query("SELECT t.route_id, t.configuration_revision, c.configuration FROM task_processing_routes t JOIN processing_route_candidates c ON c.principal_id=t.principal_id AND c.route_id=t.route_id AND c.revision=t.configuration_revision WHERE t.task_id=? AND t.revision=?")
                .bind(task.to_string()).bind(snapshot.route_revision as i64).fetch_one(&mut *tx).await.map_err(backend)?;
            let route_id:String=r.try_get("route_id").map_err(backend)?; let config_revision:i64=r.try_get("configuration_revision").map_err(backend)?;
            let config:inquello_domain::routes::RouteConfigurationInput=decode(&r.try_get::<String,_>("configuration").map_err(backend)?)?;
            if snapshot.route_id.as_deref()!=Some(route_id.as_str()) || snapshot.model.as_deref()!=Some(config.model.as_str()) || snapshot.api_version.as_deref()!=Some(config.api_version.as_str()) || snapshot.configuration_revision!=config_revision as u64 {return Err(invalid("attempt route snapshot is stale"))}
        }
        let record=AttemptRecord {snapshot,status:AttemptStatus::Running,ended_at_ms:None,elapsed_ms:None,output_ref:None,usage:Consumption::default(),events:vec![]};
        sqlx::query("INSERT INTO task_usage_attempts (attempt_id,task_id,principal_id,runtime_id,started_at_ms,record) VALUES (?,?,?,?,?,?)")
            .bind(&record.snapshot.attempt_id).bind(task.to_string()).bind(principal.to_string()).bind(&record.snapshot.runtime_id).bind(record.snapshot.started_at_ms).bind(encode(&record)?).execute(&mut *tx).await.map_err(backend)?;
        tx.commit().await.map_err(backend)?; Ok(record)
    }
    async fn record_usage_event(&self,principal:PrincipalId,task:TaskId,attempt:&str,event:UsageEvent)->Result<(),DomainError> {
        if event.event_id.is_empty() || event.event_id.len()>256 {return Err(invalid("invalid event identity"))}
        let mut tx=self.pool().begin_with("BEGIN IMMEDIATE").await.map_err(backend)?; let mut record=load_attempt(&mut tx,principal,task,attempt).await?;
        if let Some(old)=record.events.iter().find(|e|e.event_id==event.event_id || e.sequence==event.sequence) {
            return if old==&event {Ok(())} else {Err(invalid("usage event identity conflict"))};
        }
        if record.events.len()>=4096 {return Err(invalid("usage event bound reached; attempt remains uncertain"))}
        if record.snapshot.operation_kind==OperationKind::LocalTool && (event.usage.input_tokens.is_some() || event.usage.output_tokens.is_some() || event.usage.cache_read_tokens.is_some() || event.usage.cache_write_tokens.is_some()) {return Err(invalid("local tools do not fabricate model tokens"))}
        record.events.push(event); record.usage=consumption(&record.events)?;
        // Late usage may enrich an uncertain record, never turn it into success.
        write_attempt(&mut tx,&record).await?; tx.commit().await.map_err(backend)
    }
    async fn finish_usage_attempt(&self,principal:PrincipalId,task:TaskId,attempt:&str,finish:FinishAttempt)->Result<(),DomainError> {
        if finish.status==AttemptStatus::Running || finish.output_ref.as_ref().is_some_and(|s|s.len()>256) {return Err(invalid("invalid attempt completion"))}
        let mut tx=self.pool().begin_with("BEGIN IMMEDIATE").await.map_err(backend)?; let mut record=load_attempt(&mut tx,principal,task,attempt).await?;
        if record.status!=AttemptStatus::Running {
            if record.status==finish.status && record.ended_at_ms==Some(finish.ended_at_ms) && record.elapsed_ms==Some(finish.elapsed_ms) && record.output_ref==finish.output_ref {return Ok(())}
            return Err(invalid("terminal attempt cannot be rewritten"));
        }
        if finish.ended_at_ms<record.snapshot.started_at_ms {return Err(invalid("completion precedes dispatch"))}
        record.status=finish.status; record.ended_at_ms=Some(finish.ended_at_ms); record.elapsed_ms=Some(finish.elapsed_ms); record.output_ref=finish.output_ref;
        write_attempt(&mut tx,&record).await?; tx.commit().await.map_err(backend)
    }
    async fn recover_usage_runtime(&self,runtime_id:&str)->Result<u64,DomainError> {
        let mut tx=self.pool().begin_with("BEGIN IMMEDIATE").await.map_err(backend)?;
        let rows:Vec<String>=sqlx::query_scalar("SELECT record FROM task_usage_attempts WHERE runtime_id = ?").bind(runtime_id).fetch_all(&mut *tx).await.map_err(backend)?;
        let mut count=0;
        for row in rows {let mut record:AttemptRecord=decode(&row)?; if record.status==AttemptStatus::Running {record.status=AttemptStatus::Uncertain; write_attempt(&mut tx,&record).await?;count+=1;}}
        tx.commit().await.map_err(backend)?; Ok(count)
    }
}
