//! Isolated retained-runtime authorization fixtures; not production evidence.
#![cfg(all(feature="inference-fixtures",debug_assertions,any(target_os="linux",target_os="windows")))]
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

// Story 1.29 actual retained-child lifecycle fixtures. Authored, not executed evidence.
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_lifecycle_steer(){driver::run("codex-responses","lifecycle-steer",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_lifecycle_stop_resume(){driver::run("codex-responses","lifecycle-stop-resume",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_lifecycle_restart(){driver::run("codex-responses","lifecycle-restart",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_lifecycle_revoke_before_resume(){driver::run("codex-responses","lifecycle-revoke-before-resume",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_lifecycle_revoke_during_resume(){driver::run("codex-responses","lifecycle-revoke-during-resume",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_lifecycle_missing_linkage(){driver::run("codex-responses","lifecycle-missing-linkage",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_lifecycle_peer_private(){driver::run("codex-responses","lifecycle-peer-private",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_lifecycle_cross_company(){driver::run("codex-responses","lifecycle-cross-company",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_lifecycle_steer(){driver::run("claude-api-key","lifecycle-steer",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_lifecycle_stop_resume(){driver::run("claude-api-key","lifecycle-stop-resume",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_lifecycle_restart(){driver::run("claude-api-key","lifecycle-restart",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_lifecycle_revoke_before_resume(){driver::run("claude-api-key","lifecycle-revoke-before-resume",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_lifecycle_revoke_during_resume(){driver::run("claude-api-key","lifecycle-revoke-during-resume",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_lifecycle_missing_linkage(){driver::run("claude-api-key","lifecycle-missing-linkage",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_lifecycle_peer_private(){driver::run("claude-api-key","lifecycle-peer-private",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_lifecycle_cross_company(){driver::run("claude-api-key","lifecycle-cross-company",None).await;}

#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_lifecycle_crash(){driver::run("codex-responses","lifecycle-crash",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_lifecycle_crash(){driver::run("claude-api-key","lifecycle-crash",None).await;}

// Unverifiable retained context reaches the actual bounded Resume denial.
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_lifecycle_unknown_turn(){driver::run("codex-responses","lifecycle-unknown-turn",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_lifecycle_source_reference(){driver::run("codex-responses","lifecycle-source-reference",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_lifecycle_unknown_turn(){driver::run("claude-api-key","lifecycle-unknown-turn",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_lifecycle_source_reference(){driver::run("claude-api-key","lifecycle-source-reference",None).await;}

#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_lifecycle_steer_lost_ack(){driver::run("codex-responses","lifecycle-steer-lost-ack",None).await;}

#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_lifecycle_stop_pending_steer(){driver::run("codex-responses","lifecycle-stop-pending-steer",None).await;}

#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_lifecycle_steer_lost_ack(){driver::run("claude-api-key","lifecycle-steer-lost-ack",None).await;}

#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_lifecycle_stop_pending_steer(){driver::run("claude-api-key","lifecycle-stop-pending-steer",None).await;}

#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_lifecycle_warm_policy_change(){driver::run("codex-responses","lifecycle-warm-policy-change",None).await;}

#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_lifecycle_warm_policy_change(){driver::run("claude-api-key","lifecycle-warm-policy-change",None).await;}

#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_lifecycle_progress_continuity(){driver::run("codex-responses","lifecycle-progress-continuity",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_lifecycle_progress_continuity(){driver::run("claude-api-key","lifecycle-progress-continuity",None).await;}

#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_lifecycle_stop_provider_unavailable(){driver::run("codex-responses","lifecycle-stop-provider-unavailable",None).await;}
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_lifecycle_stop_provider_unavailable(){driver::run("claude-api-key","lifecycle-stop-provider-unavailable",None).await;}

#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_lifecycle_progress_cache(){driver::run("codex-responses","lifecycle-progress-cache",None).await;}

#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn responses_lifecycle_stop_inflight_steer(){driver::run("codex-responses","lifecycle-stop-inflight-steer",None).await;}

#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_lifecycle_progress_cache(){driver::run("claude-api-key","lifecycle-progress-cache",None).await;}

#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn messages_lifecycle_stop_inflight_steer(){driver::run("claude-api-key","lifecycle-stop-inflight-steer",None).await;}
