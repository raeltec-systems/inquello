//! One-shot execution over the shared unified-exec lifecycle.
//!
//! The caller never receives a resumable process. Timeout and cancellation
//! terminate the exact process handle published by the normal startup path.

use std::sync::Arc;
use std::sync::OnceLock;

use tokio::time::Duration;
use tokio::time::Instant;
use tracing::Instrument;

use super::ExecCommandRequest;
use super::UnifiedExecContext;
use super::UnifiedExecError;
use super::UnifiedExecProcess;
use super::UnifiedExecProcessManager;
use super::trace_id;
use crate::tools::context::ExecCommandToolOutput;

pub(super) struct Completion<'a> {
    pub timeout: Duration,
    pub timed_out: bool,
    pub process: &'a OnceLock<Arc<UnifiedExecProcess>>,
}

impl UnifiedExecProcessManager {
    #[tracing::instrument(
        name = "unified_exec.exec_command",
        level = "info",
        skip_all,
        fields(
            conversation.id = %context.session.thread_id,
            turn_id = trace_id(&context.step_context.turn.sub_id),
            call_id = trace_id(&context.call_id),
            unified_exec_process_id = request.process_id,
            mode = "oneshot",
            outcome = tracing::field::Empty,
        )
    )]
    pub(crate) async fn exec_command_to_completion(
        request: ExecCommandRequest,
        context: &UnifiedExecContext,
        timeout: Duration,
    ) -> Result<ExecCommandToolOutput, UnifiedExecError> {
        let context = UnifiedExecContext::new(
            Arc::clone(&context.session),
            Arc::clone(&context.step_context),
            context.cancellation_token.child_token(),
            context.call_id.clone(),
        );
        let _cancel_on_drop = context.cancellation_token.clone().drop_guard();
        let task = async move {
            let manager = &context.session.services.unified_exec_manager;
            let process_id = request.process_id;
            if Instant::now().checked_add(timeout).is_none() {
                manager.release_process_id(process_id).await;
                return (
                    Err(UnifiedExecError::process_failed(
                        "timeout_ms is too large".into(),
                    )),
                    "failed",
                );
            }

            let process = OnceLock::new();
            let mut completion = Completion {
                timeout,
                timed_out: false,
                process: &process,
            };
            let result = {
                let mut execution =
                    Box::pin(manager.exec_command_inner(request, &context, Some(&mut completion)));
                tokio::select! {
                    biased;
                    _ = context.cancellation_token.cancelled() => {
                        if let Some(process) = process.get() {
                            if !process.has_exited()
                                && let Err(err) = process.terminate_confirmed().await
                            {
                                process.fail_and_terminate(err.to_string());
                            }
                            // An exited remote shell can still have open output pipes.
                            process.cancellation_token().cancel();
                            let _ = execution.await;
                        } else {
                            if crate::inquello_inference::is_task_thread(&context.session.thread_id.to_string()) {
                                #[cfg(test)]
                                if let Some(barrier) = context.step_context.turn.extension_data
                                    .get::<publication_test_support::PublicationBarrier>() {
                                    barrier.startup_owned.notify_one();
                                }
                                // Startup may already be spawning. The inner lifecycle
                                // observes cancellation after publishing and reaps it.
                                let _ = execution.await;
                            } else {
                                drop(execution);
                                manager.release_process_id(process_id).await;
                            }
                        }
                        return (
                            Err(UnifiedExecError::process_failed("command cancelled".into())),
                            "cancelled",
                        );
                    }
                    result = &mut execution => result,
                }
            };

            let outcome = if completion.timed_out {
                "timed_out"
            } else if result.is_ok() {
                "exited"
            } else {
                "failed"
            };
            let result = result.map(|mut output| {
                if completion.timed_out {
                    output.process_id = None;
                }
                output
            });
            (result, outcome)
        };
        let (result, outcome) = match tokio::spawn(task.in_current_span()).await {
            Ok(result) => result,
            Err(err) => (
                Err(UnifiedExecError::process_failed(err.to_string())),
                "failed",
            ),
        };
        tracing::Span::current().record("outcome", outcome);
        result
    }
}

/// Per-turn barrier, compiled out of production. The actual spawned process is
/// paused before Completion publishes it; no global test state or timing guess.
#[cfg(test)]
pub(crate) mod publication_test_support {
    use super::*;
    #[derive(Clone, Default)]
    pub(crate) struct PublicationBarrier {
        pub reached: Arc<tokio::sync::Notify>,
        pub release: Arc<tokio::sync::Notify>,
        pub startup_owned: Arc<tokio::sync::Notify>,
        pub process: Arc<tokio::sync::Mutex<Option<Arc<UnifiedExecProcess>>>>,
    }
    impl PublicationBarrier {
        pub async fn after_spawn_before_publication(&self, process: Arc<UnifiedExecProcess>) {
            *self.process.lock().await = Some(process);
            self.reached.notify_one();
            self.release.notified().await;
        }
    }
}

#[cfg(all(test, unix))]
mod publication_tests {
    use super::*;
    use crate::inquello_inference::{AttemptContext, TaskAuthorization, TaskAuthorizationContext, TaskTurnOutcome, mark_task_thread};
    use crate::environment_selection::TurnEnvironmentState;
    use crate::session::step_context::StepContext;
    use crate::shell::{Shell, ShellInvocation, ShellType};
    use crate::sandboxing::SandboxPermissions;
    use codex_protocol::error::Result as CoreResult;
    use tokio_util::sync::CancellationToken;
    use publication_test_support::PublicationBarrier;
    type Fence<'a,T> = std::pin::Pin<Box<dyn std::future::Future<Output=T>+Send+'a>>;
    struct CommandAuthority(CancellationToken);
    impl TaskAuthorization for CommandAuthority {
        fn cancellation(&self)->CancellationToken {self.0.clone()}
        fn turn_terminal<'a>(&'a self,_:&'a str,_:TaskTurnOutcome)->Fence<'a,()> {Box::pin(async {})}
        fn before_attempt<'a>(&'a self,_:&'a str)->Fence<'a,CoreResult<AttemptContext>> {panic!("this test must never sample")}
        fn before_tool<'a>(&'a self,_:&'a str,_:&'a str,_:&'a str)->Fence<'a,CoreResult<()>> {self.before_tool_effect()}
        fn before_command<'a>(&'a self,_:&'a [String],_:&'a std::path::Path,_:&'a str)->Fence<'a,CoreResult<()>> {self.before_tool_effect()}
        fn before_tool_effect<'a>(&'a self)->Fence<'a,CoreResult<()>> {Box::pin(async move {
            if self.0.is_cancelled() {Err(codex_protocol::error::CodexErr::Fatal("test cancelled".into()))} else {Ok(())}
        })}
        fn after_tool<'a>(&'a self,_:&'a str,_:bool)->Fence<'a,()> {Box::pin(async {})}
    }

    #[tokio::test]
    async fn cancellation_after_spawn_before_publication_owns_startup_and_reaps_child() {
        let root=tempfile::tempdir().expect("isolated effect root");
        let (session,mut turn)=crate::session::tests::make_session_and_context().await;
        let cwd=codex_utils_path_uri::PathUri::from_host_native_path(root.path()).unwrap();
        let TurnEnvironmentState::Ready(environment)=turn.initial_environments.environments.first_mut().unwrap() else {panic!("local environment")};
        environment.selection.cwd=cwd.clone();
        environment.selection.workspace_roots=vec![cwd.clone()];
        environment.config_mut().workspace_roots=vec![cwd.clone()];
        environment.config_mut().permission_profile=crate::config::PermissionProfileSnapshot::legacy(codex_protocol::models::PermissionProfile::workspace_write());
        let environment=environment.clone();
        let cancellation=CancellationToken::new();
        let barrier=PublicationBarrier::default();
        struct ReleaseOnDrop(Arc<tokio::sync::Notify>);
        impl Drop for ReleaseOnDrop { fn drop(&mut self) { self.0.notify_one(); } }
        let _release_on_drop=ReleaseOnDrop(Arc::clone(&barrier.release));
        let _cancel_on_drop=cancellation.clone().drop_guard();
        turn.extension_data.insert(barrier.clone());
        turn.extension_data.insert(TaskAuthorizationContext(Arc::new(CommandAuthority(cancellation.clone()))));
        mark_task_thread(&session.thread_id.to_string()).unwrap();
        let session=Arc::new(session);
        let context=UnifiedExecContext::new(Arc::clone(&session),StepContext::for_test(Arc::new(turn)),cancellation.clone(),"publication-race".into());
        let process_id=session.services.unified_exec_manager.allocate_process_id().await;
        let script="while [ ! -f allow-late ]; do sleep 0.01; done; printf unauthorized > late.txt";
        let request=ExecCommandRequest {
            command:vec!["/bin/sh".into(),"-c".into(),script.into()],
            shell:ShellInvocation {shell:Shell {shell_type:ShellType::Sh,shell_path:"/bin/sh".into()},use_login_shell:false},
            hook_command:script.into(),process_id,yield_time_ms:10000,max_output_tokens:None,
            cwd:cwd.clone(),sandbox_cwd:cwd,turn_environment:environment,network:None,tty:false,
            sandbox_permissions:SandboxPermissions::UseDefault,additional_permissions:None,
            additional_permissions_preapproved:false,justification:None,prefix_rule:None,
        };
        let work=tokio::spawn(async move {UnifiedExecProcessManager::exec_command_to_completion(request,&context,Duration::from_secs(10)).await});
        tokio::time::timeout(Duration::from_secs(5),barrier.reached.notified()).await.expect("real spawn reached exact pre-publication boundary");
        let process=barrier.process.lock().await.clone().expect("actual child owned by startup");
        assert!(!process.has_exited());
        cancellation.cancel();
        tokio::time::timeout(Duration::from_secs(5),barrier.startup_owned.notified()).await.expect("cancellation selected the unpublished-handle path");
        assert!(!work.is_finished(),"cancellation must await, not abandon blocked startup");
        barrier.release.notify_one();
        let result=tokio::time::timeout(Duration::from_secs(5),work).await.expect("cleanup finishes").unwrap();
        assert!(result.is_err());
        assert!(process.has_exited(),"actual child reaped before one-shot returns");
        assert!(process.exit_code().is_some(),"terminal process status observed");
        std::fs::write(root.path().join("allow-late"),b"release delayed effect").unwrap();
        tokio::time::sleep(Duration::from_millis(200)).await;
        assert!(!root.path().join("late.txt").exists(),"reaped child cannot perform delayed effects");
        assert!(session.services.unified_exec_manager.process_store.lock().await.processes.is_empty(),"no resumable process remains");
    }
}
