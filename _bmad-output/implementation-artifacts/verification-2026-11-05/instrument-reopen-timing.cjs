const fs=require('node:fs');
const root='D:/Projects/inquello/engine/codex-rs/app-server/src/request_processors/';
function edit(file,fn){const all=fs.readFileSync(root+file,'utf8').replace(/\r\n/g,'\n');const start=file==='thread_processor.rs'?all.indexOf('    pub(crate) async fn inquello_resume_private_thread('):0;const end=file==='thread_processor.rs'?all.indexOf('    pub(crate) async fn inquello_steer_private_turn',start)+'    pub(crate) async fn inquello_steer_private_turn'.length:all.length;let s=all.slice(start,end);function sub(a,b){if(s.split(a).length!==2)throw Error('nonunique '+a);s=s.replace(a,b)}fn(sub);fs.writeFileSync(root+file,all.slice(0,start)+s+all.slice(end))}
const timing=`        let timing_start = std::time::Instant::now();
        let timing = |stage: &str| {
            #[cfg(all(feature = "inference-fixtures", debug_assertions))]
            eprintln!("[inquello] reopen-timing {} elapsed_ms={}", stage, timing_start.elapsed().as_millis());
            #[cfg(not(all(feature = "inference-fixtures", debug_assertions)))]
            let _ = (stage, timing_start);
        };
`;
edit('thread_processor.rs',sub=>{
sub('        self.inquello_check_retained_thread(&thread_id.to_string(), allowed)\n            .await?;\n        authorization',timing+'        timing("begin");\n        self.inquello_check_retained_thread(&thread_id.to_string(), allowed)\n            .await?;\n        timing("retained-check");\n        authorization');
sub('        if let Ok(thread) = self.thread_manager.get_thread(thread_id).await {','        timing("pre-shutdown-authority");\n        if let Ok(thread) = self.thread_manager.get_thread(thread_id).await {');
sub('            self.finalize_thread_teardown(thread_id).await;','            self.finalize_thread_teardown(thread_id).await;\n            timing("shutdown");');
sub('        let history = self.inquello_retained_history(thread_id).await?;','        let history = self.inquello_retained_history(thread_id).await?;\n        timing("retained-history");');
sub('        self.inquello_open_private_thread(\n            connection,','        timing("post-shutdown-authority");\n        self.inquello_open_private_thread(\n            connection,');
sub('        codex_core::inquello_inference::mark_task_thread(&thread_id.to_string())',timing+'        timing("open-begin");\n        codex_core::inquello_inference::mark_task_thread(&thread_id.to_string())');
sub('        config.model_provider.request_max_retries = Some(0);','        timing("config-loaded");\n        config.model_provider.request_max_retries = Some(0);');
sub('            // This generation has not started any resource-bearing work yet.','            timing("retirement-begin");\n            // This generation has not started any resource-bearing work yet.');
sub('            let plan = crate::inquello_wsl::WslExecPlan::prepare_model(','            timing("retirement-authority");\n            let plan = crate::inquello_wsl::WslExecPlan::prepare_model(');
sub('            let environment_id = format!("inquello-wsl-{}", retirement.generation);','            timing("guest-prepared");\n            let environment_id = format!("inquello-wsl-{}", retirement.generation);');
sub('            if manager\n                .register_isolated_client','            timing("guest-connected");\n            if manager\n                .register_isolated_client');
sub('        let mut options = StartThreadOptions::new(config);','        timing("guest-registered");\n        let mut options = StartThreadOptions::new(config);');
sub('        if new.thread_id != thread_id || authorization.0.cancellation().is_cancelled() {','        timing("thread-started");\n        if new.thread_id != thread_id || authorization.0.cancellation().is_cancelled() {');
sub('        Ok(new.thread)\n    }\n    pub(crate) async fn inquello_steer_private_turn','        timing("listener-ready");\n        Ok(new.thread)\n    }\n    pub(crate) async fn inquello_steer_private_turn');
});
edit('thread_lifecycle.rs',sub=>{
sub('                    let is_shutdown_complete = matches!(event.msg, EventMsg::ShutdownComplete);','                    let is_shutdown_complete = matches!(event.msg, EventMsg::ShutdownComplete);\n                    let event_timing_start = std::time::Instant::now();\n                    let event_kind = std::mem::discriminant(&event.msg);');
sub('                    if is_shutdown_complete\n                        && let Some(completion_tx)', '                    #[cfg(all(feature = "inference-fixtures", debug_assertions))]\n                    eprintln!("[inquello] listener-timing {:?} elapsed_ms={}", event_kind, event_timing_start.elapsed().as_millis());\n                    #[cfg(not(all(feature = "inference-fixtures", debug_assertions)))]\n                    let _ = (event_kind, event_timing_start);\n                    if is_shutdown_complete\n                        && let Some(completion_tx)');
});
console.log('Added temporary reopen and event-handler elapsed stages without message content.');