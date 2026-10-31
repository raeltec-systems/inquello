//! Fixture-only persistence evidence: never connects to a provider.
use inquello_adapters::{SqliteWorkingStore,SystemClock};
use inquello_domain::organise::{Actor,PrincipalId,WorkspaceId,OrganiseStore};
use inquello_domain::routes::*;
use inquello_domain::tasks::*;
use inquello_domain::usage::{Choices,UsageStore};
use inquello_domain::{DomainError,Revision};
use uuid::Uuid;
fn ok<T,E:std::fmt::Debug>(r:Result<T,E>)->T{r.unwrap_or_else(|e|panic!("{e:?}"))}
fn actor(n:u8)->Actor{Actor{principal_id:PrincipalId::from_uuid(Uuid::from_bytes([n;16]))}}
fn intent()->StartTaskIntent{StartTaskIntent{operation_id:"send-one".into(),workspace_id:"5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e".into(),engagement_id:None,folder_id:None,request:"R01 and R03 have the same vendor, invoice and 12,500 amount. Reconcile duplicates.".into(),route_id:"claude-api-key".into(),configuration_revision:1,choices:Choices::default()}}
async fn configure(s:&SqliteWorkingStore,a:Actor){ok(configure_route(s,&SystemClock,a,ConfigureRoute{operation_id:Uuid::new_v4().to_string(),expected_revision:Revision::ZERO,configuration:RouteConfigurationInput{route_id:"claude-api-key".into(),deployment:"anthropic-direct".into(),model:CLAUDE_MODEL.into(),api_version:CLAUDE_API_VERSION.into(),account_ref:Uuid::new_v4().to_string(),region:None}}).await);}
#[tokio::test]
async fn atomic_private_start_replays_and_conflicts_without_duplicate_task(){
 let d=ok(tempfile::tempdir());let s=ok(SqliteWorkingStore::open(&d.path().join("work.db"),&[]).await);let a=actor(1);configure(&s,a).await;let c=intent();
 let(x,y)=tokio::join!(s.reserve_task_run(a.principal_id,c.clone(),"runtime",1),s.reserve_task_run(a.principal_id,c.clone(),"runtime",1));let b=ok(x);assert_eq!(b,ok(y));
 let tree=ok(s.load_workspace_tree(ok(WorkspaceId::parse(&c.workspace_id)),a.principal_id).await);assert_eq!(tree.tasks.len(),1);
 let settings=ok(s.read_usage(a.principal_id,tree.tasks[0].task_id).await).settings;assert_eq!(settings.unwrap().choices,c.choices);
 assert_eq!(ok(s.task_run_request(a.principal_id,&c.operation_id).await),c.request);
 assert_eq!(ok(s.find_task_run(actor(2).principal_id,&c.operation_id).await),None);
 assert_eq!(s.task_run_request(actor(2).principal_id,&c.operation_id).await,Err(DomainError::NotFound));
 let mut changed=c.clone();changed.request.push('!');assert!(matches!(s.reserve_task_run(a.principal_id,changed,"runtime",2).await,Err(DomainError::OperationConflict{..})));
 assert!(!serde_json::to_string(&b).unwrap().contains(&c.request));assert!(!format!("{c:?}").contains(&c.request));
}
#[tokio::test]
async fn binding_claim_and_crash_are_not_dispatch_replay(){
 let d=ok(tempfile::tempdir());let path=d.path().join("work.db");let s=ok(SqliteWorkingStore::open(&path,&[]).await);let a=actor(1);configure(&s,a).await;let c=intent();
 ok(s.reserve_task_run(a.principal_id,c.clone(),"runtime",1).await);
 assert!(s.claim_task_dispatch(a.principal_id,&c.operation_id,"runtime").await.is_err());
 ok(s.bind_task_thread(a.principal_id,&c.operation_id,"runtime","thread-a").await);
 assert!(s.bind_task_thread(a.principal_id,&c.operation_id,"runtime","thread-b").await.is_err());
 assert!(ok(s.find_thread_run(actor(2).principal_id,"runtime","thread-a").await).is_none());
 let(x,y)=tokio::join!(s.claim_task_dispatch(a.principal_id,&c.operation_id,"runtime"),s.claim_task_dispatch(a.principal_id,&c.operation_id,"runtime"));assert_ne!(x.is_ok(),y.is_ok());
 s.close().await;let s=ok(SqliteWorkingStore::open(&path,&[]).await);assert_eq!(ok(s.recover_task_runtime("runtime").await),1);
 let b=ok(s.reserve_task_run(a.principal_id,c.clone(),"new-runtime",3).await);assert_eq!(b.status,TaskRunStatus::Uncertain);
 assert!(s.claim_task_dispatch(a.principal_id,&c.operation_id,"runtime").await.is_err());assert!(s.mark_task_run(a.principal_id,&c.operation_id,TaskRunStatus::Running,Some("turn-a")).await.is_err());
}
#[tokio::test]
async fn missing_candidate_and_invalid_placement_create_no_tasks(){
 let d=ok(tempfile::tempdir());let s=ok(SqliteWorkingStore::open(&d.path().join("work.db"),&[]).await);let a=actor(1);let mut c=intent();
 assert!(s.reserve_task_run(a.principal_id,c.clone(),"runtime",1).await.is_err());configure(&s,a).await;
 c.engagement_id=Some(Uuid::new_v4().to_string());assert!(s.reserve_task_run(a.principal_id,c.clone(),"runtime",1).await.is_err());
 assert!(ok(s.load_workspace_tree(ok(WorkspaceId::parse(&c.workspace_id)),a.principal_id).await).tasks.is_empty());
}

#[tokio::test]
async fn actual_turn_terminal_before_first_attempt_and_between_attempts_is_immutable(){
 for (index,status) in [TaskRunStatus::Failed,TaskRunStatus::Cancelled,TaskRunStatus::Completed].into_iter().enumerate(){
  let d=ok(tempfile::tempdir());let s=ok(SqliteWorkingStore::open(&d.path().join("work.db"),&[]).await);let a=actor(1);configure(&s,a).await;let c=intent();
  ok(s.reserve_task_run(a.principal_id,c.clone(),"runtime",1).await);
  ok(s.bind_task_thread(a.principal_id,&c.operation_id,"runtime","thread-a").await);
  ok(s.claim_task_dispatch(a.principal_id,&c.operation_id,"runtime").await);
  // Failure may happen before before_attempt has ever marked Running.
  if index!=0 {ok(s.mark_task_run(a.principal_id,&c.operation_id,TaskRunStatus::Running,Some("turn-a")).await);}
  let terminal=ok(s.mark_task_run(a.principal_id,&c.operation_id,status,Some("turn-a")).await);
  assert_eq!(terminal.status,status);assert_eq!(terminal.turn_id.as_deref(),Some("turn-a"));
  for replacement in [TaskRunStatus::Running,TaskRunStatus::Uncertain,TaskRunStatus::Completed,TaskRunStatus::Failed,TaskRunStatus::Cancelled] {
   if replacement!=status {assert!(s.mark_task_run(a.principal_id,&c.operation_id,replacement,Some("turn-a")).await.is_err());}
  }
  assert_eq!(ok(s.recover_task_runtime("runtime").await),0);
 }
}

#[tokio::test]
async fn reservation_fence_rechecks_after_writer_wait_and_rolls_back_before_commit(){
 use std::sync::{Arc,atomic::{AtomicBool,AtomicUsize,Ordering}};
 let d=ok(tempfile::tempdir());let s=ok(SqliteWorkingStore::open(&d.path().join("work.db"),&[]).await);let a=actor(1);configure(&s,a).await;let c=intent();
 let authority=Arc::new(AtomicBool::new(true));let observed=Arc::new(AtomicUsize::new(0));
 let lock_pool=ok(sqlx::SqlitePool::connect(&format!("sqlite://{}",d.path().join("work.db").display())).await);
 let lock=ok(lock_pool.begin_with("BEGIN IMMEDIATE").await);
 let waiting={let s=s.clone();let c=c.clone();let authority=authority.clone();let observed=observed.clone();tokio::spawn(async move {
  s.reserve_task_run_fenced(a.principal_id,c,"runtime",1,||{let allowed=authority.load(Ordering::SeqCst);observed.fetch_add(1,Ordering::SeqCst);async move {if allowed {Ok(())}else{Err(DomainError::NotFound)}}}).await
 })};
 tokio::time::sleep(std::time::Duration::from_millis(50)).await;assert_eq!(observed.load(Ordering::SeqCst),0);
 authority.store(false,Ordering::SeqCst);ok(lock.rollback().await);
 assert!(matches!(ok(waiting.await),Err(TaskReservationError::PreEffect(_))));
 assert!(ok(s.find_task_run(a.principal_id,&c.operation_id).await).is_none());
 let calls=AtomicUsize::new(0);
 let rejected=s.reserve_task_run_fenced(a.principal_id,c.clone(),"runtime",1,||{let call=calls.fetch_add(1,Ordering::SeqCst);async move {if call==0 {Ok(())}else{Err(DomainError::NotFound)}}}).await;
 assert!(matches!(rejected,Err(TaskReservationError::PreEffect(_))));assert_eq!(calls.load(Ordering::SeqCst),2);
 assert!(ok(s.load_workspace_tree(ok(WorkspaceId::parse(&c.workspace_id)),a.principal_id).await).tasks.is_empty());
}
#[tokio::test]
async fn setup_failure_is_durable_bounded_and_never_dispatchable(){
 let d=ok(tempfile::tempdir());let s=ok(SqliteWorkingStore::open(&d.path().join("work.db"),&[]).await);let a=actor(1);configure(&s,a).await;let c=intent();
 ok(s.reserve_task_run(a.principal_id,c.clone(),"runtime",1).await);
 let failed=ok(s.fail_task_setup(a.principal_id,&c.operation_id,TaskSetupFailure::ThreadSetupFailed).await);
 assert_eq!(failed.status,TaskRunStatus::SetupFailed);assert!(failed.turn_id.is_none());
 assert_eq!(ok(s.reserve_task_run(a.principal_id,c.clone(),"runtime",2).await),failed);
 assert!(s.claim_task_dispatch(a.principal_id,&c.operation_id,"runtime").await.is_err());
 assert_eq!(ok(s.task_run_request(a.principal_id,&c.operation_id).await),c.request);
 assert!(!serde_json::to_string(&failed).unwrap().contains(&c.request));
}
#[tokio::test]
async fn only_observed_exact_retained_terminal_can_resolve_uncertainty(){
 let d=ok(tempfile::tempdir());let s=ok(SqliteWorkingStore::open(&d.path().join("work.db"),&[]).await);let a=actor(1);configure(&s,a).await;let c=intent();
 ok(s.reserve_task_run(a.principal_id,c.clone(),"runtime",1).await);ok(s.bind_task_thread(a.principal_id,&c.operation_id,"runtime","thread-a").await);ok(s.claim_task_dispatch(a.principal_id,&c.operation_id,"runtime").await);
 ok(s.mark_task_run(a.principal_id,&c.operation_id,TaskRunStatus::Running,Some("turn-a")).await);ok(s.mark_task_run(a.principal_id,&c.operation_id,TaskRunStatus::Uncertain,None).await);
 assert!(s.mark_task_run(a.principal_id,&c.operation_id,TaskRunStatus::Completed,Some("turn-a")).await.is_err());
 for (runtime,thread,turn) in [("other","thread-a","turn-a"),("runtime","other","turn-a"),("runtime","thread-a","other")] {assert!(s.observe_task_terminal(a.principal_id,&c.operation_id,runtime,thread,turn,TaskRunStatus::Completed).await.is_err());}
 let terminal=ok(s.observe_task_terminal(a.principal_id,&c.operation_id,"runtime","thread-a","turn-a",TaskRunStatus::Cancelled).await);assert_eq!(terminal.status,TaskRunStatus::Cancelled);
 assert!(s.observe_task_terminal(a.principal_id,&c.operation_id,"runtime","thread-a","turn-a",TaskRunStatus::Completed).await.is_err());
 assert!(s.claim_task_dispatch(a.principal_id,&c.operation_id,"runtime").await.is_err());
}
