//! Creator-scoped durable start journal. Errors and receipts contain no text.
use crate::SqliteWorkingStore;
use inquello_domain::organise::PrincipalId;
use inquello_domain::tasks::*;
use inquello_domain::usage::TaskUsageSettings;
use inquello_domain::{DomainError,OperationId,StoreError};
use sqlx::{Sqlite,Transaction};
use uuid::Uuid;
type Tx<'a> = Transaction<'a,Sqlite>;
fn backend(_:sqlx::Error)->DomainError {DomainError::Store(StoreError::Backend("private Task journal storage failure".into()))}
fn invalid(s:&str)->DomainError {DomainError::InvalidCommand(s.into())}
fn encode_binding(v:&TaskRunBinding)->Result<String,DomainError>{serde_json::to_string(v).map_err(|_|invalid("invalid Task record"))}
fn encode_intent(v:&StartTaskIntent)->Result<String,DomainError>{serde_json::to_string(v).map_err(|_|invalid("invalid Task record"))}
fn encode_settings(v:&TaskUsageSettings)->Result<String,DomainError>{serde_json::to_string(v).map_err(|_|invalid("invalid Task settings"))}
fn decode_binding(v:&str)->Result<TaskRunBinding,DomainError>{serde_json::from_str(v).map_err(|_|DomainError::Store(StoreError::Corrupt("invalid Task record".into())))}
fn decode_intent(v:&str)->Result<StartTaskIntent,DomainError>{serde_json::from_str(v).map_err(|_|DomainError::Store(StoreError::Corrupt("invalid Task record".into())))}
fn reference(v:&str)->Result<(),DomainError>{if v.is_empty()||v.len()>128||v.chars().any(|c|c.is_control()||c.is_whitespace()){Err(invalid("invalid runtime reference"))}else{Ok(())}}
async fn load(tx:&mut Tx<'_>,p:PrincipalId,op:&str)->Result<Option<TaskRunBinding>,DomainError>{
 let raw:Option<String>=sqlx::query_scalar("SELECT r.record FROM task_runs r JOIN tasks t ON t.task_id=r.task_id WHERE r.principal_id=? AND r.operation_id=? AND t.creator_principal_id=r.principal_id AND t.workspace_id=json_extract(r.record,'$.workspace_id') AND (r.thread_id IS NULL OR t.runtime_thread_id=r.thread_id)").bind(p.to_string()).bind(op).fetch_optional(&mut **tx).await.map_err(backend)?;
 raw.as_deref().map(decode_binding).transpose()
}
async fn write(tx:&mut Tx<'_>,b:&TaskRunBinding)->Result<(),DomainError>{
 sqlx::query("UPDATE task_runs SET thread_id=?,record=? WHERE principal_id=? AND operation_id=?").bind(&b.thread_id).bind(encode_binding(b)?).bind(&b.principal_id).bind(&b.operation_id).execute(&mut **tx).await.map_err(backend)?;Ok(())
}
impl TaskRunStore for SqliteWorkingStore {
 async fn reserve_task_run(&self,p:PrincipalId,intent:StartTaskIntent,runtime:&str,now:i64)->Result<TaskRunBinding,DomainError>{
  self.reserve_task_run_fenced(p,intent,runtime,now,||async {Ok(())}).await.map_err(TaskReservationError::into_domain)
 }
 async fn reserve_task_run_fenced<F,Fut>(&self,p:PrincipalId,intent:StartTaskIntent,runtime:&str,now:i64,validate:F)->Result<TaskRunBinding,TaskReservationError>
 where F:Fn()->Fut+Send+Sync,Fut:std::future::Future<Output=Result<(),DomainError>>+Send {
  intent.validate().map_err(TaskReservationError::PreEffect)?;reference(runtime).map_err(TaskReservationError::PreEffect)?;
  let mut tx=self.pool().begin_with("BEGIN IMMEDIATE").await.map_err(backend)?;
  if let Err(error)=validate().await {tx.rollback().await.map_err(backend)?;return Err(TaskReservationError::PreEffect(error));}
  if let Some(old)=load(&mut tx,p,&intent.operation_id).await?{
   let raw:String=sqlx::query_scalar("SELECT intent FROM task_start_history WHERE task_id=?").bind(&old.task_id).fetch_one(&mut *tx).await.map_err(backend)?;
   if decode_intent(&raw)?!=intent{return Err(TaskReservationError::PreEffect(DomainError::OperationConflict{operation_id:OperationId::parse(&intent.operation_id)?}))}return Ok(old)
  }
  let latest:Option<i64>=sqlx::query_scalar("SELECT MAX(revision) FROM processing_route_candidates WHERE principal_id=? AND route_id=?").bind(p.to_string()).bind(&intent.route_id).fetch_one(&mut *tx).await.map_err(backend)?;
  if latest!=Some(intent.configuration_revision as i64){return Err(TaskReservationError::PreEffect(invalid("route configuration changed; explicitly reconfirm route and settings")))}
  if let Some(id)=&intent.engagement_id {
   let workspace:Option<String>=sqlx::query_scalar("SELECT workspace_id FROM engagements WHERE engagement_id=?").bind(id).fetch_optional(&mut *tx).await.map_err(backend)?;
   if workspace.as_deref()!=Some(intent.workspace_id.as_str()){return Err(TaskReservationError::PreEffect(DomainError::NotFound))}
  }
  if let Some(id)=&intent.folder_id {
   let engagement:Option<String>=sqlx::query_scalar("SELECT engagement_id FROM folders WHERE folder_id=? AND workspace_id=?").bind(id).bind(&intent.workspace_id).fetch_optional(&mut *tx).await.map_err(backend)?;
   if engagement!=intent.engagement_id{return Err(TaskReservationError::PreEffect(DomainError::NotFound))}
  }
  let b=TaskRunBinding{operation_id:intent.operation_id.clone(),task_id:Uuid::new_v4().to_string(),run_id:Uuid::new_v4().to_string(),principal_id:p.to_string(),workspace_id:intent.workspace_id.clone(),runtime_id:runtime.into(),thread_id:None,turn_id:None,status:TaskRunStatus::Reserved,route_id:intent.route_id.clone(),configuration_revision:intent.configuration_revision,choices:intent.choices.clone(),setup_failure:None};
  sqlx::query("INSERT INTO tasks(task_id,workspace_id,creator_principal_id,engagement_id,folder_id,title,source_refs,artifact_refs,visibility,revision,created_at_ms,updated_at_ms) VALUES(?,?,?,?,?,'Private task','[]','[]','private',1,?,?)").bind(&b.task_id).bind(&b.workspace_id).bind(&b.principal_id).bind(&intent.engagement_id).bind(&intent.folder_id).bind(now).bind(now).execute(&mut *tx).await.map_err(backend)?;
  sqlx::query("INSERT INTO task_start_history(task_id,intent) VALUES(?,?)").bind(&b.task_id).bind(encode_intent(&intent)?).execute(&mut *tx).await.map_err(backend)?;
  sqlx::query("INSERT INTO task_runs(principal_id,operation_id,task_id,runtime_id,record) VALUES(?,?,?,?,?)").bind(&b.principal_id).bind(&b.operation_id).bind(&b.task_id).bind(runtime).bind(encode_binding(&b)?).execute(&mut *tx).await.map_err(backend)?;
  sqlx::query("INSERT INTO task_processing_routes(task_id,revision,principal_id,route_id,configuration_revision,recorded_at_ms) VALUES(?,1,?,?,?,?)").bind(&b.task_id).bind(&b.principal_id).bind(&b.route_id).bind(b.configuration_revision as i64).bind(now).execute(&mut *tx).await.map_err(backend)?;
  let settings=TaskUsageSettings{revision:1,route_revision:1,choices:b.choices.clone()};
  sqlx::query("INSERT INTO task_usage_settings(task_id,revision,record) VALUES(?,1,?)").bind(&b.task_id).bind(encode_settings(&settings)?).execute(&mut *tx).await.map_err(backend)?;
  if let Err(error)=validate().await {tx.rollback().await.map_err(backend)?;return Err(TaskReservationError::PreEffect(error));}
  tx.commit().await.map_err(backend)?;Ok(b)
 }
 async fn find_task_run(&self,p:PrincipalId,op:&str)->Result<Option<TaskRunBinding>,DomainError>{OperationId::parse(op)?;let mut tx=self.pool().begin().await.map_err(backend)?;load(&mut tx,p,op).await}
 async fn task_run_request(&self,p:PrincipalId,op:&str)->Result<String,DomainError>{
  let mut tx=self.pool().begin().await.map_err(backend)?;let b=load(&mut tx,p,op).await?.ok_or(DomainError::NotFound)?;
  let raw:String=sqlx::query_scalar("SELECT intent FROM task_start_history WHERE task_id=?").bind(&b.task_id).fetch_one(&mut *tx).await.map_err(backend)?;Ok(decode_intent(&raw)?.request)
 }
 async fn find_thread_run(&self,p:PrincipalId,runtime:&str,thread:&str)->Result<Option<TaskRunBinding>,DomainError>{
  let mut tx=self.pool().begin().await.map_err(backend)?;let op:Option<String>=sqlx::query_scalar("SELECT operation_id FROM task_runs WHERE principal_id=? AND runtime_id=? AND thread_id=?").bind(p.to_string()).bind(runtime).bind(thread).fetch_optional(&mut *tx).await.map_err(backend)?;
  match op{Some(op)=>load(&mut tx,p,&op).await,None=>Ok(None)}
 }
 async fn bind_task_thread(&self,p:PrincipalId,op:&str,runtime:&str,thread:&str)->Result<TaskRunBinding,DomainError>{
  reference(thread)?;let mut tx=self.pool().begin_with("BEGIN IMMEDIATE").await.map_err(backend)?;let mut b=load(&mut tx,p,op).await?.ok_or(DomainError::NotFound)?;
  if b.runtime_id!=runtime{return Err(invalid("runtime binding changed"))}if b.thread_id.as_deref()==Some(thread){return Ok(b)}
  if b.status!=TaskRunStatus::Reserved||b.thread_id.is_some(){return Err(invalid("Task thread association is immutable"))}
  b.thread_id=Some(thread.into());b.status=TaskRunStatus::Bound;
  let n=sqlx::query("UPDATE tasks SET runtime_thread_id=?,revision=revision+1 WHERE task_id=? AND creator_principal_id=? AND runtime_thread_id IS NULL").bind(thread).bind(&b.task_id).bind(p.to_string()).execute(&mut *tx).await.map_err(backend)?;
  if n.rows_affected()!=1{return Err(invalid("Task thread ownership changed"))}write(&mut tx,&b).await?;tx.commit().await.map_err(backend)?;Ok(b)
 }
 async fn claim_task_dispatch(&self,p:PrincipalId,op:&str,runtime:&str)->Result<TaskRunBinding,DomainError>{
  let mut tx=self.pool().begin_with("BEGIN IMMEDIATE").await.map_err(backend)?;let mut b=load(&mut tx,p,op).await?.ok_or(DomainError::NotFound)?;
  if b.runtime_id!=runtime||b.status!=TaskRunStatus::Bound||b.thread_id.is_none(){return Err(invalid("dispatch already claimed or binding unavailable; reconcile without retry"))}
  b.status=TaskRunStatus::Dispatching;write(&mut tx,&b).await?;tx.commit().await.map_err(backend)?;Ok(b)
 }
 async fn mark_task_run(&self,p:PrincipalId,op:&str,status:TaskRunStatus,turn:Option<&str>)->Result<TaskRunBinding,DomainError>{
  if status==TaskRunStatus::SetupFailed {return Err(invalid("Use explicit proven setup failure operation"))}
  if let Some(t)=turn{reference(t)?}let mut tx=self.pool().begin_with("BEGIN IMMEDIATE").await.map_err(backend)?;let mut b=load(&mut tx,p,op).await?.ok_or(DomainError::NotFound)?;
  if b.turn_id.is_some()&&turn.is_some()&&b.turn_id.as_deref()!=turn{return Err(invalid("Task turn association is immutable"))}
  let allowed=b.status==status||match b.status{
   TaskRunStatus::Reserved|TaskRunStatus::Bound=>matches!(status,TaskRunStatus::Failed|TaskRunStatus::Cancelled|TaskRunStatus::Uncertain),
   TaskRunStatus::Dispatching|TaskRunStatus::Running=>matches!(status,TaskRunStatus::Running|TaskRunStatus::Completed|TaskRunStatus::Failed|TaskRunStatus::Cancelled|TaskRunStatus::Uncertain),_=>false};
  if !allowed{return Err(invalid("Task state cannot be redispatched or inferred from uncertainty"))}
  if matches!(status,TaskRunStatus::Running|TaskRunStatus::Completed)&&turn.is_none()&&b.turn_id.is_none(){return Err(invalid("accepted runtime turn identity required"))}
  b.status=status;if let Some(t)=turn{b.turn_id=Some(t.into())}write(&mut tx,&b).await?;tx.commit().await.map_err(backend)?;Ok(b)
 }
 async fn fail_task_setup(&self,p:PrincipalId,op:&str,failure:TaskSetupFailure)->Result<TaskRunBinding,DomainError>{
  let mut tx=self.pool().begin_with("BEGIN IMMEDIATE").await.map_err(backend)?;
  let mut b=load(&mut tx,p,op).await?.ok_or(DomainError::NotFound)?;
  if b.turn_id.is_some() || !matches!(b.status,TaskRunStatus::Reserved|TaskRunStatus::Bound|TaskRunStatus::Dispatching){return Err(invalid("First-turn non-submission is not proven"))}
  b.status=TaskRunStatus::SetupFailed;b.setup_failure=Some(failure);write(&mut tx,&b).await?;tx.commit().await.map_err(backend)?;Ok(b)
 }
 async fn observe_task_terminal(&self,p:PrincipalId,op:&str,runtime:&str,thread:&str,turn:&str,status:TaskRunStatus)->Result<TaskRunBinding,DomainError>{
  reference(turn)?;let mut tx=self.pool().begin_with("BEGIN IMMEDIATE").await.map_err(backend)?;
  let mut b=load(&mut tx,p,op).await?.ok_or(DomainError::NotFound)?;
  if b.runtime_id!=runtime || b.thread_id.as_deref()!=Some(thread) || b.turn_id.as_deref().is_some_and(|id|id!=turn)
   || !matches!(status,TaskRunStatus::Completed|TaskRunStatus::Failed|TaskRunStatus::Cancelled)
   || !(matches!(b.status,TaskRunStatus::Dispatching|TaskRunStatus::Running|TaskRunStatus::Uncertain) || b.status==status){return Err(invalid("Terminal observation does not match the immutable retained turn"))}
  b.turn_id=Some(turn.into());b.status=status;write(&mut tx,&b).await?;tx.commit().await.map_err(backend)?;Ok(b)
 }
 async fn recover_task_runtime(&self,runtime:&str)->Result<u64,DomainError>{
  let mut tx=self.pool().begin_with("BEGIN IMMEDIATE").await.map_err(backend)?;let rows:Vec<String>=sqlx::query_scalar("SELECT record FROM task_runs WHERE runtime_id=?").bind(runtime).fetch_all(&mut *tx).await.map_err(backend)?;
  let mut count=0;for raw in rows{let mut b:TaskRunBinding=decode_binding(&raw)?;if matches!(b.status,TaskRunStatus::Reserved|TaskRunStatus::Bound|TaskRunStatus::Dispatching|TaskRunStatus::Running){b.status=TaskRunStatus::Uncertain;write(&mut tx,&b).await?;count+=1}}
  tx.commit().await.map_err(backend)?;Ok(count)
 }
}
