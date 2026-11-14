const fs=require('node:fs');
const file='D:/Projects/inquello/engine/codex-rs/inquello-adapters/src/tasks.rs';
let text=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const a=text.indexOf('    async fn claim_task_lifecycle_fenced<'),b=text.indexOf('    async fn find_task_lifecycle(',a);
let value=text.slice(a,b);
function edit(from,to){if(value.split(from).length!==2)throw Error('Marker mismatch '+from);value=value.replace(from,to);}
edit('        OperationId::parse(op)?;',`        OperationId::parse(op)?;
        let timing_start = std::time::Instant::now();
        let timing = |stage: &str| {
            #[cfg(debug_assertions)]
            eprintln!("[inquello] claim-timing {} elapsed_ms={} pool_size={} idle={}", stage, timing_start.elapsed().as_millis(), self.pool().size(), self.pool().num_idle());
            #[cfg(not(debug_assertions))]
            let _ = (stage, timing_start);
        };
        timing("begin");
`);
edit('        let deadline =','        timing("writer-acquired");\n        let deadline =');
edit('        lifecycle_current(&intent, &b)?;','        timing("read-binding");\n        lifecycle_current(&intent, &b)?;');
edit('        receipt.status = TaskLifecycleStatus::Dispatching;','        timing("first-validation");\n        receipt.status = TaskLifecycleStatus::Dispatching;');
edit('        // Validate the retained context again,','        timing("writes");\n        // Validate the retained context again,');
edit('        tx.commit().await.map_err(backend)?;\n        Ok(receipt)','        timing("second-validation");\n        tx.commit().await.map_err(backend)?;\n        timing("commit");\n        Ok(receipt)');
fs.writeFileSync(file,text.slice(0,a)+value+text.slice(b));
const native='D:/Projects/inquello/engine/codex-rs/app-server/src/request_processors/inquello_tasks.rs';
text=fs.readFileSync(native,'utf8');
const needle='            Err(error) => {\n                // A failed claim may have lost';
if(text.split(needle).length!==2)throw Error('Native marker mismatch');
text=text.replace(needle,'            Err(error) => {\n                timing("claim-error");\n                // A failed claim may have lost');
fs.writeFileSync(native,text);
console.log('Added claim stage and pool-count diagnostics only.');