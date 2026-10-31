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
    let command=if scenario=="revoke-running-tool" {"printf '%s' \"$$\" > output/pid.txt; printf started > output/started.txt; n=0; while [ ! -f output/release.txt ] && [ \"$n\" -lt 300 ]; do sleep 0.1; n=$((n+1)); done; printf late > output/late.txt"}else{"printf permitted > output/authorized.txt"};
    let arguments=json!({"cmd":command,"shell":"/bin/sh"}).to_string();
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
    let hold_last=scenario=="revoke-model";
    let count=if scenario=="deny-before-dispatch"{0}else if matches!(scenario,"revoke-pending-permission"|"revoke-running-tool"){1}else{2};
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
                        assert!(!body.to_string().contains("sk-ant-"));captured.lock().await.push(body);break;
                    }
                }
            }
            if hold_last && index==1 {tokio::time::timeout(Duration::from_secs(45),released.notified()).await.expect("explicit revocation before late provider output");}
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
pub(super) async fn run(route:&'static str,scenario:&'static str,service:Option<ServiceFixture>) {
    let revoke=scenario!="allowed";
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
        policy:json!({"workspaceId":workspace,"policyRevision":1,"authorizationEpoch":1,"execution":{"command_rules":[{"prefix":["/bin/sh"],"decision":"prompt"}]}}),
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
                let cmdline=std::fs::read(format!("/proc/{pid}/cmdline")).expect("host-visible fixture shell");
                assert!(String::from_utf8_lossy(&cmdline).contains("output/late.txt"),"fixture PID must identify the real shell, not a namespace-local unrelated process");
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
        let foreign=private_rpc(&mut server,&mut host,"inquello/tasks/consumePermission",json!({"taskId":task,"requestId":permission,"command":["/bin/sh","-c","printf forbidden"],"workspacePolicy":policy})).await;
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
