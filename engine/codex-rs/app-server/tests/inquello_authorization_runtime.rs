//! Isolated retained-runtime authorization fixtures; not production evidence.
#![cfg(all(feature="inference-fixtures",debug_assertions,target_os="linux"))]
#[path="common/inquello_authorization_driver.rs"] mod driver;
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_allowed(){driver::run("codex-responses","allowed",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_revoke_model(){driver::run("codex-responses","revoke-model",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_revoke_pending_permission(){driver::run("codex-responses","revoke-pending-permission",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_revoke_running_tool(){driver::run("codex-responses","revoke-running-tool",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_allowed(){driver::run("claude-api-key","allowed",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_revoke_model(){driver::run("claude-api-key","revoke-model",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_revoke_pending_permission(){driver::run("claude-api-key","revoke-pending-permission",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_revoke_running_tool(){driver::run("claude-api-key","revoke-running-tool",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_deny_before_dispatch(){driver::run("codex-responses","deny-before-dispatch",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_deny_before_dispatch(){driver::run("claude-api-key","deny-before-dispatch",None).await;}
