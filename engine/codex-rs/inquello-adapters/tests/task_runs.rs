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
 let(x,y)=tokio::join!(s.reserve_task_run(a.principal_id,c.clone(),"runtime",1,NativeTaskDataTier::Synthetic),s.reserve_task_run(a.principal_id,c.clone(),"runtime",1,NativeTaskDataTier::Synthetic));let b=ok(x);assert_eq!(b,ok(y));
 let tree=ok(s.load_workspace_tree(ok(WorkspaceId::parse(&c.workspace_id)),a.principal_id).await);assert_eq!(tree.tasks.len(),1);
 let settings=ok(s.read_usage(a.principal_id,tree.tasks[0].task_id).await).settings;assert_eq!(settings.unwrap().choices,c.choices);
 assert_eq!(ok(s.task_run_request(a.principal_id,&c.operation_id).await),c.request);
 assert_eq!(ok(s.find_task_run(actor(2).principal_id,&c.operation_id).await),None);
 assert_eq!(s.task_run_request(actor(2).principal_id,&c.operation_id).await,Err(DomainError::NotFound));
 let mut changed=c.clone();changed.request.push('!');assert!(matches!(s.reserve_task_run(a.principal_id,changed,"runtime",2,NativeTaskDataTier::Synthetic).await,Err(DomainError::OperationConflict{..})));
 assert!(!serde_json::to_string(&b).unwrap().contains(&c.request));assert!(!format!("{c:?}").contains(&c.request));
}
#[tokio::test]
async fn binding_claim_and_crash_are_not_dispatch_replay(){
 let d=ok(tempfile::tempdir());let path=d.path().join("work.db");let s=ok(SqliteWorkingStore::open(&path,&[]).await);let a=actor(1);configure(&s,a).await;let c=intent();
 ok(s.reserve_task_run(a.principal_id,c.clone(),"runtime",1,NativeTaskDataTier::Synthetic).await);
 assert!(s.claim_task_dispatch(a.principal_id,&c.operation_id,"runtime").await.is_err());
 ok(s.bind_task_thread(a.principal_id,&c.operation_id,"runtime","thread-a").await);
 assert!(s.bind_task_thread(a.principal_id,&c.operation_id,"runtime","thread-b").await.is_err());
 assert!(ok(s.find_thread_run(actor(2).principal_id,"runtime","thread-a").await).is_none());
 let(x,y)=tokio::join!(s.claim_task_dispatch(a.principal_id,&c.operation_id,"runtime"),s.claim_task_dispatch(a.principal_id,&c.operation_id,"runtime"));assert_ne!(x.is_ok(),y.is_ok());
 s.close().await;let s=ok(SqliteWorkingStore::open(&path,&[]).await);assert_eq!(ok(s.recover_task_runtime("runtime").await),1);
 let b=ok(s.reserve_task_run(a.principal_id,c.clone(),"new-runtime",3,NativeTaskDataTier::Synthetic).await);assert_eq!(b.status,TaskRunStatus::Uncertain);
 assert!(s.claim_task_dispatch(a.principal_id,&c.operation_id,"runtime").await.is_err());assert!(s.mark_task_run(a.principal_id,&c.operation_id,TaskRunStatus::Running,Some("turn-a")).await.is_err());
}
#[tokio::test]
async fn missing_candidate_and_invalid_placement_create_no_tasks(){
 let d=ok(tempfile::tempdir());let s=ok(SqliteWorkingStore::open(&d.path().join("work.db"),&[]).await);let a=actor(1);let mut c=intent();
 assert!(s.reserve_task_run(a.principal_id,c.clone(),"runtime",1,NativeTaskDataTier::Synthetic).await.is_err());configure(&s,a).await;
 c.engagement_id=Some(Uuid::new_v4().to_string());assert!(s.reserve_task_run(a.principal_id,c.clone(),"runtime",1,NativeTaskDataTier::Synthetic).await.is_err());
 assert!(ok(s.load_workspace_tree(ok(WorkspaceId::parse(&c.workspace_id)),a.principal_id).await).tasks.is_empty());
}

#[tokio::test]
async fn actual_turn_terminal_before_first_attempt_and_between_attempts_is_immutable(){
 for (index,status) in [TaskRunStatus::Failed,TaskRunStatus::Cancelled,TaskRunStatus::Completed].into_iter().enumerate(){
  let d=ok(tempfile::tempdir());let s=ok(SqliteWorkingStore::open(&d.path().join("work.db"),&[]).await);let a=actor(1);configure(&s,a).await;let c=intent();
  ok(s.reserve_task_run(a.principal_id,c.clone(),"runtime",1,NativeTaskDataTier::Synthetic).await);
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
  s.reserve_task_run_fenced(a.principal_id,c,"runtime",1,NativeTaskDataTier::Synthetic,|_|{let allowed=authority.load(Ordering::SeqCst);observed.fetch_add(1,Ordering::SeqCst);async move {if allowed {Ok(())}else{Err(DomainError::NotFound)}}}).await
 })};
 tokio::time::sleep(std::time::Duration::from_millis(50)).await;assert_eq!(observed.load(Ordering::SeqCst),0);
 authority.store(false,Ordering::SeqCst);ok(lock.rollback().await);
 assert!(matches!(ok(waiting.await),Err(TaskReservationError::PreEffect(_))));
 assert!(ok(s.find_task_run(a.principal_id,&c.operation_id).await).is_none());
 let calls=AtomicUsize::new(0);
 let rejected=s.reserve_task_run_fenced(a.principal_id,c.clone(),"runtime",1,NativeTaskDataTier::Synthetic,|_|{let call=calls.fetch_add(1,Ordering::SeqCst);async move {if call==0 {Ok(())}else{Err(DomainError::NotFound)}}}).await;
 assert!(matches!(rejected,Err(TaskReservationError::PreEffect(_))));assert_eq!(calls.load(Ordering::SeqCst),2);
 assert!(ok(s.load_workspace_tree(ok(WorkspaceId::parse(&c.workspace_id)),a.principal_id).await).tasks.is_empty());
}
#[tokio::test]
async fn setup_failure_is_durable_bounded_and_never_dispatchable(){
 let d=ok(tempfile::tempdir());let s=ok(SqliteWorkingStore::open(&d.path().join("work.db"),&[]).await);let a=actor(1);configure(&s,a).await;let c=intent();
 ok(s.reserve_task_run(a.principal_id,c.clone(),"runtime",1,NativeTaskDataTier::Synthetic).await);
 let failed=ok(s.fail_task_setup(a.principal_id,&c.operation_id,TaskSetupFailure::ThreadSetupFailed).await);
 assert_eq!(failed.status,TaskRunStatus::SetupFailed);assert!(failed.turn_id.is_none());
 assert_eq!(ok(s.reserve_task_run(a.principal_id,c.clone(),"runtime",2,NativeTaskDataTier::Synthetic).await),failed);
 assert!(s.claim_task_dispatch(a.principal_id,&c.operation_id,"runtime").await.is_err());
 assert_eq!(ok(s.task_run_request(a.principal_id,&c.operation_id).await),c.request);
 assert!(!serde_json::to_string(&failed).unwrap().contains(&c.request));
}
#[tokio::test]
async fn only_observed_exact_retained_terminal_can_resolve_uncertainty(){
 let d=ok(tempfile::tempdir());let s=ok(SqliteWorkingStore::open(&d.path().join("work.db"),&[]).await);let a=actor(1);configure(&s,a).await;let c=intent();
 ok(s.reserve_task_run(a.principal_id,c.clone(),"runtime",1,NativeTaskDataTier::Synthetic).await);ok(s.bind_task_thread(a.principal_id,&c.operation_id,"runtime","thread-a").await);ok(s.claim_task_dispatch(a.principal_id,&c.operation_id,"runtime").await);
 ok(s.mark_task_run(a.principal_id,&c.operation_id,TaskRunStatus::Running,Some("turn-a")).await);ok(s.mark_task_run(a.principal_id,&c.operation_id,TaskRunStatus::Uncertain,None).await);
 assert!(s.mark_task_run(a.principal_id,&c.operation_id,TaskRunStatus::Completed,Some("turn-a")).await.is_err());
 for (runtime,thread,turn) in [("other","thread-a","turn-a"),("runtime","other","turn-a"),("runtime","thread-a","other")] {assert!(s.observe_task_terminal(a.principal_id,&c.operation_id,runtime,thread,turn,TaskRunStatus::Completed).await.is_err());}
 let terminal=ok(s.observe_task_terminal(a.principal_id,&c.operation_id,"runtime","thread-a","turn-a",TaskRunStatus::Cancelled).await);assert_eq!(terminal.status,TaskRunStatus::Cancelled);
 assert!(s.observe_task_terminal(a.principal_id,&c.operation_id,"runtime","thread-a","turn-a",TaskRunStatus::Completed).await.is_err());
 assert!(s.claim_task_dispatch(a.principal_id,&c.operation_id,"runtime").await.is_err());
}

#[tokio::test]
async fn native_inventory_requires_complete_creator_and_category_provenance() {
 use inquello_adapters::data_provenance::{InspectRequest,inspect};
 let d=ok(tempfile::tempdir());let path=d.path().join("work.db");let s=ok(SqliteWorkingStore::open(&path,&[]).await);let a=actor(1);configure(&s,a).await;
 let run=ok(s.reserve_task_run(a.principal_id,intent(),"runtime",1,NativeTaskDataTier::Synthetic).await);
 s.close().await;
 let request=||InspectRequest{version:1,store_path:path.clone(),principal_id:a.principal_id.to_string(),task_root:None,runtime_home:None};
 // Provenance commits with reservation: a newly created Task is immediately inspectable.
 assert_eq!(run.workspace_id,intent().workspace_id);
 let known=inspect(request()).await;assert!(known.available,"{:?}",known.reason);assert!(!known.files.is_empty());assert_eq!(known.workspaces[0].tasks[0].data_tier,"synthetic");
 let mut foreign=request();foreign.principal_id=actor(2).principal_id.to_string();
 let denied=inspect(foreign).await;assert!(!denied.available);assert!(denied.workspaces.is_empty());assert!(denied.files.is_empty());
}

#[tokio::test]
async fn reservation_tier_is_atomic_and_replay_cannot_reclassify() {
 let d=ok(tempfile::tempdir());let s=ok(SqliteWorkingStore::open(&d.path().join("work.db"),&[]).await);let a=actor(1);configure(&s,a).await;let c=intent();
 let run=ok(s.reserve_task_run(a.principal_id,c.clone(),"runtime",1,NativeTaskDataTier::Real).await);
 assert_eq!(ok(s.task_data_tier(a.principal_id,&run.task_id).await).as_deref(),Some("real"));
 assert!(matches!(s.reserve_task_run(a.principal_id,c.clone(),"runtime",2,NativeTaskDataTier::Synthetic).await,Err(DomainError::OperationConflict{..})));
 assert_eq!(ok(s.reserve_task_run(a.principal_id,c,"runtime",2,NativeTaskDataTier::Real).await),run);
 assert_eq!(ok(s.task_data_tier(a.principal_id,&run.task_id).await).as_deref(),Some("real"));
}
#[tokio::test]
async fn provenance_insert_failure_rolls_back_entire_reservation() {
 let d=ok(tempfile::tempdir());let path=d.path().join("work.db");let s=ok(SqliteWorkingStore::open(&path,&[]).await);let a=actor(1);configure(&s,a).await;let c=intent();
 let pool=ok(sqlx::SqlitePool::connect(&format!("sqlite://{}",path.display())).await);
 ok(sqlx::query("CREATE TRIGGER reject_provenance BEFORE INSERT ON task_data_provenance BEGIN SELECT RAISE(ABORT,'fixture failure'); END").execute(&pool).await);
 assert!(s.reserve_task_run(a.principal_id,c.clone(),"runtime",1,NativeTaskDataTier::Real).await.is_err());
 assert!(ok(s.find_task_run(a.principal_id,&c.operation_id).await).is_none());
 for table in ["tasks","task_runs","task_start_history","task_data_provenance"] {
  let count:i64=ok(sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}")).fetch_one(&pool).await);assert_eq!(count,0,"{table}");
 }
}


/// Actual read-only SQLite inventory, not a desktop inspector mock.
#[tokio::test]
async fn native_inventory_binds_rollouts_and_task_files_to_actual_store() {
 use inquello_adapters::data_provenance::{inspect,InspectRequest};
 use sha2::{Digest,Sha256};
 use std::fs;
 let d=ok(tempfile::tempdir());let path=d.path().join("work.db");
 let store=ok(SqliteWorkingStore::open(&path,&[]).await);let a=actor(1);configure(&store,a).await;
 let command=intent();let run=ok(store.reserve_task_run(a.principal_id,command.clone(),"runtime",1,NativeTaskDataTier::Synthetic).await);
 let thread=Uuid::new_v4().to_string();ok(store.bind_task_thread(a.principal_id,&command.operation_id,"runtime",&thread).await);store.close().await;
 // A genuine peer-owned bound thread is still foreign to this store/principal.
 let peer=ok(SqliteWorkingStore::open(&d.path().join("peer.db"),&[]).await);let b=actor(2);configure(&peer,b).await;
 ok(peer.reserve_task_run(b.principal_id,command.clone(),"peer-runtime",1,NativeTaskDataTier::Synthetic).await);
 let peer_thread=Uuid::new_v4().to_string();ok(peer.bind_task_thread(b.principal_id,&command.operation_id,"peer-runtime",&peer_thread).await);peer.close().await;
 let task_root=d.path().join("tasks");let output=task_root.join(&run.task_id).join("output/result.txt");
 ok(fs::create_dir_all(output.parent().unwrap()));ok(fs::write(&output,b"owned task output"));
 let foreign_output=task_root.join(Uuid::new_v4().to_string()).join("foreign.txt");
 ok(fs::create_dir_all(foreign_output.parent().unwrap()));ok(fs::write(&foreign_output,b"foreign"));
 let runtime_home=d.path().join("runtime");let rollout=runtime_home.join("sessions/owned.jsonl");
 ok(fs::create_dir_all(rollout.parent().unwrap()));
 let header=|id:&str|format!("{}\n",serde_json::json!({"type":"session_meta","payload":{"id":id}}));
 let owned=header(&thread);ok(fs::write(&rollout,&owned));
 let request=||InspectRequest{version:1,store_path:path.clone(),principal_id:a.principal_id.to_string(),task_root:Some(task_root.clone()),runtime_home:Some(runtime_home.clone())};
 let response=inspect(request()).await;assert!(response.available,"{:?}",response.reason);
 for(file,bytes,category)in [(&output,b"owned task output".as_slice(),"task-folders"),(&rollout,owned.as_bytes(),"task-history")] {
  let found=response.files.iter().find(|f|&f.path==file).unwrap();assert_eq!(found.size,bytes.len() as u64);
  assert_eq!(found.sha256,format!("{:x}",Sha256::digest(bytes)));assert_eq!(found.category,category);
 }
 assert!(!response.files.iter().any(|f|f.path==foreign_output));
 for invalid in [header(&peer_thread),header(&Uuid::new_v4().to_string()),"{\"type\":\"session_meta\",\"payload\":{}}\n".into(),"not-json\n".into()] {
  ok(fs::write(&rollout,invalid));let response=inspect(request()).await;
  assert!(!response.available);assert!(response.files.is_empty());assert!(response.workspaces.is_empty());
 }
 ok(fs::write(&rollout,&owned));
 #[cfg(unix)] {
  ok(fs::remove_file(&rollout));ok(std::os::unix::fs::symlink(&output,&rollout));let response=inspect(request()).await;
  assert!(!response.available);assert!(response.files.is_empty());assert!(response.workspaces.is_empty());
  ok(fs::remove_file(&rollout));ok(fs::write(&rollout,header(&thread)));
  ok(fs::remove_file(&output));ok(std::os::unix::fs::symlink(&foreign_output,&output));let response=inspect(request()).await;
  assert!(!response.available);assert!(response.files.is_empty());assert!(response.workspaces.is_empty());
 }
}

fn lifecycle(b:TaskRunBinding,kind:TaskLifecycleKind,op:&str,runtime:&str)->TaskLifecycleIntent {
 TaskLifecycleIntent{operation_id:op.into(),kind,guidance:if kind==TaskLifecycleKind::Steer{Some("Exclude cancelled invoices.".into())}else{None},expected:b,runtime_id:runtime.into()}
}
async fn running(s:&SqliteWorkingStore,a:Actor)->TaskRunBinding {
 configure(s,a).await;let c=intent();
 ok(s.reserve_task_run(a.principal_id,c.clone(),"runtime",1,NativeTaskDataTier::Synthetic).await);
 ok(s.bind_task_thread(a.principal_id,&c.operation_id,"runtime","thread-a").await);
 ok(s.claim_task_dispatch(a.principal_id,&c.operation_id,"runtime").await);
 ok(s.mark_task_run(a.principal_id,&c.operation_id,TaskRunStatus::Running,Some("turn-a")).await)
}
#[tokio::test]
async fn lifecycle_claim_is_single_use_and_guidance_is_not_a_completion() {
 let d=ok(tempfile::tempdir());let s=ok(SqliteWorkingStore::open(&d.path().join("work.db"),&[]).await);let a=actor(1);let b=running(&s,a).await;
 let i=lifecycle(b.clone(),TaskLifecycleKind::Steer,"steer-1","runtime");
 let r=ok(s.reserve_task_lifecycle_fenced(a.principal_id,i.clone(),|_|async{Ok(())}).await);
 assert_eq!(r.status,TaskLifecycleStatus::Reserved);assert!(!format!("{i:?}").contains("cancelled invoices"));
 assert_eq!(ok(s.reserve_task_lifecycle_fenced(a.principal_id,i.clone(),|_|async{Ok(())}).await),r);
 let(x,y)=tokio::join!(s.claim_task_lifecycle_fenced(a.principal_id,"steer-1",|_|async{Ok(())}),s.claim_task_lifecycle_fenced(a.principal_id,"steer-1",|_|async{Ok(())}));assert_ne!(x.is_ok(),y.is_ok());
 assert!(s.finish_task_lifecycle(a.principal_id,"steer-1","runtime","thread-a",Some("wrong"),TaskLifecycleStatus::Admitted).await.is_err());
 assert_eq!(ok(s.finish_task_lifecycle(a.principal_id,"steer-1","runtime","thread-a",Some("turn-a"),TaskLifecycleStatus::Admitted).await).status,TaskLifecycleStatus::Admitted);
 assert_eq!(ok(s.find_task_run(a.principal_id,&b.operation_id).await).unwrap().status,TaskRunStatus::Running);
 assert!(ok(s.find_task_lifecycle(actor(2).principal_id,"steer-1").await).is_none());
 let mut conflict=i;conflict.guidance=Some("Change duplicate key".into());assert!(s.reserve_task_lifecycle_fenced(a.principal_id,conflict,|_|async{Ok(())}).await.is_err());
}
#[tokio::test]
async fn resume_retains_task_thread_and_history_but_fences_old_callbacks() {
 let d=ok(tempfile::tempdir());let path=d.path().join("work.db");let s=ok(SqliteWorkingStore::open(&path,&[]).await);let a=actor(1);let b=running(&s,a).await;
 ok(s.recover_task_runtime("runtime").await);let old=ok(s.find_task_run(a.principal_id,&b.operation_id).await).unwrap();
 let i=lifecycle(old.clone(),TaskLifecycleKind::Resume,"resume-1","new-runtime");
 ok(s.reserve_task_lifecycle_fenced(a.principal_id,i.clone(),|_|async{Ok(())}).await);
 let r=ok(s.claim_task_lifecycle_fenced(a.principal_id,"resume-1",|_|async{Ok(())}).await);
 assert_eq!(r.binding.task_id,b.task_id);assert_eq!(r.binding.thread_id,b.thread_id);assert_ne!(r.binding.run_id,b.run_id);assert_eq!(r.binding.turn_id,None);
 assert_eq!(ok(s.prior_task_runs(a.principal_id,&b.task_id).await),vec![old]);
 assert!(s.mark_task_run_fenced(a.principal_id,&b.operation_id,&b.run_id,"runtime",TaskRunStatus::Completed,Some("turn-a")).await.is_err());
 let current=ok(s.mark_task_run_fenced(a.principal_id,&b.operation_id,&r.binding.run_id,"new-runtime",TaskRunStatus::Running,Some("turn-b")).await);
 ok(s.finish_task_lifecycle(a.principal_id,"resume-1","new-runtime","thread-a",Some("turn-b"),TaskLifecycleStatus::Admitted).await);
 assert_eq!(ok(s.find_task_current_run(a.principal_id,&b.task_id).await),Some(current));
 assert_eq!(ok(s.task_run_request(a.principal_id,&b.operation_id).await),intent().request);
 s.close().await;let s=ok(SqliteWorkingStore::open(&path,&[]).await);ok(s.recover_task_runtime("new-runtime").await);
 assert_eq!(ok(s.find_task_current_run(a.principal_id,&b.task_id).await).unwrap().status,TaskRunStatus::Uncertain);
 assert!(s.claim_task_lifecycle_fenced(a.principal_id,"resume-1",|_|async{Ok(())}).await.is_err());
}
#[tokio::test]
async fn lifecycle_revocation_rolls_back_and_lost_ack_never_redispatches() {
 use std::sync::atomic::{AtomicUsize,Ordering};
 let d=ok(tempfile::tempdir());let s=ok(SqliteWorkingStore::open(&d.path().join("work.db"),&[]).await);let a=actor(1);let b=running(&s,a).await;
 let i=lifecycle(b,TaskLifecycleKind::Stop,"stop-1","runtime");let calls=AtomicUsize::new(0);
 assert!(s.reserve_task_lifecycle_fenced(a.principal_id,i.clone(),|_|{let n=calls.fetch_add(1,Ordering::SeqCst);async move{if n==0{Ok(())}else{Err(DomainError::NotFound)}}}).await.is_err());
 assert!(ok(s.find_task_lifecycle(a.principal_id,"stop-1").await).is_none());
 ok(s.reserve_task_lifecycle_fenced(a.principal_id,i.clone(),|_|async{Ok(())}).await);
 assert!(s.claim_task_lifecycle_fenced(a.principal_id,"stop-1",|_|async{Err(DomainError::NotFound)}).await.is_err());
 assert_eq!(ok(s.find_task_lifecycle(a.principal_id,"stop-1").await).unwrap().status,TaskLifecycleStatus::Reserved);
 ok(s.claim_task_lifecycle_fenced(a.principal_id,"stop-1",|_|async{Ok(())}).await);
 ok(s.recover_task_runtime("runtime").await);
 assert_eq!(ok(s.find_task_lifecycle(a.principal_id,"stop-1").await).unwrap().status,TaskLifecycleStatus::Uncertain);
 assert!(s.claim_task_lifecycle_fenced(a.principal_id,"stop-1",|_|async{Ok(())}).await.is_err());
}


#[tokio::test]
async fn device_runtime_lease_coverage_cannot_be_invented_by_restored_database() {
 let d=ok(tempfile::tempdir());let s=ok(SqliteWorkingStore::open(&d.path().join("work.db"),&[]).await);
 assert!(!ok(s.task_runtime_lease_covered("legacy-runtime","device-a").await));
 ok(s.record_task_runtime_lease("runtime-a","device-a").await);
 assert!(ok(s.task_runtime_lease_covered("runtime-a","device-a").await));
 assert!(!ok(s.task_runtime_lease_covered("runtime-a","restored-device").await));
 assert!(s.record_task_runtime_lease("runtime-a","restored-device").await.is_err());
}
#[tokio::test]
async fn stop_finish_race_retains_natural_completion_without_dispatch_or_rollback() {
 let d=ok(tempfile::tempdir());let s=ok(SqliteWorkingStore::open(&d.path().join("work.db"),&[]).await);let a=actor(1);let b=running(&s,a).await;
 let stop=lifecycle(b.clone(),TaskLifecycleKind::Stop,"stop-race","runtime");
 ok(s.reserve_task_lifecycle_fenced(a.principal_id,stop,|_|async{Ok(())}).await);
 ok(s.mark_task_run_fenced(a.principal_id,&b.operation_id,&b.run_id,"runtime",TaskRunStatus::Completed,Some("turn-a")).await);
 let receipt=ok(s.claim_task_lifecycle_fenced(a.principal_id,"stop-race",|_|async{Ok(())}).await);
 assert_eq!(receipt.status,TaskLifecycleStatus::Completed);
 assert_eq!(receipt.binding.status,TaskRunStatus::Completed);
 assert!(s.claim_task_lifecycle_fenced(a.principal_id,"stop-race",|_|async{Ok(())}).await.is_err());
 let ended=lifecycle(receipt.binding,TaskLifecycleKind::Stop,"stop-after-finish","runtime");
 assert_eq!(ok(s.reserve_task_lifecycle_fenced(a.principal_id,ended,|_|async{Ok(())}).await).status,TaskLifecycleStatus::Completed);
}

/// Populated export/inspection regression: each nested identity must independently
/// fence the whole inventory, not merely disappear from a filtered result set.
#[tokio::test]
async fn native_inventory_checks_every_retained_lifecycle_identity() {
 use inquello_adapters::data_provenance::{inspect,InspectRequest};
 for (table,column,json_path) in [
  ("task_run_history","record","$.task_id"),
  ("task_run_history","record","$.principal_id"),
  ("task_run_history","record","$.workspace_id"),
  ("task_run_history","record","$.thread_id"),
  ("task_run_history","record","$.run_id"),
  ("task_lifecycle","intent","$.expected.task_id"),
  ("task_lifecycle","intent","$.expected.principal_id"),
  ("task_lifecycle","intent","$.expected.workspace_id"),
  ("task_lifecycle","intent","$.expected.thread_id"),
  ("task_lifecycle","receipt","$.binding.task_id"),
  ("task_lifecycle","receipt","$.binding.principal_id"),
  ("task_lifecycle","receipt","$.binding.workspace_id"),
  ("task_lifecycle","receipt","$.binding.thread_id"),
 ] {
  let d=ok(tempfile::tempdir());let path=d.path().join("work.db");
  let s=ok(SqliteWorkingStore::open(&path,&[]).await);let a=actor(1);configure(&s,a).await;
  let c=intent();let thread=Uuid::new_v4().to_string();
  ok(s.reserve_task_run(a.principal_id,c.clone(),"runtime",1,NativeTaskDataTier::Synthetic).await);
  ok(s.bind_task_thread(a.principal_id,&c.operation_id,"runtime",&thread).await);
  ok(s.claim_task_dispatch(a.principal_id,&c.operation_id,"runtime").await);
  ok(s.mark_task_run(a.principal_id,&c.operation_id,TaskRunStatus::Running,Some("turn-a")).await);
  ok(s.recover_task_runtime("runtime").await);
  let old=ok(s.find_task_run(a.principal_id,&c.operation_id).await).unwrap();
  ok(s.reserve_task_lifecycle_fenced(a.principal_id,lifecycle(old,TaskLifecycleKind::Resume,"resume-inventory","new-runtime"),|_|async{Ok(())}).await);
  ok(s.claim_task_lifecycle_fenced(a.principal_id,"resume-inventory",|_|async{Ok(())}).await);
  ok(s.finish_task_lifecycle(a.principal_id,"resume-inventory","new-runtime",&thread,Some("turn-b"),TaskLifecycleStatus::Admitted).await);
  s.close().await;
  let request=||InspectRequest{version:1,store_path:path.clone(),principal_id:a.principal_id.to_string(),task_root:None,runtime_home:None};
  let valid=inspect(request()).await;
  assert!(valid.available,"populated positive control {table}/{column}/{json_path}: {:?}",valid.reason);
  assert!(!valid.files.is_empty());assert_eq!(valid.workspaces[0].tasks.len(),1);
  let db=ok(sqlx::SqlitePool::connect(&format!("sqlite://{}",path.display())).await);
  let count:i64=ok(sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}")).fetch_one(&db).await);assert_eq!(count,1);
  // Delete/reinsert only in this disposable corruption fixture: immutable
  // production history triggers remain present and the schema stays identical.
  let mut tx=ok(db.begin().await);
  if table=="task_run_history" {
   let (task,run,record):(String,String,String)=ok(sqlx::query_as("SELECT task_id,run_id,record FROM task_run_history").fetch_one(&mut *tx).await);
   ok(sqlx::query("DELETE FROM task_run_history").execute(&mut *tx).await);
   ok(sqlx::query("INSERT INTO task_run_history(task_id,run_id,record) VALUES(?,?,json_set(?,?,?))")
    .bind(task).bind(run).bind(record).bind(json_path).bind(Uuid::new_v4().to_string()).execute(&mut *tx).await);
  } else {
   let (principal,operation,task,mut intent,mut receipt):(String,String,String,String,String)=ok(sqlx::query_as("SELECT principal_id,operation_id,task_id,intent,receipt FROM task_lifecycle").fetch_one(&mut *tx).await);
   let value=if column=="intent"{&mut intent}else{&mut receipt};
   *value=ok(sqlx::query_scalar("SELECT json_set(?,?,?)").bind(&*value).bind(json_path).bind(Uuid::new_v4().to_string()).fetch_one(&mut *tx).await);
   ok(sqlx::query("DELETE FROM task_lifecycle").execute(&mut *tx).await);
   ok(sqlx::query("INSERT INTO task_lifecycle(principal_id,operation_id,task_id,intent,receipt) VALUES(?,?,?,?,?)")
    .bind(principal).bind(operation).bind(task).bind(intent).bind(receipt).execute(&mut *tx).await);
  }
  ok(tx.commit().await);db.close().await;
  let denied=inspect(request()).await;
  assert!(!denied.available,"must reject {table}/{column}/{json_path}");
  assert!(denied.files.is_empty());assert!(denied.workspaces.is_empty());
 }
}

#[tokio::test]
async fn stop_remains_independently_claimable_during_steering_uncertainty() {
 for uncertain in [false,true] {
  let d=ok(tempfile::tempdir());let s=ok(SqliteWorkingStore::open(&d.path().join("work.db"),&[]).await);let a=actor(1);let b=running(&s,a).await;
  ok(s.reserve_task_lifecycle_fenced(a.principal_id,lifecycle(b.clone(),TaskLifecycleKind::Steer,"steer-pending","runtime"),|_|async{Ok(())}).await);
  ok(s.claim_task_lifecycle_fenced(a.principal_id,"steer-pending",|_|async{Ok(())}).await);
  if uncertain {ok(s.finish_task_lifecycle(a.principal_id,"steer-pending","runtime","thread-a",Some("turn-a"),TaskLifecycleStatus::Uncertain).await);}
  assert!(s.reserve_task_lifecycle_fenced(a.principal_id,lifecycle(b.clone(),TaskLifecycleKind::Steer,"another-steer","runtime"),|_|async{Ok(())}).await.is_err());
  let stop=lifecycle(b.clone(),TaskLifecycleKind::Stop,"independent-stop","runtime");
  ok(s.reserve_task_lifecycle_fenced(a.principal_id,stop,|_|async{Ok(())}).await);
  assert!(s.reserve_task_lifecycle_fenced(a.principal_id,lifecycle(b.clone(),TaskLifecycleKind::Stop,"duplicate-stop-effect","runtime"),|_|async{Ok(())}).await.is_err());
  ok(s.claim_task_lifecycle_fenced(a.principal_id,"independent-stop",|_|async{Ok(())}).await);
  ok(s.mark_task_run_fenced(a.principal_id,&b.operation_id,&b.run_id,"runtime",TaskRunStatus::Cancelled,Some("turn-a")).await);
  assert_eq!(ok(s.finish_task_lifecycle(a.principal_id,"independent-stop","runtime","thread-a",Some("turn-a"),TaskLifecycleStatus::Interrupted).await).status,TaskLifecycleStatus::Interrupted);
  ok(s.finish_task_lifecycle(a.principal_id,"steer-pending","runtime","thread-a",Some("turn-a"),TaskLifecycleStatus::Unresolved).await);
  assert!(s.claim_task_lifecycle_fenced(a.principal_id,"steer-pending",|_|async{Ok(())}).await.is_err());
 }
}

#[tokio::test]
async fn failed_turn_resolves_stop_without_claiming_interruption() {
 let d=ok(tempfile::tempdir());let s=ok(SqliteWorkingStore::open(&d.path().join("work.db"),&[]).await);let a=actor(1);let b=running(&s,a).await;
 ok(s.reserve_task_lifecycle_fenced(a.principal_id,lifecycle(b.clone(),TaskLifecycleKind::Stop,"stop-failure-race","runtime"),|_|async{Ok(())}).await);
 let ended=ok(s.mark_task_run_fenced(a.principal_id,&b.operation_id,&b.run_id,"runtime",TaskRunStatus::Failed,Some("turn-a")).await);
 let receipt=ok(s.claim_task_lifecycle_fenced(a.principal_id,"stop-failure-race",|_|async{Ok(())}).await);
 assert_eq!(receipt.status,TaskLifecycleStatus::Rejected);assert_eq!(receipt.binding.status,TaskRunStatus::Failed);
 assert_eq!(ok(s.reserve_task_lifecycle_fenced(a.principal_id,lifecycle(ended,TaskLifecycleKind::Stop,"stop-already-failed","runtime"),|_|async{Ok(())}).await).status,TaskLifecycleStatus::Rejected);
}

#[tokio::test]
async fn explicit_verified_recovery_closes_uncertainty_without_replaying_old_operation() {
 let d=ok(tempfile::tempdir());let s=ok(SqliteWorkingStore::open(&d.path().join("work.db"),&[]).await);let a=actor(1);let b=running(&s,a).await;
 ok(s.recover_task_runtime("runtime").await);
 let old=ok(s.find_task_current_run(a.principal_id,&b.task_id).await).unwrap();
 ok(s.reserve_task_lifecycle_fenced(a.principal_id,lifecycle(old,TaskLifecycleKind::Resume,"resume-uncertain","next-runtime"),|_|async{Ok(())}).await);
 let first=ok(s.claim_task_lifecycle_fenced(a.principal_id,"resume-uncertain",|_|async{Ok(())}).await);
 let interrupted=ok(s.mark_task_run_fenced(a.principal_id,&b.operation_id,&first.binding.run_id,"next-runtime",TaskRunStatus::Uncertain,None).await);
 ok(s.finish_task_lifecycle(a.principal_id,"resume-uncertain","next-runtime","thread-a",None,TaskLifecycleStatus::Uncertain).await);
 let next=lifecycle(interrupted,TaskLifecycleKind::Resume,"explicit-recovery","next-runtime");
 assert!(s.reserve_task_lifecycle_fenced(a.principal_id,next.clone(),|_|async{Err(DomainError::NotFound)}).await.is_err());
 assert_eq!(ok(s.find_task_lifecycle(a.principal_id,"resume-uncertain").await).unwrap().status,TaskLifecycleStatus::Uncertain);
 ok(s.reserve_task_lifecycle_fenced(a.principal_id,next,|_|async{Ok(())}).await);
 let recovered=ok(s.claim_task_lifecycle_fenced(a.principal_id,"explicit-recovery",|_|async{Ok(())}).await);
 let closed=ok(s.find_task_lifecycle(a.principal_id,"resume-uncertain").await).unwrap();
 assert_eq!(closed.status,TaskLifecycleStatus::Unresolved);assert_eq!(closed.binding.run_id,first.binding.run_id);
 assert_ne!(recovered.binding.run_id,first.binding.run_id);assert_eq!(recovered.binding.thread_id,b.thread_id);
 assert!(s.claim_task_lifecycle_fenced(a.principal_id,"resume-uncertain",|_|async{Ok(())}).await.is_err());
 assert!(s.finish_task_lifecycle(a.principal_id,"resume-uncertain","next-runtime","thread-a",None,TaskLifecycleStatus::Admitted).await.is_err());
}

/// Hold the real admission callback while its BEGIN IMMEDIATE owns SQLite's
/// writer. Stop must wait only the bounded admission budget, not a 15s RPC.
#[tokio::test]
async fn stalled_inflight_steer_authority_releases_writer_for_stop() {
 for (at_claim,at_final) in [(false,false),(false,true),(true,false),(true,true)] {
  let d=ok(tempfile::tempdir());let s=ok(SqliteWorkingStore::open(&d.path().join("work.db"),&[]).await);let a=actor(1);let b=running(&s,a).await;
  let steer=lifecycle(b.clone(),TaskLifecycleKind::Steer,"stalled-steer","runtime");
  if at_claim {ok(s.reserve_task_lifecycle_fenced(a.principal_id,steer.clone(),|_|async{Ok(())}).await);}
  let entered=tokio::sync::Notify::new();
  let calls=std::sync::atomic::AtomicUsize::new(0);
  let stalled=|_| {let entered=&entered;let call=calls.fetch_add(1,std::sync::atomic::Ordering::SeqCst);async move {
   if at_final && call==0 {return Ok(());}
   entered.notify_one();std::future::pending::<Result<(),DomainError>>().await
  }};
  let admission=async {
   if at_claim {s.claim_task_lifecycle_fenced(a.principal_id,"stalled-steer",stalled).await}
   else {s.reserve_task_lifecycle_fenced(a.principal_id,steer,stalled).await}
  };
  let stop=async {
   entered.notified().await;
   let stop=lifecycle(b.clone(),TaskLifecycleKind::Stop,"stop-stalled-steer","runtime");
   let receipt=tokio::time::timeout(std::time::Duration::from_secs(4),s.reserve_task_lifecycle_fenced(a.principal_id,stop,|_|async{Ok(())})).await.expect("Stop must obtain actual writer after bounded admission");
   assert_eq!(ok(receipt).status,TaskLifecycleStatus::Reserved);
   assert_eq!(ok(s.claim_task_lifecycle_fenced(a.principal_id,"stop-stalled-steer",|_|async{Ok(())}).await).status,TaskLifecycleStatus::Dispatching);
  };
  let (admission,())=tokio::join!(admission,stop);assert!(admission.is_err());
  let receipt=ok(s.find_task_lifecycle(a.principal_id,"stalled-steer").await);
  assert_eq!(receipt.map(|r|r.status),if at_claim {Some(TaskLifecycleStatus::Reserved)}else{None});
 }
}
