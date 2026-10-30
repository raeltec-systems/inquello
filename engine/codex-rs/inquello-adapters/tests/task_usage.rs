//! Isolated storage evidence only: no credentials, provider calls or renderer claims.
use inquello_adapters::{SqliteWorkingStore,SystemClock};
use inquello_domain::organise::{Actor,CreateTask,OrganiseRecord,PrincipalId,Task,create_task};
use inquello_domain::usage::*;
use inquello_domain::routes::*;
use inquello_domain::{DomainError,Revision};
use uuid::Uuid;
fn ok<T,E:std::fmt::Debug>(r:Result<T,E>)->T {r.unwrap_or_else(|e|panic!("{e:?}"))}
fn actor(n:u8)->Actor {Actor {principal_id:PrincipalId::from_uuid(Uuid::from_bytes([n;16]))}}
async fn task(s:&SqliteWorkingStore,a:Actor)->Task {
 let o=ok(create_task(s,&SystemClock,a,CreateTask {operation_id:Uuid::new_v4().to_string(),expected_revision:Revision::ZERO,workspace_id:"5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e".into(),engagement_id:None,folder_id:None,title:"Usage fixture".into()}).await);
 match o.record {OrganiseRecord::Task(t)=>t,_=>panic!("Task required")}
}
fn snapshot(a:Actor,t:&Task)->AttemptSnapshot {AttemptSnapshot {
 attempt_id:Uuid::new_v4().to_string(),task_id:t.task_id.to_string(),principal_id:a.principal_id.to_string(),run_id:Uuid::new_v4().to_string(),runtime_id:"old-runtime".into(),operation_kind:OperationKind::LocalTool,route_id:None,model:None,api_version:None,configuration_revision:0,route_revision:0,settings_revision:0,requested:Choices::default(),effective:Choices::default(),started_at_ms:100,
}}
async fn configure(s:&SqliteWorkingStore,a:Actor,t:&Task) {
 ok(configure_route(s,&SystemClock,a,ConfigureRoute {operation_id:"configure".into(),expected_revision:Revision::ZERO,configuration:RouteConfigurationInput {route_id:"claude-api-key".into(),deployment:"anthropic-direct".into(),model:CLAUDE_MODEL.into(),api_version:CLAUDE_API_VERSION.into(),account_ref:Uuid::new_v4().to_string(),region:None}}).await);
 ok(set_task_route(s,&SystemClock,a,SetTaskRoute {operation_id:"select".into(),expected_revision:Revision::ZERO,task_id:t.task_id.to_string(),route_id:"claude-api-key".into(),configuration_revision:Revision::new(1)}).await);
}
#[tokio::test]
async fn defaults_replay_privacy_and_revision_conflict() {
 let dir=ok(tempfile::tempdir());let s=ok(SqliteWorkingStore::open(&dir.path().join("work.db"),&[]).await);let a=actor(1);let t=task(&s,a).await;configure(&s,a,&t).await;
 let c=SetUsageSettings {operation_id:"defaults".into(),task_id:t.task_id.to_string(),expected_revision:0,route_revision:1,choices:Choices::default()};let allowed=vec!["default".into()];
 let (x,y)=tokio::join!(set_task_usage_settings(&s,a,c.clone(),&allowed,&allowed),set_task_usage_settings(&s,a,c.clone(),&allowed,&allowed));assert_eq!(ok(x),ok(y));
 assert_eq!(task_usage(&s,actor(2),&t.task_id.to_string()).await,Err(DomainError::NotFound));
 assert_eq!(set_task_usage_settings(&s,actor(2),c.clone(),&allowed,&allowed).await,Err(DomainError::NotFound));
 let mut stale=c.clone();stale.operation_id="stale".into();assert!(matches!(set_task_usage_settings(&s,a,stale,&allowed,&allowed).await,Err(DomainError::RevisionConflict{..})));
 let mut bad=c;bad.choices.speed="fast".into();assert!(set_task_usage_settings(&s,a,bad,&allowed,&allowed).await.is_err());
}
#[tokio::test]
async fn local_tools_without_model_route_retained_across_restart_and_no_replay() {
 let dir=ok(tempfile::tempdir());let path=dir.path().join("work.db");let s=ok(SqliteWorkingStore::open(&path,&[]).await);let a=actor(1);let t=task(&s,a).await;
 let first=snapshot(a,&t);ok(s.begin_usage_attempt(first.clone()).await);assert!(s.begin_usage_attempt(first.clone()).await.is_err());
 let mut second=snapshot(a,&t);second.runtime_id="still-live".into();ok(s.begin_usage_attempt(second.clone()).await);
 ok(s.finish_usage_attempt(a.principal_id,t.task_id,&second.attempt_id,FinishAttempt {status:AttemptStatus::Failed,ended_at_ms:150,elapsed_ms:50,output_ref:Some("output-reference".into())}).await);
 s.close().await;let s=ok(SqliteWorkingStore::open(&path,&[]).await);
 assert_eq!(ok(s.recover_usage_runtime("old-runtime").await),1);
 let records=ok(task_usage(&s,a,&t.task_id.to_string()).await).attempts;assert_eq!(records.len(),2);
 let old=records.iter().find(|r|r.snapshot.attempt_id==first.attempt_id).unwrap();assert_eq!(old.status,AttemptStatus::Uncertain);assert_eq!(old.usage.input_tokens,None);
 let failed=records.iter().find(|r|r.snapshot.attempt_id==second.attempt_id).unwrap();assert_eq!(failed.status,AttemptStatus::Failed);assert_eq!(failed.elapsed_ms,Some(50));
 let fabricated=UsageEvent {event_id:"fabricated".into(),sequence:1,kind:UsageEventKind::Cumulative,usage:Consumption {input_tokens:Some(1),..Default::default()}};assert!(s.record_usage_event(a.principal_id,t.task_id,&first.attempt_id,fabricated).await.is_err());
}
#[tokio::test]
async fn trusted_cumulative_events_deduplicate_and_late_usage_does_not_recover_status() {
 let dir=ok(tempfile::tempdir());let s=ok(SqliteWorkingStore::open(&dir.path().join("work.db"),&[]).await);let a=actor(1);let t=task(&s,a).await;configure(&s,a,&t).await;
 let allowed=vec!["default".into()];ok(set_task_usage_settings(&s,a,SetUsageSettings {operation_id:"defaults".into(),task_id:t.task_id.to_string(),expected_revision:0,route_revision:1,choices:Choices::default()},&allowed,&allowed).await);
 let mut snap=snapshot(a,&t);snap.operation_kind=OperationKind::AutomatedPermissionReview;snap.route_id=Some("claude-api-key".into());snap.model=Some(CLAUDE_MODEL.into());snap.api_version=Some(CLAUDE_API_VERSION.into());snap.route_revision=1;snap.configuration_revision=1;snap.settings_revision=1;ok(s.begin_usage_attempt(snap.clone()).await);
 let event=|id:&str,sequence,n|UsageEvent {event_id:id.into(),sequence,kind:UsageEventKind::Cumulative,usage:Consumption {input_tokens:Some(n),cache_read_tokens:Some(2),..Default::default()}};
 let newer=event("second",2,20);ok(s.record_usage_event(a.principal_id,t.task_id,&snap.attempt_id,newer.clone()).await);ok(s.record_usage_event(a.principal_id,t.task_id,&snap.attempt_id,newer).await);ok(s.recover_usage_runtime("old-runtime").await);ok(s.record_usage_event(a.principal_id,t.task_id,&snap.attempt_id,event("first",1,10)).await);
 let result=ok(task_usage(&s,a,&t.task_id.to_string()).await);assert_eq!(result.attempts[0].usage.input_tokens,Some(20));assert_eq!(result.attempts[0].events.len(),2);assert_eq!(result.attempts[0].status,AttemptStatus::Uncertain);
 assert!(s.record_usage_event(a.principal_id,t.task_id,&snap.attempt_id,event("second",2,99)).await.is_err());
}
