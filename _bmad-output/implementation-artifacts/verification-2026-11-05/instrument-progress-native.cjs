const fs=require('node:fs');
const file='D:/Projects/inquello/engine/codex-rs/app-server/src/request_processors/inquello_tasks.rs';
let text=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
function region(start,end,changes){const a=text.indexOf(start),b=text.indexOf(end,a+start.length);if(a<0||b<0)throw Error('Region missing');let value=text.slice(a,b);for(const [from,to] of changes){if(value.split(from).length!==2)throw Error('Nonunique diagnostic marker: '+from);value=value.replace(from,to);}text=text.slice(0,a)+value+text.slice(b);}
const timing=`        let timing_start = std::time::Instant::now();
        let timing = |stage: &str| {
            #[cfg(all(feature = "inference-fixtures", debug_assertions))]
            eprintln!("[inquello] lifecycle-timing {} elapsed_ms={}", stage, timing_start.elapsed().as_millis());
            #[cfg(not(all(feature = "inference-fixtures", debug_assertions)))]
            let _ = (stage, timing_start);
        };
        timing("begin");
`;
region('    pub(crate) async fn tasks_lifecycle(','    async fn resume_lifecycle(',[
['        // Stop is independent',timing+'        // Stop is independent'],
['        let (store, actor) = self.context','        timing("start-lock");\n        let (store, actor) = self.context'],
['        if let Some(old) = store','        timing("initial-authority");\n        if let Some(old) = store'],
['        let intent = TaskLifecycleIntent','        timing("retained-context");\n        let intent = TaskLifecycleIntent'],
['        if reserved.status !=','        timing("reserved");\n        if reserved.status !='],
['        if claimed.status !=','        timing("claimed");\n        if claimed.status !='],
['            match kind {','            timing("dispatch-authority");\n            match kind {'],
['        let current = store\n            .find_task_current_run(actor.principal_id, &binding.task_id)','        timing("dispatch-ended");\n        let current = store\n            .find_task_current_run(actor.principal_id, &binding.task_id)']
]);
region('    async fn resume_lifecycle(','        if result.is_err()',[
['        let (device, user)',timing+'        let (device, user)'],
['        self.lifecycle_authority(connection, actor, run, policy, TaskLifecycleKind::Resume)','        timing("resume-candidate");\n        self.lifecycle_authority(connection, actor, run, policy, TaskLifecycleKind::Resume)'],
['        let cancellation =','        timing("resume-authority");\n        let cancellation ='],
['            authorization.recheck().await?;\n            let thread_id','            authorization.recheck().await?;\n            timing("guard-recheck");\n            let thread_id'],
['            let thread=threads.inquello_resume_private_thread','            timing("resume-thread-begin");\n            let thread=threads.inquello_resume_private_thread'],
['            authorization.recheck().await?;\n            let text','            timing("resume-thread-end");\n            authorization.recheck().await?;\n            timing("pre-turn-authority");\n            let text'],
['                    let current=store.find_task_current_run','                    timing("turn-admitted");\n                    let current=store.find_task_current_run']
]);
fs.writeFileSync(file,text);
console.log('Added fixture-only elapsed-time diagnostics, no retained content.');