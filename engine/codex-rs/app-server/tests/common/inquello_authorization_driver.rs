//! Authored real-child fixtures, not production evidence. Both enabled adapters
//! use ordinary Task APIs and the retained sandbox. No paid inference or keys.

#![allow(clippy::expect_used,clippy::unwrap_used)]
use app_test_support::TestAppServer;
use serde_json::{Value,json};
use std::{sync::Arc,time::Duration};
use tokio::io::{AsyncReadExt,AsyncWriteExt};
use tokio::sync::{Mutex,Notify};
use tokio_rustls::rustls;
#[path="inquello_private_host.rs"] mod private_host;
use private_host::*;
const ALICE:&str="11111111-1111-4111-8111-111111111111";
const BOB:&str="22222222-2222-4222-8222-222222222222";
const COMPANY_A:&str="5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e";
const COMPANY_B:&str="6d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e";
const LATE:&str="INV-104 duplicated: potential K12,480; INV-105 distinct. Authorization fixture output, not professional approval.";
fn event(kind:&str,value:Value)->String {format!("event: {kind}\ndata: {value}\n\n")}
fn streams(route:&str,scenario:&str)->Vec<String> {
    let waiting=scenario=="revoke-running-tool" || scenario.starts_with("lifecycle-");
    #[cfg(not(windows))]
    let command=if waiting {"printf '%s' \"$$\" > output/pid.txt; printf started > output/started.txt; n=0; while [ ! -f output/release.txt ] && [ \"$n\" -lt 300 ]; do sleep 0.1; n=$((n+1)); done; printf late > output/late.txt"}else{"printf permitted > output/authorized.txt"};
    #[cfg(windows)]
    let command=if waiting {"[IO.File]::WriteAllText('output/pid.txt', [string]$PID); [IO.File]::WriteAllText('output/started.txt', 'started'); $n=0; while (!(Test-Path 'output/release.txt') -and $n -lt 300) { Start-Sleep -Milliseconds 100; $n++ }; [IO.File]::WriteAllText('output/late.txt', 'late')"}else{"[IO.File]::WriteAllText('output/authorized.txt', 'permitted')"};
    let arguments=json!({"cmd":command,"shell":fixture_shell(),"login":false,"yield_time_ms":if scenario=="lifecycle-progress-cache" {1000}else{10000}}).to_string();
    if matches!(scenario,"lifecycle-progress-continuity"|"lifecycle-progress-cache") {
        let initial=json!({"version":1,"plan":[],"results":[
            {"id":"duplicates","kind":"observation","text":"Two candidate invoice pairs","evidenceIds":if scenario=="lifecycle-progress-cache" {vec!["call_authorized"]}else{vec![]},"revision":1,"changeReason":"Initial invoice comparison"},
            {"id":"unaffected","kind":"gap","text":"Approval remains missing","evidenceIds":[],"revision":1}]});
        let revised=json!({"version":1,"plan":[],"results":[
            {"id":"duplicates","kind":"observation","text":"One vendor and invoice pair","evidenceIds":[],"revision":2,"changeReason":"Exclude cancelled invoices"}]});
        if route=="codex-responses" {
            let response=|id:&str,items:Vec<Value>| {
                let mut stream=event("response.created",json!({"type":"response.created","response":{"id":id,"status":"in_progress"}}));
                for (index,item) in items.into_iter().enumerate(){stream+=&event("response.output_item.done",json!({"type":"response.output_item.done","output_index":index,"item":item}));}
                stream+&event("response.completed",json!({"type":"response.completed","response":{"id":id,"status":"completed","output":[],"usage":{"input_tokens":12,"output_tokens":8,"total_tokens":20}}}))
            };
            let call=|id:&str,name:&str,args:String|json!({"type":"function_call","id":format!("fc_{id}"),"call_id":id,"name":name,"arguments":args});
            if scenario=="lifecycle-progress-cache" {
                return vec![response("resp_initial",vec![call("call_authorized","exec_command",arguments),call("publish_initial","inquello_progress",initial.to_string())]),
                    response("resp_revised",vec![call("publish_revised","inquello_progress",revised.to_string())]),
                    response("resp_final",vec![json!({"type":"message","id":"msg_final","role":"assistant","status":"completed","content":[{"type":"output_text","text":LATE,"annotations":[]}]})])];
            }
            return vec![response("resp_initial",vec![call("publish_initial","inquello_progress",initial.to_string())]),
                response("resp_tool",vec![call("call_authorized","exec_command",arguments)]),
                response("resp_revised",vec![call("publish_revised","inquello_progress",revised.to_string())]),
                response("resp_final",vec![json!({"type":"message","id":"msg_final","role":"assistant","status":"completed","content":[{"type":"output_text","text":LATE,"annotations":[]}]})])];
        }
        let response=|id:&str,blocks:Vec<Value>,reason:&str| {
            let mut stream=event("message_start",json!({"type":"message_start","message":{"id":id,"role":"assistant","model":"claude-sonnet-5-5","content":[],"usage":{"input_tokens":12}}}));
            for (index,block) in blocks.into_iter().enumerate(){stream+=&event("content_block_start",json!({"type":"content_block_start","index":index,"content_block":block}));stream+=&event("content_block_stop",json!({"type":"content_block_stop","index":index}));}
            stream+&event("message_delta",json!({"type":"message_delta","delta":{"stop_reason":reason},"usage":{"output_tokens":8}}))+&event("message_stop",json!({"type":"message_stop"}))
        };
        if scenario=="lifecycle-progress-cache" {
            return vec![response("msg_initial",vec![json!({"type":"tool_use","id":"call_authorized","name":"exec_command","input":serde_json::from_str::<Value>(&arguments).unwrap()}),json!({"type":"tool_use","id":"publish_initial","name":"inquello_progress","input":initial})],"tool_use"),
                response("msg_revised",vec![json!({"type":"tool_use","id":"publish_revised","name":"inquello_progress","input":revised})],"tool_use"),
                response("msg_final",vec![json!({"type":"text","text":LATE})],"end_turn")];
        }
        return vec![response("msg_initial",vec![json!({"type":"tool_use","id":"publish_initial","name":"inquello_progress","input":initial})],"tool_use"),
            response("msg_tool",vec![json!({"type":"tool_use","id":"call_authorized","name":"exec_command","input":serde_json::from_str::<Value>(&arguments).unwrap()})],"tool_use"),
            response("msg_revised",vec![json!({"type":"tool_use","id":"publish_revised","name":"inquello_progress","input":revised})],"tool_use"),
            response("msg_final",vec![json!({"type":"text","text":LATE})],"end_turn")];
    }
    if route=="codex-responses" {
        let start=|id:&str|event("response.created",json!({"type":"response.created","response":{"id":id,"status":"in_progress"}}));
        let done=|id:&str|event("response.completed",json!({"type":"response.completed","response":{"id":id,"status":"completed","output":[],"usage":{"input_tokens":12,"output_tokens":8,"total_tokens":20}}}));
        vec![start("resp_tool")+&event("response.output_item.done",json!({"type":"response.output_item.done","output_index":0,"item":{"type":"function_call","id":"fc_authorized","call_id":"call_authorized","name":"exec_command","arguments":arguments}}))+&done("resp_tool"),
            start("resp_final")+&event("response.output_item.done",json!({"type":"response.output_item.done","output_index":0,"item":{"type":"message","id":"msg_final","role":"assistant","status":"completed","content":[{"type":"output_text","text":LATE,"annotations":[]}]}}))+&done("resp_final")]
    } else {
        let start=|id:&str|event("message_start",json!({"type":"message_start","message":{"id":id,"role":"assistant","model":"claude-sonnet-5-5","content":[],"usage":{"input_tokens":12}}}));
        let done=|reason:&str|event("message_delta",json!({"type":"message_delta","delta":{"stop_reason":reason},"usage":{"output_tokens":8}}))+&event("message_stop",json!({"type":"message_stop"}));
        vec![start("msg_tool")+&event("content_block_start",json!({"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"call_authorized","name":"exec_command","input":{}}}))+&event("content_block_delta",json!({"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":arguments}}))+&event("content_block_stop",json!({"type":"content_block_stop","index":0}))+&done("tool_use"),
            start("msg_final")+&event("content_block_start",json!({"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}))+&event("content_block_delta",json!({"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":LATE}}))+&event("content_block_stop",json!({"type":"content_block_stop","index":0}))+&done("end_turn")]
    }
}
struct Fixture {endpoint:String,certificate:Vec<u8>,requests:Arc<Mutex<Vec<Value>>>,release:Arc<Notify>,stop:tokio::sync::oneshot::Sender<()>,task:tokio::task::JoinHandle<()>}
async fn fixture(route:&'static str,scenario:&'static str)->Fixture {
    let hold_last=matches!(scenario,"revoke-model"|"lifecycle-revoke-during-resume");
    let count=if scenario=="lifecycle-progress-cache"{3}else if scenario=="lifecycle-progress-continuity"{4}else if scenario=="deny-before-dispatch"{0}else if matches!(scenario,"revoke-pending-permission"|"revoke-running-tool"|"lifecycle-revoke-before-resume"|"lifecycle-missing-linkage"|"lifecycle-peer-private"|"lifecycle-cross-company"|"lifecycle-unknown-turn"|"lifecycle-source-reference"){1}else{2};
    let certified=rcgen::generate_simple_self_signed(vec!["127.0.0.1".into()]).unwrap();
    let certificate=certified.cert.der().to_vec();
    let key=rustls::pki_types::PrivatePkcs8KeyDer::from(certified.signing_key.serialize_der());
    let config=rustls::ServerConfig::builder_with_provider(Arc::new(rustls::crypto::aws_lc_rs::default_provider())).with_safe_default_protocol_versions().unwrap().with_no_client_auth().with_single_cert(vec![certified.cert.der().clone()],key.into()).unwrap();
    let acceptor=tokio_rustls::TlsAcceptor::from(Arc::new(config));
    let listener=tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let path=if route=="codex-responses"{"responses"}else{"messages"};
    let endpoint=format!("https://127.0.0.1:{}/v1/{path}",listener.local_addr().unwrap().port());
    let requests=Arc::new(Mutex::new(Vec::new()));let captured=requests.clone();
    let release=Arc::new(Notify::new());let released=release.clone();let(stop,stopped)=tokio::sync::oneshot::channel();
    let task=tokio::spawn(async move {
        for(index,response)in streams(route,scenario).into_iter().take(count).enumerate() {
            let(socket,_)=tokio::time::timeout(Duration::from_secs(45),listener.accept()).await.expect("actual provider request").unwrap();
            let mut socket=acceptor.accept(socket).await.unwrap();let mut bytes=Vec::new();
            loop {
                let mut chunk=[0;8192];let n=tokio::time::timeout(Duration::from_secs(30),socket.read(&mut chunk)).await.unwrap().unwrap();assert!(n>0);bytes.extend_from_slice(&chunk[..n]);assert!(bytes.len()<1_048_576);
                if let Some(end)=bytes.windows(4).position(|w|w==b"\r\n\r\n") {
                    let headers=String::from_utf8_lossy(&bytes[..end]).to_ascii_lowercase();
                    assert!(headers.starts_with(&format!("post /v1/{path} ")));assert!(!headers.contains("authorization:"),"no inherited or paid credential in fixture");
                    let length:usize=headers.lines().find_map(|l|l.strip_prefix("content-length: ")).unwrap().parse().unwrap();
                    if bytes.len()>=end+4+length {
                        if route=="claude-api-key" {assert!(headers.contains("x-api-key: sk-ant-synthetic-fixture-only"));}
                        let body:Value=serde_json::from_slice(&bytes[end+4..end+4+length]).unwrap();
                        if scenario=="lifecycle-progress-cache" && route=="claude-api-key" {assert_eq!(body["tool_choice"]["disable_parallel_tool_use"],false,"fixture requires actual supported parallel-call binding");}
                        assert!(!body.to_string().contains("sk-ant-"));captured.lock().await.push(body);break;
                    }
                }
            }
            if (hold_last && index==1) || (scenario=="lifecycle-progress-cache" && matches!(index,1|2)) {tokio::time::timeout(Duration::from_secs(45),released.notified()).await.expect("explicit fixture observation boundary before provider output");}
            let result=socket.write_all(format!("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{response}",response.len()).as_bytes()).await;
            if !hold_last||index!=1 {result.expect("permitted fixture response");}
            let _=socket.shutdown().await;
        }
        tokio::select! {biased;
            unexpected=listener.accept()=>panic!("unexpected retry/fallback request: {unexpected:?}"),
            stopped=stopped=>stopped.expect("explicit replay observation end"),
            _=tokio::time::sleep(Duration::from_secs(60))=>panic!("fixture observer not stopped"),
        }
    });
    Fixture {endpoint,certificate,requests,release,stop,task}
}
pub(super) struct ServiceFixture {pub(super) principal:String,pub(super) workspace:String,pub(super) policy:Value,pub(super) authority:private_host::AuthorityCallback,pub(super) revoke:private_host::RevokeCallback}
// Linux fixture: prove the original shell, not only its cancellation token, stopped.
// Unknown proc errors fail the test. Starttime prevents PID reuse from confusing identity.
#[cfg(target_os="linux")]
fn shell_process(pid:u32)->Option<(String,String)> {
    let value=match std::fs::read_to_string(format!("/proc/{pid}/stat")) {
        Ok(value)=>value,
        Err(error) if error.kind()==std::io::ErrorKind::NotFound=>return None,
        Err(error)=>panic!("cannot observe fixture shell termination: {error}"),
    };
    let (_,fields)=value.rsplit_once(')').expect("Linux proc stat command delimiter");
    let fields:Vec<_>=fields.split_whitespace().collect();
    Some((fields.first().expect("process state").to_string(),fields.get(19).expect("process starttime").to_string()))
}
// Use the actual supported Windows shell, never a POSIX emulation dependency.
fn fixture_shell()->String {
    #[cfg(windows)]
    {std::path::PathBuf::from(std::env::var_os("SystemRoot").expect("Windows SystemRoot"))
        .join("System32/WindowsPowerShell/v1.0/powershell.exe").to_string_lossy().into_owned()}
    #[cfg(not(windows))]
    {"/bin/sh".into()}
}
#[cfg(windows)]
fn shell_process(pid:u32)->Option<(String,String)> {
    // Creation time prevents PID reuse from being confused with the retained
    // child. Fail closed on access/inspection errors rather than assuming exit.
    let script=format!("$ErrorActionPreference='Stop'; $p=Get-Process -Id {pid} -ErrorAction SilentlyContinue; if ($null -ne $p) {{ [Console]::Write($p.StartTime.ToUniversalTime().Ticks) }}");
    let result=std::process::Command::new(fixture_shell()).args(["-NoProfile","-NonInteractive","-Command",&script]).output().expect("Windows process inspection");
    assert!(result.status.success(),"Windows process inspection failed: {}",String::from_utf8_lossy(&result.stderr));
    let creation=String::from_utf8(result.stdout).expect("process creation time").trim().to_owned();
    if creation.is_empty(){None}else{assert!(creation.parse::<u64>().is_ok());Some(("running".into(),creation))}
}
fn cleanup_fixture_shell(pid:u32) {
    #[cfg(target_os="linux")]
    {let _=std::process::Command::new("kill").args(["-KILL",&pid.to_string()]).status();}
    #[cfg(windows)]
    {let script=format!("$ErrorActionPreference='Stop'; Stop-Process -Id {pid} -Force -ErrorAction SilentlyContinue");
     assert!(std::process::Command::new(fixture_shell()).args(["-NoProfile","-NonInteractive","-Command",&script]).status().expect("fixture cleanup").success());}
}
fn assert_fixture_shell_command(pid:u32) {
    #[cfg(target_os="linux")]
    {let cmdline=std::fs::read(format!("/proc/{pid}/cmdline")).expect("host-visible fixture shell");
     assert!(String::from_utf8_lossy(&cmdline).contains("output/late.txt"),"fixture PID must identify the actual shell");}
    #[cfg(windows)]
    {let script=format!("$ErrorActionPreference='Stop'; (Get-CimInstance Win32_Process -Filter 'ProcessId = {pid}').CommandLine");
     let result=std::process::Command::new(fixture_shell()).args(["-NoProfile","-NonInteractive","-Command",&script]).output().expect("fixture command line");
     assert!(result.status.success());assert!(String::from_utf8_lossy(&result.stdout).contains("output/late.txt"),"fixture PID must identify the actual shell");}
}
// Inspect actual persisted TurnContext configuration after the native writer
// closes. This is fixture-side filesystem inspection, not a renderer capability.
fn retained_sandbox_modes(home:&std::path::Path,thread:&str)->Vec<(String,String)> {
    fn visit(dir:&std::path::Path,files:&mut Vec<std::path::PathBuf>) {
        if !dir.exists(){return;}
        for entry in std::fs::read_dir(dir).expect("retained fixture history") {
            let entry=entry.unwrap();
            if entry.file_type().unwrap().is_dir(){visit(&entry.path(),files);}
            else{files.push(entry.path());}
        }
    }
    let mut files=Vec::new();visit(&home.join("sessions"),&mut files);
    assert!(files.len()<100,"bounded isolated fixture history");
    let mut modes=Vec::new();
    for file in files {
        let text=std::fs::read_to_string(file).expect("retained rollout");
        let mut lines=text.lines();
        let first:Value=serde_json::from_str(lines.next().expect("rollout header")).unwrap();
        if first["type"]!="session_meta" || first["payload"]["id"]!=thread {continue;}
        for line in lines {
            let record:Value=serde_json::from_str(line).expect("retained record");
            if record["type"]=="turn_context" {
                modes.push((record["payload"]["turn_id"].as_str().expect("runtime turn identity").into(),
                    record["payload"]["sandbox_policy"]["type"].as_str().expect("persisted effective sandbox").into()));
            }
        }
    }
    modes
}
async fn wait_progress<F:Fn(&Value)->bool>(server:&mut TestAppServer,host:&mut PrivateTaskHost,task:&str,policy:&Value,ready:F)->Value {
    let deadline=tokio::time::Instant::now()+Duration::from_secs(45);
    loop {
        let value=private_rpc(server,host,"inquello/tasks/progress",json!({"taskId":task,"workspacePolicy":policy})).await;
        if value.get("rpcError").is_none() && ready(&value) {return value;}
        assert!(tokio::time::Instant::now()<deadline,"expected retained endpoint state: {value}");
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
}
pub(super) async fn run(route:&'static str,scenario:&'static str,service:Option<ServiceFixture>) {
    let revoke=scenario!="allowed" && !scenario.starts_with("lifecycle-");
    let principal=service.as_ref().map_or(ALICE,|s|s.principal.as_str()).to_owned();
    let workspace=service.as_ref().map_or(COMPANY_A,|s|s.workspace.as_str()).to_owned();
    let directory=tempfile::tempdir().unwrap();let home=directory.path().join("runtime");std::fs::create_dir(&home).unwrap();
    std::fs::write(directory.path().join(".inquello-fictional-audit-session"),b"explicit isolated fixture").unwrap();
    let model=if route=="codex-responses"{"fixture-responses-20261031"}else{"claude-sonnet-5-5"};
    let catalog=home.join("models.json");
    std::fs::write(&catalog,json!({"models":[{"slug":model,"display_name":"Authorization fixture","description":"Fixture only","default_reasoning_level":null,"supported_reasoning_levels":[],"shell_type":"unified_exec","visibility":"list","supported_in_api":true,"priority":1,"upgrade":null,"model_messages":null,"support_verbosity":false,"default_verbosity":null,"apply_patch_tool_type":null,"truncation_policy":{"mode":"bytes","limit":10000},"supports_image_detail_original":false,"context_window":32000,"auto_compact_token_limit":null,"experimental_supported_tools":[]}]}).to_string()).unwrap();
    std::fs::write(home.join("config.toml"),format!("model_catalog_json = {}\ncli_auth_credentials_store = \"keyring\"\n[features]\nnetwork_proxy = true\n",serde_json::to_string(&catalog).unwrap())).unwrap();
    let binary=std::env::var_os("INQUELLO_FIXTURE_APP_SERVER_BIN").expect("separately built debug inference-fixtures binary required");
    let database=directory.path().join("working.sqlite");
    let mut server=TestAppServer::builder().with_program(std::path::Path::new(&binary)).with_codex_home(&home).without_auto_env()
        .with_env_overrides(&[("INQUELLO_WORKING_STORE",database.to_str()),("OPENAI_API_KEY",None),("ANTHROPIC_API_KEY",None)])
        .build_initialized().await.unwrap();
    let mut host=PrivateTaskHost {authority_context:json!({}),authority_callback:None,revoke_callback:service.as_ref().map(|s|s.revoke.clone()),authority_available:true,workspace_id:workspace.clone(),answered_questions:0,allow_once:true,lifecycle:Some(scenario),
        policy:json!({"workspaceId":workspace,"policyRevision":1,"authorizationEpoch":1,"execution":{"command_rules":[{"prefix":[fixture_shell()],"decision":"prompt"}]}}),
        notifications:vec![],denied_commands:vec![],bound_thread:None,pending:Default::default()};
    if let Some(service)=&service {host.policy=service.policy.clone();}
    assert!(private_rpc(&mut server,&mut host,"inquello/session/setPrincipal",json!({"principalId":principal})).await.get("rpcError").is_none());
    assert_eq!(private_rpc(&mut server,&mut host,"inquello/tasks/bootstrap",json!({"workspaceId":workspace,"isolatedRoot":directory.path()})).await["accepted"],true);
    let configuration=json!({"routeId":route,"deployment":if route=="codex-responses"{"openai-api"}else{"anthropic-direct"},"model":model,"apiVersion":if route=="codex-responses"{"responses-v1"}else{"2026-10-21"},"accountRef":principal,"region":null});
    assert!(private_rpc(&mut server,&mut host,"inquello/routes/configure",json!({"operationId":uuid::Uuid::new_v4(),"expectedRevision":0,"configuration":configuration})).await.get("rpcError").is_none());
    let fixture=fixture(route,scenario).await;
    assert_eq!(private_rpc(&mut server,&mut host,"inquello/fixture/taskTransport",json!({"workspaceId":workspace,"configurationRevision":1,"routeId":route,"endpoint":fixture.endpoint,"certificate":fixture.certificate})).await["accepted"],true);
    let policy=host.policy.clone();let operation=uuid::Uuid::new_v4().to_string();
    host.authority_context=json!({"configuration":configuration,"operationId":operation});
    let command=json!({"operationId":operation,"workspaceId":workspace,"engagementId":null,"folderId":null,
        "request":"Review fictional procurement: INV-104 K12,480 appears twice; INV-105 is distinct. Write only the permitted local marker, then report the candidate duplicate.",
        "routeId":route,"configurationRevision":1,"reasoning":"default","speed":"default","workspacePolicy":policy});
    host.authority_callback=service.as_ref().map(|s|s.authority.clone());
    if scenario=="deny-before-dispatch" && service.is_none(){host.authority_available=false;}
    let mut start=private_rpc(&mut server,&mut host,"inquello/tasks/start",command.clone()).await;
    if scenario=="deny-before-dispatch" {
        assert!(start.get("rpcError").is_some(),"missing approval blocks first dispatch");
        server.shutdown_gracefully().await.unwrap();
        assert!(fixture.requests.lock().await.is_empty());fixture.stop.send(()).unwrap();fixture.task.await.unwrap();return;
    }
    // A fast permission event can precede the start response. If withdrawal
    // fences that response, use only IDs captured from the earlier authorized
    // forThread response; do not require post-withdrawal disclosure to succeed.
    if scenario=="revoke-pending-permission" && !host.denied_commands.is_empty() && start.get("rpcError").is_some() {
        start=json!({"taskId":host.authority_context["taskId"],"runId":host.authority_context["runId"],"threadId":host.authority_context["threadId"]});
    }
    assert!(start.get("rpcError").is_none(),"normal retained start: {start}");
    host.authority_context["taskId"]=start["taskId"].clone();
    host.authority_context["runId"]=start["runId"].clone();
    if scenario.starts_with("lifecycle-") {
        assert!(service.is_none(),"Synthetic native route fixture, not organization eligibility proof");
        let task=start["taskId"].as_str().unwrap().to_owned();
        let thread=start["threadId"].as_str().unwrap().to_owned();
        let output=directory.path().join("tasks").join(&task).join("output");
        let deadline=tokio::time::Instant::now()+Duration::from_secs(45);
        while !output.join("started.txt").exists() {
            assert!(tokio::time::Instant::now()<deadline,"actual gated local tool must start");
            let observed=private_rpc(&mut server,&mut host,"inquello/tasks/reconcile",json!({"operationId":operation})).await;
            assert!(observed.get("rpcError").is_none());
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        let observed=private_rpc(&mut server,&mut host,"inquello/tasks/forThread",json!({"threadId":thread})).await;
        assert!(observed["turnId"].as_str().is_some());
        if scenario=="lifecycle-progress-continuity" {
            let before=private_rpc(&mut server,&mut host,"inquello/tasks/progress",json!({"taskId":task,"workspacePolicy":policy})).await;
            assert!(before.get("rpcError").is_none(),"actual pre-Resume endpoint: {before}");
            let rows=before["results"].as_array().unwrap();
            assert!(rows.iter().any(|r|r["id"]=="result:unaffected" && r["sourceTurnId"]==observed["turnId"]));
            assert!(rows.iter().any(|r|r["id"]=="result:duplicates" && r["revision"]==1 && r["changeReason"]=="Initial invoice comparison"));
            assert!(before["resultHistory"].as_array().unwrap().is_empty());
        }
        let command_for=|request:Option<&str>|json!({"operationId":uuid::Uuid::new_v4().to_string(),"taskId":task,
            "expectedRunId":observed["runId"],"expectedRuntimeId":observed["runtimeId"],"expectedTurnId":observed["turnId"],"request":request,"workspacePolicy":policy});
        if scenario=="lifecycle-progress-cache" {
            let initial=wait_progress(&mut server,&mut host,&task,&policy,|p|p["items"].as_array().is_some_and(|items|items.iter().any(|item|item["id"]=="call_authorized" && item["status"]=="running")) && p["results"].as_array().is_some_and(|rows|rows.iter().any(|row|row["id"]=="result:duplicates"))).await;
            let initial_id=initial["resultPage"]["snapshotId"].clone();
            assert!(initial["results"].as_array().unwrap().iter().any(|row|row["id"]=="result:duplicates" && row["evidenceIds"].as_array().unwrap().iter().any(|id|id=="call_authorized")));
            let items=initial["items"].as_array().unwrap();
            assert!(items.iter().position(|item|item["id"]=="call_authorized").unwrap()<items.iter().rposition(|item|item["kind"]=="tool").unwrap(),"cited command is older than the retained publication");
            // The exec tool yielded after 1s, but the retained native command
            // remains live. Its later completion must invalidate even though
            // the newest-created publication item has not changed.
            std::fs::write(output.join("release.txt"),b"complete original evidence command").unwrap();
            let completed=wait_progress(&mut server,&mut host,&task,&policy,|p|p["items"].as_array().is_some_and(|items|items.iter().any(|item|item["id"]=="call_authorized" && item["status"]=="completed"))).await;
            assert_eq!(completed["turnId"],observed["turnId"]);assert_ne!(completed["resultPage"]["snapshotId"],initial_id,"older cited evidence completion invalidates the analytical snapshot");
            let stale=private_rpc(&mut server,&mut host,"inquello/tasks/progress",json!({"taskId":task,"workspacePolicy":policy,"resultPage":{"snapshotId":initial_id,"currentOffset":0,"historyOffset":0}})).await;
            assert!(stale["rpcError"]["message"].as_str().is_some_and(|m|m.contains("Findings or cited evidence changed")));
            fixture.release.notify_one(); // Deliver the next real inquello_progress call.
            let revised=wait_progress(&mut server,&mut host,&task,&policy,|p|p["results"].as_array().is_some_and(|rows|rows.iter().any(|row|row["id"]=="result:duplicates" && row["revision"]==2))).await;
            assert_eq!(revised["turnId"],observed["turnId"],"new publication is in the SAME turn, not Resume");
            assert_ne!(revised["resultPage"]["snapshotId"],completed["resultPage"]["snapshotId"]);
            let stale=private_rpc(&mut server,&mut host,"inquello/tasks/progress",json!({"taskId":task,"workspacePolicy":policy,"resultPage":{"snapshotId":completed["resultPage"]["snapshotId"],"currentOffset":0,"historyOffset":0}})).await;
            assert!(stale["rpcError"]["message"].as_str().is_some_and(|m|m.contains("Findings or cited evidence changed")));
            fixture.release.notify_one(); // Unrelated final assistant output.
            let ended=wait_progress(&mut server,&mut host,&task,&policy,|p|p["status"]=="completed" && p["items"].as_array().is_some_and(|items|items.iter().any(|item|item["text"]==LATE))).await;
            assert_eq!(ended["turnId"],observed["turnId"]);assert_eq!(ended["resultPage"]["snapshotId"],revised["resultPage"]["snapshotId"],"unrelated assistant stream/completion preserves page identity");
            assert_eq!(fixture.requests.lock().await.len(),3,"exact controlled parallel command+publication/publication/final sequence");
            server.shutdown_gracefully().await.unwrap();fixture.stop.send(()).unwrap();fixture.task.await.unwrap();return;
        }
        if scenario=="lifecycle-stop-provider-unavailable" {
            // Fault new-inference readiness while the original authorized local
            // effect is genuinely running. Do not revoke cancellation authority
            // or credentials (which could automatically cancel the guard first).
            let pid:u32=std::fs::read_to_string(output.join("pid.txt")).unwrap().parse().unwrap();
            let (_,created)=shell_process(pid).expect("original shell before provider outage");
            std::fs::write(directory.path().join(".inquello-fixture-provider-unavailable"),b"synthetic new-inference outage").unwrap();
            let refused=private_rpc(&mut server,&mut host,"inquello/tasks/preflight",json!({"workspaceId":workspace,"routeId":route,"configurationRevision":1,"workspacePolicy":policy})).await;
            assert!(refused["rpcError"]["message"].as_str().is_some_and(|m|m.contains("Synthetic fixture provider readiness is unavailable")),"must reach the real candidate-readiness boundary: {refused}");
            let (state,current)=shell_process(pid).expect("readiness refusal must not stand in for Stop");
            assert_eq!(current,created);assert!(!matches!(state.as_str(),"Z"|"X"));
            let still_running=private_rpc(&mut server,&mut host,"inquello/tasks/forThread",json!({"threadId":thread})).await;
            assert_eq!(still_running["status"],"running");assert_eq!(still_running["turnId"],observed["turnId"]);
        }
        if scenario=="lifecycle-stop-inflight-steer" {
            host.authority_context["workingDatabase"]=json!(database);
            host.authority_context["concurrentStop"]=command_for(None);
            host.authority_context["holdSteerAuthority"]=json!(true);
            let steer=private_rpc(&mut server,&mut host,"inquello/tasks/steer",command_for(Some("Exclude cancelled invoices; preserve this draft if admission fails."))).await;
            assert!(host.authority_context["heldAuthorityRequest"].is_number() || host.authority_context["heldAuthorityRequest"].is_string(),"a real writer-held authority request must be withheld");
            assert!(steer.get("rpcError").is_some(),"timed-out validation must not report admission: {steer}");
            assert!(host.authority_context["concurrentStopId"].as_i64().is_some(),"Stop was sent while steering authority remained pending");
        }
        let steer_only=matches!(scenario,"lifecycle-steer"|"lifecycle-steer-lost-ack");
        let mut lost_steer_operation=None;
        if steer_only || scenario=="lifecycle-stop-pending-steer" {
            let correction="Exclude cancelled invoices, reanalyse affected findings and explain the changes; retain unrelated work.";
            let mut wrong=command_for(Some(correction));wrong["expectedTurnId"]=json!("ended-turn");
            assert!(private_rpc(&mut server,&mut host,"inquello/tasks/steer",wrong).await.get("rpcError").is_some());
            let guidance=command_for(Some(correction));
            let admitted=private_rpc(&mut server,&mut host,"inquello/tasks/steer",guidance.clone()).await;
            assert_eq!(admitted["status"],"admitted","actual same-active-turn steering admission only");
            let replay=private_rpc(&mut server,&mut host,"inquello/tasks/steer",guidance.clone()).await;
            assert_eq!(replay["operationId"],admitted["operationId"]);
            if scenario!="lifecycle-steer" {
                use sqlx::Connection;
                let mut db=sqlx::SqliteConnection::connect_with(&sqlx::sqlite::SqliteConnectOptions::new().filename(&database)).await.unwrap();
                // Fault only the acknowledgement journal, not runtime input or
                // identity. Native admission must be recovered by operation ID.
                let operation=guidance["operationId"].as_str().unwrap().to_owned();
                let changed=sqlx::query("UPDATE task_lifecycle SET receipt=json_set(receipt,'$.status','uncertain') WHERE operation_id=?")
                    .bind(&operation).execute(&mut db).await.unwrap();
                assert_eq!(changed.rows_affected(),1);db.close().await.unwrap();
                lost_steer_operation=Some(operation);
            }
            if steer_only {std::fs::write(output.join("release.txt"),b"release authorized fixture tool").unwrap();}
        }
        if steer_only {
            // Continue the same active turn; never substitute Resume/start.
        } else if matches!(scenario,"lifecycle-restart"|"lifecycle-crash") {
            // Actual native process loss followed by explicit retained resume.
            // Neither authored fixture is executed Windows/Electron evidence.
            if scenario=="lifecycle-crash" {
                let pid:u32=std::fs::read_to_string(output.join("pid.txt")).unwrap().parse().unwrap();
                let prior=shell_process(pid);
                server.crash_and_wait().await.unwrap();
                // A crashed host does not prove every external effect terminated.
                // Clean any surviving fixture shell without attributing that test
                // cleanup to the application's Stop or recovery semantics.
                if let (Some((_,before)),Some((state,after)))=(prior,shell_process(pid)) {
                    if before==after && !matches!(state.as_str(),"Z"|"X") {
                        cleanup_fixture_shell(pid);
                    }
                }
            } else {server.shutdown_gracefully().await.unwrap();}
            server=TestAppServer::builder().with_program(std::path::Path::new(&binary)).with_codex_home(&home).without_auto_env()
                .with_env_overrides(&[("INQUELLO_WORKING_STORE",database.to_str()),("OPENAI_API_KEY",None),("ANTHROPIC_API_KEY",None)])
                .build_initialized().await.unwrap();
            host.pending.clear();host.notifications.clear();
            private_rpc(&mut server,&mut host,"inquello/session/setPrincipal",json!({"principalId":principal})).await;
            assert_eq!(private_rpc(&mut server,&mut host,"inquello/tasks/bootstrap",json!({"workspaceId":workspace,"isolatedRoot":directory.path()})).await["accepted"],true);
            assert_eq!(private_rpc(&mut server,&mut host,"inquello/fixture/taskTransport",json!({"workspaceId":workspace,"configurationRevision":1,"routeId":route,"endpoint":fixture.endpoint,"certificate":fixture.certificate})).await["accepted"],true);
            let retained=private_rpc(&mut server,&mut host,"inquello/tasks/progress",json!({"taskId":task,"workspacePolicy":policy})).await;
            // Progress is Task-bound; it exposes no generic replacement-thread API.
            assert!(retained.get("rpcError").is_none(),"authorized retained progress after runtime loss: {retained}");
            assert!(matches!(retained["status"].as_str(),Some("cancelled"|"uncertain"|"failed")));
            assert_eq!(fixture.requests.lock().await.len(),1,"restarting never automatically samples");
        } else {
            let pid:u32=std::fs::read_to_string(output.join("pid.txt")).unwrap().parse().unwrap();
            let (_,starttime)=shell_process(pid).expect("real local shell before Stop");
            let stop=if scenario=="lifecycle-stop-inflight-steer" {host.authority_context["concurrentStop"].clone()}else{command_for(None)};
            // Concurrent clicks share one operation identity; neither may dispatch twice.
            let first=if scenario=="lifecycle-stop-inflight-steer" {host.authority_context["concurrentStopId"].as_i64().unwrap()}else{server.send_request("inquello/tasks/stop",Some(stop.clone())).await.unwrap()};
            let second=server.send_request("inquello/tasks/stop",Some(stop)).await.unwrap();
            let stopped=private_response(&mut server,&mut host,first).await;
            let duplicate=private_response(&mut server,&mut host,second).await;
            assert_eq!(stopped["status"],"interrupted","submission alone is not the stop receipt: {stopped}");
            assert_eq!(duplicate,stopped);
            let deadline=tokio::time::Instant::now()+Duration::from_secs(15);
            loop {
                if shell_process(pid).is_none_or(|(state,current)|current!=starttime||matches!(state.as_str(),"Z"|"X")){break;}
                assert!(tokio::time::Instant::now()<deadline,"Stop must preserve native local shell cancellation");
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
            assert!(output.join("started.txt").exists(),"Stop did not roll back a confirmed effect");
            assert!(!output.join("late.txt").exists(),"pending effect was not labelled or executed as complete");
            std::fs::write(output.join("release.txt"),b"release after confirmed shell termination").unwrap();
            assert!(!output.join("late.txt").exists());
        }
        if scenario=="lifecycle-stop-provider-unavailable" {
            // The fault stayed active through actual Stop/PID termination above.
            // Recovery of provider readiness permits a fresh explicit Resume;
            // clearing a fixture fault never dispatches work by itself.
            assert_eq!(fixture.requests.lock().await.len(),1);
            std::fs::remove_file(directory.path().join(".inquello-fixture-provider-unavailable")).unwrap();
        }
        if !steer_only {
            let mut resume=command_for(Some("Resume this same retained Task without replaying confirmed effects; explain what remains."));
            match scenario {
                "lifecycle-warm-policy-change"=>{
                    // Same process and same retained thread, but a stricter
                    // current policy must replace the warm runtime's profile.
                    host.policy["policyRevision"]=json!(2);
                    host.policy["authorizationEpoch"]=json!(2);
                    host.policy["execution"]["sandbox"]=json!("read_only");
                    resume["workspacePolicy"]=host.policy.clone();
                },
                "lifecycle-revoke-before-resume"=>host.authority_available=false,
                "lifecycle-peer-private"=>{private_rpc(&mut server,&mut host,"inquello/session/setPrincipal",json!({"principalId":BOB})).await;},
                "lifecycle-cross-company"=>{
                    host.workspace_id=COMPANY_B.into();host.policy["workspaceId"]=json!(COMPANY_B);resume["workspacePolicy"]=host.policy.clone();
                    private_rpc(&mut server,&mut host,"inquello/tasks/bootstrap",json!({"workspaceId":COMPANY_B,"isolatedRoot":directory.path()})).await;
                },
                "lifecycle-missing-linkage"=>{
                    use sqlx::Connection;
                    let mut db=sqlx::SqliteConnection::connect_with(&sqlx::sqlite::SqliteConnectOptions::new().filename(&database)).await.unwrap();
                    // Simulate lost journal linkage, without weakening the immutable
                    // Task-thread trigger or invoking any generic runtime API.
                    sqlx::query("DELETE FROM task_runs WHERE task_id=?").bind(&task).execute(&mut db).await.unwrap();
                    db.close().await.unwrap();
                },
                "lifecycle-source-reference"=>{
                    use sqlx::Connection;
                    let mut db=sqlx::SqliteConnection::connect_with(&sqlx::sqlite::SqliteConnectOptions::new().filename(&database)).await.unwrap();
                    // Isolated retained-metadata fault: this route has no source
                    // attachment authority or continuity grant to reconstruct it.
                    sqlx::query("UPDATE tasks SET source_refs=? WHERE task_id=?")
                        .bind("[\"unavailable-source-context\"]").bind(&task).execute(&mut db).await.unwrap();
                    db.close().await.unwrap();
                },
                "lifecycle-unknown-turn"=>{
                    use sqlx::Connection;
                    let mut db=sqlx::SqliteConnection::connect_with(&sqlx::sqlite::SqliteConnectOptions::new().filename(&database)).await.unwrap();
                    let mut tx=db.begin().await.unwrap();
                    let row:(String,String,String,String,Option<String>,String)=sqlx::query_as("SELECT principal_id,operation_id,task_id,runtime_id,thread_id,record FROM task_runs WHERE task_id=?")
                        .bind(&task).fetch_one(&mut *tx).await.unwrap();
                    let mut record:Value=serde_json::from_str(&row.5).unwrap();
                    record["turn_id"]=json!("unverified-lineage-turn");
                    // Controlled corruption in this disposable fixture replaces
                    // only the recorded turn identity. Task/thread/owner remain
                    // unchanged, so Resume must reach its retained-turn check:
                    // the real runtime turn is now outside verified lineage.
                    sqlx::query("DELETE FROM task_runs WHERE task_id=?").bind(&task).execute(&mut *tx).await.unwrap();
                    sqlx::query("INSERT INTO task_runs(principal_id,operation_id,task_id,runtime_id,thread_id,record) VALUES(?,?,?,?,?,?)")
                        .bind(row.0).bind(row.1).bind(row.2).bind(row.3).bind(row.4).bind(record.to_string()).execute(&mut *tx).await.unwrap();
                    tx.commit().await.unwrap();db.close().await.unwrap();
                    resume["expectedTurnId"]=json!("unverified-lineage-turn");
                },
                _=>{},
            }
            let resumed=private_rpc(&mut server,&mut host,"inquello/tasks/resume",resume.clone()).await;
            if matches!(scenario,"lifecycle-revoke-before-resume"|"lifecycle-missing-linkage"|"lifecycle-peer-private"|"lifecycle-cross-company"|"lifecycle-unknown-turn"|"lifecycle-source-reference") {
                assert!(resumed.get("rpcError").is_some(),"unverifiable/unauthorized context refuses actual Resume");
                assert!(!resumed.to_string().contains("INV-104"));
                if scenario=="lifecycle-unknown-turn" {
                    assert!(resumed["rpcError"]["message"].as_str().unwrap().contains("unverified Task turn"),"must reject actual retained history outside verified lineage, not an unrelated preflight: {resumed}");
                }
                if scenario=="lifecycle-source-reference" {
                    assert!(resumed["rpcError"]["message"].as_str().unwrap().contains("source or artifact context"),"must reject unavailable retained source context before execution: {resumed}");
                }
                assert_eq!(fixture.requests.lock().await.len(),1,"negative Resume gate made no model call or replacement work");
                {
                    use sqlx::Connection;
                    let mut db=sqlx::SqliteConnection::connect_with(&sqlx::sqlite::SqliteConnectOptions::new().filename(&database).read_only(true)).await.unwrap();
                    let receipts:i64=sqlx::query_scalar("SELECT COUNT(*) FROM task_lifecycle WHERE operation_id=?")
                        .bind(resume["operationId"].as_str().unwrap()).fetch_one(&mut db).await.unwrap();
                    let archived:i64=sqlx::query_scalar("SELECT COUNT(*) FROM task_run_history WHERE task_id=?").bind(&task).fetch_one(&mut db).await.unwrap();
                    let tasks:i64=sqlx::query_scalar("SELECT COUNT(*) FROM tasks").fetch_one(&mut db).await.unwrap();
                    assert_eq!(receipts,0,"context denial happened before lifecycle reservation/dispatch");
                    assert_eq!(archived,0,"denial did not rotate the retained run");assert_eq!(tasks,1,"denial did not create replacement work");
                    db.close().await.unwrap();
                }
                server.shutdown_gracefully().await.unwrap();fixture.stop.send(()).unwrap();fixture.task.await.unwrap();return;
            }
            assert_eq!(resumed["status"],"admitted","real retained turn admission: {resumed}");
            assert_eq!(resumed["taskId"],task);assert_eq!(resumed["threadId"],thread);assert_ne!(resumed["runId"],observed["runId"]);
            // Treat the first host acknowledgement as lost: recover only this receipt.
            let reconciled=private_rpc(&mut server,&mut host,"inquello/tasks/lifecycleReconcile",json!({"operationId":resume["operationId"]})).await;
            assert_eq!(reconciled["runId"],resumed["runId"]);assert_eq!(reconciled["threadId"],thread);
            if scenario=="lifecycle-revoke-during-resume" {
                let deadline=tokio::time::Instant::now()+Duration::from_secs(30);
                while fixture.requests.lock().await.len()<2 {
                    assert!(tokio::time::Instant::now()<deadline);
                    private_rpc(&mut server,&mut host,"inquello/tasks/reconcile",json!({"operationId":operation})).await;
                    tokio::time::sleep(Duration::from_millis(20)).await;
                }
                host.authority_available=false;
                assert!(private_rpc(&mut server,&mut host,"inquello/tasks/lifecycleReconcile",json!({"operationId":resume["operationId"]})).await.get("rpcError").is_some());
                fixture.release.notify_one();
                assert!(private_rpc(&mut server,&mut host,"thread/read",json!({"threadId":thread,"includeTurns":true})).await.get("rpcError").is_some());
                assert!(!host.notifications.iter().any(|n|n.to_string().contains(LATE)),"revoked Resume never discloses late output");
                server.shutdown_gracefully().await.unwrap();fixture.stop.send(()).unwrap();fixture.task.await.unwrap();return;
            }
            let replay=private_rpc(&mut server,&mut host,"inquello/tasks/resume",resume).await;
            assert_eq!(replay["runId"],resumed["runId"],"repeat submission reconciles, never starts twice");
        }
        let deadline=tokio::time::Instant::now()+Duration::from_secs(45);
        loop {
            let status=private_rpc(&mut server,&mut host,"inquello/tasks/reconcile",json!({"operationId":operation})).await;
            assert!(status.get("rpcError").is_none());
            if status["status"]=="completed" {break;}
            assert!(tokio::time::Instant::now()<deadline,"retained continuation terminal state: {status}");
            assert!(!matches!(status["status"].as_str(),Some("failed"|"cancelled"|"uncertain")));
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        if scenario=="lifecycle-progress-continuity" {
            let after=private_rpc(&mut server,&mut host,"inquello/tasks/progress",json!({"taskId":task,"workspacePolicy":policy})).await;
            assert!(after.get("rpcError").is_none(),"actual post-Resume endpoint: {after}");
            let current=after["results"].as_array().unwrap();let history=after["resultHistory"].as_array().unwrap();
            assert!(current.iter().any(|r|r["id"]=="result:unaffected" && r["text"]=="Approval remains missing" && r["sourceTurnId"]==observed["turnId"]));
            assert!(current.iter().any(|r|r["id"]=="result:duplicates" && r["revision"]==2 && r["state"]=="current" && r["sourceTurnId"]==after["turnId"]));
            let old=history.iter().find(|r|r["id"]=="result:duplicates" && r["revision"]==1).expect("retained predecessor through actual endpoint");
            assert_eq!(old["sourceTurnId"],observed["turnId"]);assert_eq!(old["state"],"superseded");
            assert_eq!(old["changeReason"],"Initial invoice comparison");assert_eq!(old["supersededReason"],"Exclude cancelled invoices");
        }
        let requests=fixture.requests.lock().await;
        assert_eq!(requests.len(),if scenario=="lifecycle-progress-continuity" {4}else{2},"no automatic replay, extra model request or provider fallback");
        assert!(requests[if scenario=="lifecycle-progress-continuity" {2}else{1}].to_string().contains("INV-104"),"resumed/steered model actually receives permitted retained context");
        if steer_only {assert!(requests[1].to_string().contains("Exclude cancelled invoices"));}
        drop(requests);
        if scenario=="lifecycle-steer-lost-ack" {
            let operation=lost_steer_operation.as_ref().expect("correlated lost acknowledgement");
            let recovered=private_rpc(&mut server,&mut host,"inquello/tasks/lifecycleReconcile",json!({"operationId":operation})).await;
            assert_eq!(recovered["status"],"admitted","retained user-message client_id proves this exact steering admission: {recovered}");
            assert_eq!(recovered["operationId"],*operation);
            assert_eq!(fixture.requests.lock().await.len(),2,"reconciliation does not dispatch another effect");
        }
        // Both finish races are truthful and cannot create a new turn.
        let final_binding=private_rpc(&mut server,&mut host,"inquello/tasks/forThread",json!({"threadId":thread})).await;
        let ended=json!({"operationId":uuid::Uuid::new_v4().to_string(),"taskId":task,"expectedRunId":final_binding["runId"],"expectedRuntimeId":final_binding["runtimeId"],"expectedTurnId":final_binding["turnId"],"request":null,"workspacePolicy":host.policy});
        assert_eq!(private_rpc(&mut server,&mut host,"inquello/tasks/stop",ended.clone()).await["status"],"completed");
        let mut correction=ended;correction["operationId"]=json!(uuid::Uuid::new_v4().to_string());correction["request"]=json!("Keep this draft; do not start a new turn.");
        assert!(private_rpc(&mut server,&mut host,"inquello/tasks/steer",correction).await.get("rpcError").is_some());
        assert_eq!(fixture.requests.lock().await.len(),if scenario=="lifecycle-progress-continuity" {4}else{2});
        server.shutdown_gracefully().await.unwrap();
        if scenario=="lifecycle-warm-policy-change" {
            let modes=retained_sandbox_modes(&home,&thread);
            let prior=observed["turnId"].as_str().unwrap();
            let current=final_binding["turnId"].as_str().unwrap();
            assert_ne!(prior,current);
            assert!(modes.iter().any(|(turn,mode)|turn==prior && mode!="read-only"),"positive control: original runtime could write its confirmed marker");
            assert!(modes.iter().any(|(turn,mode)|turn==current && mode=="read-only"),"same-thread warm Resume must instantiate the new effective read-only sandbox, not merely replace its guard: {modes:?}");
        }
        fixture.stop.send(()).unwrap();fixture.task.await.unwrap();return;
    }
    let deadline=tokio::time::Instant::now()+Duration::from_secs(60);
    let mut running_shell=None;
    let final_status=loop {
        assert!(tokio::time::Instant::now()<deadline,"actual retained turn progress");
        let status=private_rpc(&mut server,&mut host,"inquello/tasks/reconcile",json!({"operationId":operation})).await;
        if scenario=="revoke-pending-permission" && !host.denied_commands.is_empty() {break start.clone();}
        if scenario=="revoke-running-tool" {
            let task=start["taskId"].as_str().unwrap();
            let output=directory.path().join("tasks").join(task).join("output");
            if output.join("started.txt").exists() {
                let pid:u32=std::fs::read_to_string(output.join("pid.txt")).unwrap().parse().unwrap();
                let (state,starttime)=shell_process(pid).expect("running fixture shell before withdrawal");
                assert!(!matches!(state.as_str(),"Z"|"X"));
                assert_fixture_shell_command(pid);
                running_shell=Some((pid,starttime));
                if let Some(revoke)=host.revoke_callback.clone(){revoke().await;}else{host.authority_available=false;}
                // Do not release the shell into a race with authorization observation.
                break start.clone();
            }
        }
        assert!(status.get("rpcError").is_none(),"before withdrawal: {status}");
        if scenario=="revoke-model"&&fixture.requests.lock().await.len()==2 {break status;}
        if status["status"]=="completed" {assert!(!revoke);break status;}
        assert!(!matches!(status["status"].as_str(),Some("failed"|"cancelled"|"uncertain")),"fixture failed: {status}");
        tokio::time::sleep(Duration::from_millis(20)).await;
    };
    let task=final_status["taskId"].as_str().unwrap();let thread=final_status["threadId"].as_str().unwrap();
    if matches!(scenario,"allowed"|"revoke-model") {
    assert_eq!(std::fs::read_to_string(directory.path().join("tasks").join(task).join("output/authorized.txt")).unwrap(),"permitted","actual allowed tool effect before any withdrawal");
    assert_eq!(host.denied_commands.len(),1,"ordinary exact one-use permission");
    assert_eq!(fixture.requests.lock().await.len(),2);
    } else {
        assert_eq!(fixture.requests.lock().await.len(),1,"no post-withdrawal model dispatch");
        if scenario=="revoke-pending-permission" {assert!(!directory.path().join("tasks").join(task).join("output/authorized.txt").exists());}
    }
    if revoke {
        if scenario=="revoke-model" {if let Some(revoke)=host.revoke_callback.clone(){revoke().await;}else{host.authority_available=false;}}
        let denied=private_rpc(&mut server,&mut host,"inquello/tasks/reconcile",json!({"operationId":operation})).await;
        assert!(denied.get("rpcError").is_some(),"current authority uncertainty fences disclosure");
        if let Some((pid,starttime))=&running_shell {
            let stopped_by=tokio::time::Instant::now()+Duration::from_secs(15);
            loop {
                let stopped=match shell_process(*pid) {
                    None=>true,
                    Some((state,current))=>current!=*starttime||matches!(state.as_str(),"Z"|"X"),
                };
                if stopped {break;}
                assert!(tokio::time::Instant::now()<stopped_by,"observed authorization denial must actually terminate the running shell");
                // Service callbacks for the ordinary cancellation observer must remain serviced.
                let denied=private_rpc(&mut server,&mut host,"inquello/tasks/reconcile",json!({"operationId":operation})).await;
                assert!(denied.get("rpcError").is_some());
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
            let output=directory.path().join("tasks").join(task).join("output");
            assert!(!output.join("late.txt").exists(),"blocked side effect did not run before cancellation acknowledgment");
            std::fs::write(output.join("release.txt"),b"release only after actual shell termination").unwrap();
            assert!(!output.join("late.txt").exists(),"terminated shell cannot execute a later gated effect");
        }
        if scenario=="revoke-model" {fixture.release.notify_one();}
        for method in ["inquello/tasks/forThread","thread/read"] {
            let params=if method=="thread/read" {json!({"threadId":thread,"includeTurns":true})}else{json!({"threadId":thread})};
            let denied=private_rpc(&mut server,&mut host,method,params).await;
            assert!(denied.get("rpcError").is_some());assert!(!denied.to_string().contains(LATE));
        }
        assert!(!host.notifications.iter().any(|n|n.to_string().contains(LATE)),"late output never reaches another visible cache");
    } else {
        let retained=private_rpc(&mut server,&mut host,"thread/read",json!({"threadId":thread,"includeTurns":true})).await;
        assert!(retained.to_string().contains("INV-104"));assert!(retained.get("rpcError").is_none());
        let retry=private_rpc(&mut server,&mut host,"inquello/tasks/start",command).await;assert_eq!(retry["taskId"],task);
        assert_eq!(fixture.requests.lock().await.len(),2,"reconcile/replay never dispatches another model attempt");
        host.authority_callback=None;host.revoke_callback=None;
        // Same Workspace peer cannot read a retained creator-private Task.
        private_rpc(&mut server,&mut host,"inquello/session/setPrincipal",json!({"principalId":BOB})).await;
        let denied=private_rpc(&mut server,&mut host,"inquello/tasks/forThread",json!({"threadId":thread})).await;
        let missing=private_rpc(&mut server,&mut host,"inquello/tasks/forThread",json!({"threadId":uuid::Uuid::new_v4()})).await;
        assert_eq!(denied,missing,"foreign and nonexistent bindings have the same bounded response");
        assert!(!denied.to_string().contains("INV-104"));
        let permission=uuid::Uuid::new_v4().to_string();let policy=host.policy.clone();
        let foreign=private_rpc(&mut server,&mut host,"inquello/tasks/consumePermission",json!({"taskId":task,"requestId":permission,"command":[fixture_shell(),"-c","fixture forbidden"],"workspacePolicy":policy})).await;
        assert!(foreign.get("rpcError").is_some());assert!(!foreign.to_string().contains("INV-104"));
        // The original principal still cannot use the old Task in another company.
        private_rpc(&mut server,&mut host,"inquello/session/setPrincipal",json!({"principalId":principal})).await;
        // A second company session cannot reuse the original thread either.
        host.workspace_id=COMPANY_B.into();host.policy["workspaceId"]=json!(COMPANY_B);
        private_rpc(&mut server,&mut host,"inquello/tasks/bootstrap",json!({"workspaceId":COMPANY_B,"isolatedRoot":directory.path()})).await;
        let denied=private_rpc(&mut server,&mut host,"thread/read",json!({"threadId":thread,"includeTurns":true})).await;
        assert!(denied.get("rpcError").is_some());assert!(!denied.to_string().contains("INV-104"));
    }
    server.shutdown_gracefully().await.unwrap();
    if scenario=="revoke-pending-permission" {assert!(!directory.path().join("tasks").join(task).join("output/authorized.txt").exists(),"late approval never executes after cancellation");}
    if running_shell.is_some() {assert!(!directory.path().join("tasks").join(task).join("output/late.txt").exists(),"no late side effect after observed shell termination and runtime shutdown");}
    fixture.stop.send(()).unwrap();fixture.task.await.unwrap();
}
