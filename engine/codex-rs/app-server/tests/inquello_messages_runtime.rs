//! Inference dispatch and emitted tools execute inside the actual app-server child.
//! Requires separate debug feature binary; no inference runs in this test process.
#![cfg(all(feature = "inference-fixtures", target_os = "linux"))]
#![allow(clippy::expect_used)]
use app_test_support::TestAppServer;
use serde_json::{Value, json};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::Mutex;
use tokio_rustls::rustls;
const ALICE:&str = "11111111-1111-4111-8111-111111111111";
const WORKSPACE:&str = "5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e";
const KEY:&str = "sk-ant-synthetic-fixture-only";
fn event(kind:&str, value:Value) -> String { format!("event: {kind}\ndata: {value}\n\n") }
fn tool_stream() -> String {
    let mut wire = event("message_start",json!({"type":"message_start","message":{"id":"msg_tool","role":"assistant","model":"claude-sonnet-5-5","content":[],"usage":{"input_tokens":12}}}));
    wire += &event("content_block_start",json!({"type":"content_block_start","index":0,"content_block":{"type":"text","text":"Checking the synthetic action."}}));
    wire += &event("content_block_stop",json!({"type":"content_block_stop","index":0}));
    wire += &event("content_block_start",json!({"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"call_fixture","name":"run_fixture_command","input":{}}}));
    for fragment in ["{\"command\":[\"/usr/bin/touch\",", "\"output/fixture.txt\",\"../escape.txt\"]}"] {
        wire += &event("content_block_delta",json!({"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":fragment}}));
    }
    wire += &event("content_block_stop",json!({"type":"content_block_stop","index":1}));
    wire += &event("message_delta",json!({"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":8}}));
    wire += &event("message_stop",json!({"type":"message_stop"})); wire
}
struct TlsFixture { endpoint:String, cert:Vec<u8>, requests:Arc<Mutex<Vec<Value>>>, server:tokio::task::JoinHandle<()> }
async fn tls_fixture(responses:Vec<String>) -> TlsFixture {
    let certified = rcgen::generate_simple_self_signed(vec!["localhost".into(),"127.0.0.1".into()]).expect("certificate");
    let cert = certified.cert.der().to_vec();
    let key = rustls::pki_types::PrivatePkcs8KeyDer::from(certified.signing_key.serialize_der());
    let config = rustls::ServerConfig::builder_with_provider(Arc::new(rustls::crypto::aws_lc_rs::default_provider()))
        .with_safe_default_protocol_versions().expect("TLS versions").with_no_client_auth()
        .with_single_cert(vec![certified.cert.der().clone()],key.into()).expect("TLS config");
    let acceptor = tokio_rustls::TlsAcceptor::from(Arc::new(config));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.expect("loopback bind");
    let endpoint = format!("https://127.0.0.1:{}/v1/messages",listener.local_addr().expect("address").port());
    let requests = Arc::new(Mutex::new(Vec::new())); let captured=requests.clone();
    let server=tokio::spawn(async move {
        for response in responses {
            let (socket,_) = tokio::time::timeout(Duration::from_secs(20),listener.accept()).await.expect("expected request deadline").expect("accept");
            let mut socket=acceptor.accept(socket).await.expect("TLS handshake"); let mut bytes=Vec::new();
            loop {
                let mut chunk=[0;8192];let count=socket.read(&mut chunk).await.expect("HTTP read");assert!(count>0);
                bytes.extend_from_slice(&chunk[..count]); assert!(bytes.len()<65536);
                if let Some(end)=bytes.windows(4).position(|v|v==b"\r\n\r\n") {
                    let headers=String::from_utf8_lossy(&bytes[..end]).to_ascii_lowercase();
                    let length:usize=headers.lines().find_map(|l|l.strip_prefix("content-length: ")).expect("length header").parse().expect("length");
                    if bytes.len()>=end+4+length {
                        assert!(headers.contains("anthropic-version: 2026-10-21"));
                        assert!(headers.contains(&format!("x-api-key: {KEY}")));
                        let body:Value=serde_json::from_slice(&bytes[end+4..]).expect("body JSON");
                        assert!(!body.to_string().contains(KEY));assert_eq!(body["model"],"claude-sonnet-5-5");
                        captured.lock().await.push(body);break;
                    }
                }
            }
            socket.write_all(format!("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{response}",response.len()).as_bytes()).await.expect("TLS response");
            let _=socket.shutdown().await;
        }
        assert!(tokio::time::timeout(Duration::from_millis(300),listener.accept()).await.is_err(),"unexpected automatic retry");
    });
    TlsFixture{endpoint,cert,requests,server}
}

async fn rpc(server: &mut TestAppServer, method: &str, params: Value) -> Value {
    let id = server.send_request(method, Some(params)).await.expect("send RPC");
    tokio::time::timeout(Duration::from_secs(60), server.read_response(id)).await.expect("RPC deadline").expect("RPC response")
}
#[tokio::test(flavor="multi_thread", worker_threads=4)]
async fn messages_turn_executes_inside_app_server_process_and_real_sandbox_boundary() {
    let directory = tempfile::tempdir().expect("directory");
    let home = directory.path().join("runtime"); std::fs::create_dir(&home).expect("home");
    let database = directory.path().join("working.sqlite");
    let binary = std::env::var_os("INQUELLO_FIXTURE_APP_SERVER_BIN").map(std::path::PathBuf::from)
        .expect("set path to separately built debug inference-fixtures app-server");
    assert!(binary.is_file());
    let mut server = TestAppServer::builder().with_program(&binary).with_codex_home(&home).without_auto_env()
        .with_env_overrides(&[("INQUELLO_WORKING_STORE", database.to_str()), ("OPENAI_API_KEY", None), ("ANTHROPIC_API_KEY", None)])
        .build_initialized().await.expect("actual app-server child");
    rpc(&mut server,"inquello/session/setPrincipal",json!({"principalId":ALICE})).await;
    let task = rpc(&mut server,"inquello/task/create",json!({"operationId":"fixture-create","expectedRevision":0,"workspaceId":WORKSPACE,"engagementId":null,"folderId":null,"title":"Synthetic Messages fixture"})).await;
    let task = task["task"]["taskId"].as_str().expect("Task").to_string();
    let folder = directory.path().join("tasks").join(&task); std::fs::create_dir_all(folder.join("output")).expect("folder");
    let before = rpc(&mut server,"inquello/state/list",json!({"taskId":task})).await;
    let fixture = tls_fixture(vec![tool_stream(), include_str!("../../inquello-protocol/fixtures/inference/messages-text.sse").into()]).await;
    let result = rpc(&mut server,"inquello/fixture/messagesTurn",json!({"endpoint":fixture.endpoint,"certificate":fixture.cert,
        "taskId":task,"taskFolder":folder,"workspacePolicy":{"workspaceId":WORKSPACE,"policyRevision":1,"authorizationEpoch":11,
        "execution":{"command_rules":[{"prefix":["/usr/bin/touch"],"decision":"prompt"}]}}})).await;
    assert_eq!(result["accepted"],true);
    assert!(folder.join("output/fixture.txt").exists()); assert!(!folder.parent().expect("parent").join("escape.txt").exists());
    assert_eq!(before,rpc(&mut server,"inquello/state/list",json!({"taskId":task})).await);
    fixture.server.await.expect("TLS fixture"); let requests = fixture.requests.lock().await; assert_eq!(requests.len(),2);
    let last = &requests[1]["messages"].as_array().expect("messages").last().expect("message")["content"][0];
    assert_eq!(last["type"],"tool_result"); assert_eq!(requests[1]["system"],json!([]));
    server.shutdown_gracefully().await.expect("shutdown");
}

/// Same default-off native fixture scenario used by the seeded mounted desktop
/// smoke. All transport traps remain inside the child; no paid provider is called.
#[tokio::test(flavor="multi_thread", worker_threads=4)]
async fn usage_limit_fixture_refuses_at_native_boundary_and_preserves_local_work() {
    let directory=tempfile::tempdir().expect("directory");
    let home=directory.path().join("runtime");std::fs::create_dir(&home).expect("home");
    let database=directory.path().join("working.sqlite");
    let binary=std::env::var_os("INQUELLO_FIXTURE_APP_SERVER_BIN").map(std::path::PathBuf::from).expect("separately built debug fixture binary");
    let mut server=TestAppServer::builder().with_program(&binary).with_codex_home(&home).without_auto_env()
        .with_env_overrides(&[("INQUELLO_WORKING_STORE",database.to_str()),("OPENAI_API_KEY",None),("ANTHROPIC_API_KEY",None)])
        .build_initialized().await.expect("actual fixture child");
    rpc(&mut server,"inquello/session/setPrincipal",json!({"principalId":ALICE})).await;
    let created=rpc(&mut server,"inquello/task/create",json!({"operationId":"usage-create","expectedRevision":0,"workspaceId":WORKSPACE,"engagementId":null,"folderId":null,"title":"Synthetic quota fixture"})).await;
    let task=created["task"]["taskId"].as_str().expect("Task").to_owned();
    rpc(&mut server,"inquello/routes/configure",json!({"operationId":"usage-configure","expectedRevision":0,"configuration":{"routeId":"codex-responses","deployment":"openai-api","model":"fixture-model-20261030","apiVersion":"responses-v1","accountRef":ALICE,"region":null}})).await;
    rpc(&mut server,"inquello/routes/task/set",json!({"operationId":"usage-select","expectedRevision":0,"taskId":task,"routeId":"codex-responses","configurationRevision":1})).await;
    let policy=json!({"workspaceId":WORKSPACE,"policyRevision":1,"authorizationEpoch":1,"execution":{"command_rules":[{"prefix":["/usr/bin/true"],"decision":"allow"}]}});
    let scenario=|phase:&str|json!({"scenario":"usage-limit","phase":phase,"taskId":task,"workspacePolicy":policy});
    assert_eq!(rpc(&mut server,"inquello/fixture/messagesTurn",scenario("prepare")).await["providerCalls"],0);
    rpc(&mut server,"inquello/usage/set",json!({"operationId":"usage-defaults","expectedRevision":0,"routeRevision":1,"taskId":task,"reasoning":"default","speed":"default"})).await;
    let folder=directory.path().join("tasks").join(&task);std::fs::create_dir_all(folder.join("output")).expect("folder");
    let tool=rpc(&mut server,"inquello/tools/exec",json!({"workspacePolicy":policy,"taskId":task,"taskFolder":folder,"command":["/usr/bin/true"],"timeoutMs":5000})).await;
    assert_eq!(tool["exitCode"],0,"local tool is not blocked by model quota");
    let refused=rpc(&mut server,"inquello/fixture/messagesTurn",scenario("refuse")).await;
    assert_eq!(refused["refused"],true);assert_eq!(refused["providerCalls"],0);assert_eq!(refused["retainedAttempts"],1);
    let usage=rpc(&mut server,"inquello/usage/read",json!({"taskId":task})).await;
    assert_eq!(usage["limits"]["status"],"exhausted");
    let attempts=usage["usage"]["attempts"].as_array().expect("history");assert_eq!(attempts.len(),2);
    assert!(attempts.iter().any(|a|a["status"]=="completed"&&a["snapshot"]["operation_kind"]=="local-tool"));
    assert!(attempts.iter().any(|a|a["status"]=="refused"&&a["usage"]["input_tokens"].is_null()));
    assert_eq!(rpc(&mut server,"inquello/fixture/messagesTurn",scenario("clear")).await["accepted"],true);
    server.shutdown_gracefully().await.expect("shutdown");
}

// Story 1.25 differs deliberately from the earlier direct ModelClientSession
// fixture above: all work enters normal tasks/start, creates a retained thread,
// and answers the same host authority and permission requests as desktop main.
struct PrivateTaskHost {allow_once:bool, lifecycle:Option<&'static str>,policy:Value,notifications:Vec<Value>,denied_commands:Vec<Vec<String>>,bound_thread:Option<String>,pending:std::collections::HashMap<i64,Value>}
async fn private_rpc(server:&mut TestAppServer,host:&mut PrivateTaskHost,method:&str,params:Value)->Value {
    let id=server.send_request(method,Some(params)).await.expect("send private operation");
    private_response(server,host,id).await
}
async fn private_response(server:&mut TestAppServer,host:&mut PrivateTaskHost,id:i64)->Value {
    use codex_app_server_protocol::{JSONRPCMessage,RequestId};
    if let Some(response)=host.pending.remove(&id){return response;}
    let deadline=tokio::time::Instant::now()+Duration::from_secs(45);
    loop {
        if let Some(response)=host.pending.remove(&id){return response;}
        let message=tokio::time::timeout_at(deadline,server.read_next_message()).await.expect("private RPC deadline").expect("native message");
        match message {
            JSONRPCMessage::Response(response) if response.id==RequestId::Integer(id)=>return response.result,
            JSONRPCMessage::Error(error) if error.id==RequestId::Integer(id)=>return json!({"rpcError":error.error}),
            JSONRPCMessage::Response(response)=>{let RequestId::Integer(other)=response.id else {panic!("unexpected string response identity")};host.pending.insert(other,response.result);},
            JSONRPCMessage::Error(error)=>{let RequestId::Integer(other)=error.id else {panic!("unexpected string error identity")};host.pending.insert(other,json!({"rpcError":error.error}));},
            JSONRPCMessage::Request(request)=>match request.method.as_str() {
                "inquello/tasks/authority"=>{
                    assert_eq!(request.params.as_ref().expect("authority params")["workspaceId"],WORKSPACE);
                    server.send_response(request.id,json!({"workspacePolicy":host.policy})).await.expect("fresh host authority");
                },
                "execCommandApproval"=>{
                    let params=request.params.expect("approval params");
                    if host.lifecycle==Some("interrupt-between-attempts") {
                        let started=host.notifications.iter().find(|n|n["method"]=="turn/started").expect("actual started turn");
                        let interrupt=json!({"threadId":params["conversationId"],"turnId":started["params"]["turn"]["id"]});
                        assert!(interrupt["turnId"].as_str().is_some(),"interrupt the actual bound turn");
                        let response=Box::pin(private_rpc(server,host,"turn/interrupt",interrupt)).await;
                        assert!(response.get("rpcError").is_none(),"real retained interrupt: {response}");
                        server.send_response(request.id,json!({"decision":"denied"})).await.expect("close pending approval");
                        continue;
                    }
                    let thread=params["conversationId"].as_str().expect("real thread").to_owned();
                    let owned=Box::pin(private_rpc(server,host,"inquello/tasks/forThread",json!({"threadId":thread}))).await;
                    assert_eq!(owned["threadId"],thread);assert!(owned["taskId"].as_str().is_some());
                    host.bound_thread=Some(thread);
                    let command:Vec<String>=serde_json::from_value(params["command"].clone()).expect("exact native argv, not split command text");
                    let permission=uuid::Uuid::new_v4().to_string();
                    let policy=host.policy.clone();
                    let recorded=Box::pin(private_rpc(server,host,"inquello/permissions/request",json!({"operationId":uuid::Uuid::new_v4().to_string(),"requestId":permission,
                        "workspacePolicy":policy,"taskId":owned["taskId"],"command":command,"origin":"runtime","ttlMs":60000}))).await;
                    assert_eq!(recorded["request"]["origin"],"runtime");
                    let outcome=if host.allow_once {"allowed"}else{"denied"};
                    let decided=Box::pin(private_rpc(server,host,"inquello/permissions/decide",json!({"operationId":uuid::Uuid::new_v4().to_string(),"requestId":permission,
                        "expectedRevision":1,"outcome":outcome,"actorKind":"human","actorRef":null}))).await;
                    assert_eq!(decided["request"]["decision"]["outcome"],outcome);
                    if host.allow_once {
                        let consume=json!({"taskId":owned["taskId"],"requestId":permission,"command":command,"workspacePolicy":policy});
                        let consumed=Box::pin(private_rpc(server,host,"inquello/tasks/consumePermission",consume.clone())).await;
                        assert_eq!(consumed["accepted"],true,"normal native permission consumption");
                        let twice=Box::pin(private_rpc(server,host,"inquello/tasks/consumePermission",consume)).await;
                        assert!(twice.get("rpcError").is_some(),"same permission cannot be consumed twice");
                    }
                    host.denied_commands.push(command);
                    server.send_response(request.id,json!({"decision":if host.allow_once {"approved"}else{"denied"}})).await.expect("answer exact native action");
                },
                other=>panic!("unexpected private runtime request: {other}"),
            },
            JSONRPCMessage::Notification(notification)=>host.notifications.push(json!({"method":notification.method,"params":notification.params})),

        }
    }
}
fn retained_tool_stream()->String {
    retained_command_stream(json!({"cmd":"printf 'approved\\n' >> output/denied.txt","shell":"/bin/sh"}),"call_fixture")
}
fn audit_text_stream()->String {
    let mut wire=event("message_start",json!({"type":"message_start","message":{"id":"msg_audit","role":"assistant","model":"claude-sonnet-5-5","content":[],"usage":{"input_tokens":20}}}));
    wire+=&event("content_block_start",json!({"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}));
    wire+=&event("content_block_delta",json!({"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"R01/R03 are a duplicate candidate; R02 is missing approval. No fraud conclusion follows from these records."}}));
    wire+=&event("content_block_stop",json!({"type":"content_block_stop","index":0}));
    wire+=&event("message_delta",json!({"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":28}}));
    wire+=&event("message_stop",json!({"type":"message_stop"}));wire
}
#[tokio::test(flavor="multi_thread",worker_threads=4)]
async fn real_private_task_retained_thread_denial_and_lost_ack_reconcile_without_second_turn() {
    retained_private_task(false,None).await;
}
#[tokio::test(flavor="multi_thread",worker_threads=4)]
async fn real_private_task_retained_thread_allowed_one_use_permission() {
    retained_private_task(true,None).await;
}
#[tokio::test(flavor="multi_thread",worker_threads=4)]
async fn real_private_task_failure_before_sampling_has_actual_terminal_turn() {
    retained_private_task(false,Some("failure-before-sampling")).await;
}
#[tokio::test(flavor="multi_thread",worker_threads=4)]
async fn real_private_task_interrupt_between_attempts_has_actual_terminal_turn() {
    retained_private_task(false,Some("interrupt-between-attempts")).await;
}
#[tokio::test(flavor="multi_thread",worker_threads=4)]
async fn real_private_task_interrupt_cancels_running_shell_before_later_file_effect() {
    retained_private_task(true,Some("running-handler-interrupt")).await;
}
#[tokio::test(flavor="multi_thread",worker_threads=4)]
async fn real_private_task_authority_revocation_reaps_actual_one_shot_command() {
    retained_private_task(true,Some("running-authority-revoke")).await;
}
fn retained_running_tool_stream()->String {
    retained_command_stream(json!({"cmd":"printf started > output/started.txt; sleep 5; printf late > output/late.txt","shell":"/bin/sh","timeout_ms":10000}),"call_running")
}
fn retained_command_stream(command:Value,call_id:&str)->String {
    let mut wire=event("message_start",json!({"type":"message_start","message":{"id":"msg_running","role":"assistant","model":"claude-sonnet-5-5","content":[],"usage":{"input_tokens":12}}}));
    wire+=&event("content_block_start",json!({"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":call_id,"name":"exec_command","input":{}}}));
    wire+=&event("content_block_delta",json!({"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":command.to_string()}}));
    wire+=&event("content_block_stop",json!({"type":"content_block_stop","index":0}));
    wire+=&event("message_delta",json!({"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":8}}));
    wire+=&event("message_stop",json!({"type":"message_stop"}));wire
}
async fn retained_private_task(allow_once:bool,lifecycle:Option<&'static str>) {
    let directory=tempfile::tempdir().expect("governed isolated root");
    let home=directory.path().join("runtime");std::fs::create_dir(&home).expect("runtime home");
    std::fs::write(directory.path().join(".inquello-fictional-audit-session"),b"isolated fixture session\n").expect("explicit owner fixture marker");
    // Source-owned model metadata only, not a provider result or route evidence.
    let catalog=home.join("models.json");
    std::fs::write(&catalog,json!({"models":[{"slug":"claude-sonnet-5-5","display_name":"Fixture Messages model","description":"Retained child wiring fixture","default_reasoning_level":null,"supported_reasoning_levels":[],"shell_type":"unified_exec","visibility":"list","supported_in_api":true,"priority":1,"upgrade":null,"model_messages":null,"support_verbosity":false,"default_verbosity":null,"apply_patch_tool_type":null,"truncation_policy":{"mode":"bytes","limit":10000},"supports_image_detail_original":false,"context_window":32000,"auto_compact_token_limit":null,"experimental_supported_tools":[]}]}).to_string()).expect("fixture catalog");
    let pre_hook_sentinel=directory.path().join("pre-tool-hook-ran");
    let post_hook_sentinel=directory.path().join("post-tool-hook-ran");
    let mut config=format!("model_catalog_json = {}\ncli_auth_credentials_store = \"keyring\"\n[features]\nnetwork_proxy = true\nhooks = true\n",serde_json::to_string(&catalog).expect("catalog path"));
    for (event,sentinel) in [("PreToolUse",&pre_hook_sentinel),("PostToolUse",&post_hook_sentinel)] {
        let command=format!("/usr/bin/touch '{}'",sentinel.display());
        config+=&format!("\n[[hooks.{event}]]\n[[hooks.{event}.hooks]]\ntype = \"command\"\ncommand = {}\ntimeout = 5\n",serde_json::to_string(&command).expect("hook command"));
    }
    std::fs::write(home.join("config.toml"),config).expect("isolated runtime configuration with sentinel hooks");
    let database=directory.path().join("working.sqlite");
    let binary=std::env::var_os("INQUELLO_FIXTURE_APP_SERVER_BIN").map(std::path::PathBuf::from).expect("separately built debug fixture binary required, not skipped");
    let mut server=TestAppServer::builder().with_program(&binary).with_codex_home(&home).without_auto_env()
        .with_env_overrides(&[("INQUELLO_WORKING_STORE",database.to_str()),("OPENAI_API_KEY",None),("ANTHROPIC_API_KEY",None)])
        .build_initialized().await.expect("actual retained app-server child");
    // Trust both discovered hooks so absence of sentinels proves private-tool
    // suppression, not a disabled feature or untrusted-hook refusal.
    use codex_app_server_protocol::{ConfigBatchWriteParams,ConfigEdit,ConfigWriteResponse,HookTrustStatus,HooksListParams,HooksListResponse,MergeStrategy};
    let hook_request=server.send_hooks_list_request(HooksListParams {cwds:vec![directory.path().to_path_buf()]}).await.expect("list configured hooks");
    let listed:HooksListResponse=server.read_response(hook_request).await.expect("configured hook metadata");
    let hooks=&listed.data[0].hooks;assert_eq!(hooks.len(),2);assert!(hooks.iter().all(|hook|hook.enabled));
    let trusted=hooks.iter().map(|hook|(hook.key.clone(),json!({"trusted_hash":hook.current_hash}))).collect::<serde_json::Map<String,Value>>();
    let trust_request=server.send_config_batch_write_request(ConfigBatchWriteParams {edits:vec![ConfigEdit {key_path:"hooks.state".into(),value:Value::Object(trusted),merge_strategy:MergeStrategy::Upsert}],file_path:None,expected_version:None,reload_user_config:true}).await.expect("trust exact sentinel hooks");
    let _:ConfigWriteResponse=server.read_response(trust_request).await.expect("persist hook trust");
    let hook_request=server.send_hooks_list_request(HooksListParams {cwds:vec![directory.path().to_path_buf()]}).await.expect("list trusted hooks");
    let listed:HooksListResponse=server.read_response(hook_request).await.expect("trusted hook metadata");
    assert_eq!(listed.data[0].hooks.len(),2);
    assert!(listed.data[0].hooks.iter().all(|hook|hook.enabled&&hook.trust_status==HookTrustStatus::Trusted));
    let mut host=PrivateTaskHost {allow_once,lifecycle,policy:json!({"workspaceId":WORKSPACE,"policyRevision":1,"authorizationEpoch":1,"execution":{"command_rules":[{"prefix":["/bin/sh"],"decision":"prompt"}]}}),notifications:Vec::new(),denied_commands:Vec::new(),bound_thread:None,pending:std::collections::HashMap::new()};
    if lifecycle==Some("running-handler-interrupt") {host.policy["execution"]["command_rules"]=json!([{"prefix":["/bin/sh"],"decision":"prompt"}]);}
    assert!(private_rpc(&mut server,&mut host,"inquello/session/setPrincipal",json!({"principalId":ALICE})).await.get("rpcError").is_none());
    assert_eq!(private_rpc(&mut server,&mut host,"inquello/tasks/bootstrap",json!({"workspaceId":WORKSPACE,"isolatedRoot":directory.path()})).await["accepted"],true);
    assert!(private_rpc(&mut server,&mut host,"inquello/routes/configure",json!({"operationId":uuid::Uuid::new_v4().to_string(),"expectedRevision":0,
        "configuration":{"routeId":"claude-api-key","deployment":"anthropic-direct","model":"claude-sonnet-5-5","apiVersion":"2026-10-21","accountRef":ALICE,"region":null}})).await.get("rpcError").is_none());
    let fixture=tls_fixture(match lifecycle {Some("failure-before-sampling")=>vec![],Some("interrupt-between-attempts")=>vec![retained_tool_stream()],Some("running-handler-interrupt"|"running-authority-revoke")=>vec![retained_running_tool_stream()],_=>vec![retained_tool_stream(),audit_text_stream()]}).await;
    assert_eq!(private_rpc(&mut server,&mut host,"inquello/fixture/taskTransport",json!({"workspaceId":WORKSPACE,"configurationRevision":1,"endpoint":fixture.endpoint,"certificate":fixture.cert,"failBeforeSampling":lifecycle==Some("failure-before-sampling")})).await["accepted"],true);
    let policy=host.policy.clone();
    assert_eq!(private_rpc(&mut server,&mut host,"inquello/tasks/preflight",json!({"workspaceId":WORKSPACE,"routeId":"claude-api-key","configurationRevision":1,"workspacePolicy":policy})).await["available"],true);
    assert!(fixture.requests.lock().await.is_empty(),"read-only preflight performs no provider warmup");
    let tree=private_rpc(&mut server,&mut host,"inquello/workspace/tree",json!({"workspaceId":WORKSPACE})).await;
    assert_eq!(tree["tasks"].as_array().expect("private tree").len(),0,"preflight creates no Task");
    let request="Reconcile duplicate invoices and missing approvals; cite rows, not fraud.\nR01 | V1 | INV-100 | 2026-09-01 | PO-1 | 12500 | APR-1\nR02 | V2 | INV-200 | 2026-09-02 | PO-2 | 22500 | missing\nR03 | V1 | INV-100 | 2026-09-01 | PO-1 | 12500 | APR-1\nApproval is required above 15000.";
    let operation=uuid::Uuid::new_v4().to_string();
    let command=json!({"operationId":operation,"workspaceId":WORKSPACE,"engagementId":null,"folderId":null,"request":request,"routeId":"claude-api-key","configurationRevision":1,"reasoning":"default","speed":"default","workspacePolicy":policy});
    // Consume but deliberately ignore the start acknowledgement. Reconcile is
    // the only next application action, as after a lost desktop acknowledgement.
    let start_id=server.send_request("inquello/tasks/start",Some(command.clone())).await.expect("submit real start");
    let _lost_ack=private_response(&mut server,&mut host,start_id).await;
    let deadline=tokio::time::Instant::now()+Duration::from_secs(30);
    let mut interrupted_running=false;
    let accepted=loop {
        assert!(tokio::time::Instant::now()<deadline,"retained turn must reach terminal state");
        let status=private_rpc(&mut server,&mut host,"inquello/tasks/reconcile",json!({"operationId":operation})).await;
        assert!(status.get("rpcError").is_none(),"reconcile: {status}");
        if matches!(lifecycle,Some("running-handler-interrupt"|"running-authority-revoke")) && !interrupted_running {
            if let Some(task)=status["taskId"].as_str() {
                if directory.path().join("tasks").join(task).join("output/started.txt").exists() {
                    if lifecycle==Some("running-authority-revoke") {
                        let revoked=private_rpc(&mut server,&mut host,"inquello/session/setPrincipal",json!({"principalId":"22222222-2222-4222-8222-222222222222"})).await;
                        assert!(revoked.get("rpcError").is_none());
                        let stale=private_rpc(&mut server,&mut host,"thread/read",json!({"threadId":status["threadId"],"includeTurns":true})).await;
                        assert!(stale.get("rpcError").is_some(),"new principal cannot disclose old private work");
                        tokio::time::sleep(Duration::from_secs(6)).await;
                        assert!(!directory.path().join("tasks").join(task).join("output/late.txt").exists(),"authority cancellation reaps the actual one-shot process");
                        assert_eq!(host.denied_commands.len(),1,"only one consumed native permission");
                        assert_eq!(fixture.requests.lock().await.len(),1,"no continuation or automatic retry after revocation");
                        assert!(!pre_hook_sentinel.exists() && !post_hook_sentinel.exists());
                        use inquello_domain::tasks::TaskRunStore;
                        let store=inquello_adapters::SqliteWorkingStore::open(&database,&[]).await.unwrap();
                        let binding=store.find_task_run(inquello_domain::organise::PrincipalId::parse(ALICE).unwrap(),&operation).await.unwrap().unwrap();
                        assert!(matches!(binding.status,inquello_domain::tasks::TaskRunStatus::Failed|inquello_domain::tasks::TaskRunStatus::Cancelled),"real retained lifecycle terminates revoked work");
                        fixture.server.await.expect("one bounded loopback request");
                        server.shutdown_gracefully().await.expect("reaped child");
                        return;
                    }
                    let started=host.notifications.iter().find(|n|n["method"]=="turn/started").expect("real turn started");
                    let interrupt=json!({"threadId":status["threadId"],"turnId":started["params"]["turn"]["id"]});
                    let response=private_rpc(&mut server,&mut host,"turn/interrupt",interrupt).await;
                    assert!(response.get("rpcError").is_none());interrupted_running=true;
                }
            }
        }
        if lifecycle.is_some() && matches!(status["status"].as_str(),Some("failed"|"cancelled")) {break status;}
        if status["status"]=="completed" {assert!(lifecycle.is_none(),"failure/cancellation cannot invent completion");break status;}
        assert!(!matches!(status["status"].as_str(),Some("failed"|"uncertain"|"cancelled")),"retained turn failed: {status}");
        tokio::time::sleep(Duration::from_millis(30)).await;
    };
    assert_eq!(accepted["accepted"],true);assert_eq!(accepted["request"],request);
    let task=accepted["taskId"].as_str().expect("private Task");let thread=accepted["threadId"].as_str().expect("retained native thread");
    if let Some(case)=lifecycle {
        let retained=private_rpc(&mut server,&mut host,"thread/read",json!({"threadId":thread,"includeTurns":true})).await;
        let turns=retained["thread"]["turns"].as_array().expect("real retained turn history");assert_eq!(turns.len(),1);
        let turn=turns[0]["id"].as_str().expect("real turn identity");
        assert!(host.notifications.iter().any(|n|n["method"]=="turn/started"&&n["params"]["threadId"]==thread&&n["params"]["turn"]["id"]==turn));
        // Read durable native binding, not just the host acknowledgment projection.
        let persisted=inquello_adapters::SqliteWorkingStore::open(&database,&[]).await.expect("private journal");
        use inquello_domain::tasks::TaskRunStore;
        let binding=persisted.find_task_run(inquello_domain::organise::PrincipalId::parse(ALICE).unwrap(),&operation).await.unwrap().unwrap();
        assert_eq!(binding.turn_id.as_deref(),Some(turn));assert_eq!(binding.thread_id.as_deref(),Some(thread));
        assert_eq!(binding.status,if case=="failure-before-sampling" {inquello_domain::tasks::TaskRunStatus::Failed}else{inquello_domain::tasks::TaskRunStatus::Cancelled});
        let usage=private_rpc(&mut server,&mut host,"inquello/usage/read",json!({"taskId":task})).await;
        let attempts=usage["usage"]["attempts"].as_array().expect("native attempts");
        assert_eq!(attempts.iter().filter(|a|a["snapshot"]["operation_kind"]=="human-requested-model").count(),if case=="failure-before-sampling" {0}else{1});
        assert!(attempts.iter().all(|a|a["ended_at_ms"].is_number()),"all actual attempts finalized");
        let duplicate=private_rpc(&mut server,&mut host,"inquello/tasks/start",command).await;
        assert_eq!(duplicate["taskId"],task);assert_eq!(duplicate["status"],accepted["status"]);
        assert_eq!(fixture.requests.lock().await.len(),if case=="failure-before-sampling" {0}else{1});
        assert!(!directory.path().join("tasks").join(task).join("output/denied.txt").exists());
        if case=="running-handler-interrupt" {
            assert!(interrupted_running,"the actual allowed handler started before cancellation");
            tokio::time::sleep(Duration::from_secs(6)).await;
            assert!(!directory.path().join("tasks").join(task).join("output/late.txt").exists(),"cancelled process must not continue with later effects");
        }
        fixture.server.await.expect("bounded loopback fixture");
        server.shutdown_gracefully().await.expect("shutdown");return;
    }
    assert_ne!(task,thread);assert_eq!(host.bound_thread.as_deref(),Some(thread));
    assert_eq!(host.denied_commands.len(),1,"model action used the production permission route");
    assert_eq!(directory.path().join("tasks").join(task).join("output/denied.txt").exists(),allow_once,"only a consumed one-use allowance executes the bounded action");
    assert_eq!(host.denied_commands[0], vec!["/bin/sh".to_string(),"-c".to_string(),"printf 'approved\\n' >> output/denied.txt".to_string()], "permission names the actual final argv");
    if allow_once { assert_eq!(std::fs::read_to_string(directory.path().join("tasks").join(task).join("output/denied.txt")).unwrap(), "approved\n", "exactly one command effect"); }
    assert!(!pre_hook_sentinel.exists(),"configured trusted PreToolUse hook must not execute for a private Task");
    assert!(!post_hook_sentinel.exists(),"configured trusted PostToolUse hook must not execute for a private Task");
    let tree=private_rpc(&mut server,&mut host,"inquello/workspace/tree",json!({"workspaceId":WORKSPACE})).await;
    assert_eq!(tree["tasks"].as_array().expect("private tree").len(),1,"exactly one durable private Task");
    assert!(!directory.path().join("tasks").join("escape.txt").exists(),"denied model action cannot escape");
    let duplicate=private_rpc(&mut server,&mut host,"inquello/tasks/start",command.clone()).await;
    assert_eq!(duplicate["taskId"],task);assert_eq!(duplicate["threadId"],thread);assert_eq!(duplicate["runId"],accepted["runId"]);
    let mut changed=command;changed["request"]=json!("changed request must conflict");
    let conflict=private_rpc(&mut server,&mut host,"inquello/tasks/start",changed).await;
    assert!(conflict.get("rpcError").is_some(),"operation reuse with changed content must conflict");
    let retained=private_rpc(&mut server,&mut host,"thread/read",json!({"threadId":thread,"includeTurns":true})).await;
    assert!(retained.get("rpcError").is_none(),"actual retained read: {retained}");
    assert_eq!(retained["thread"]["id"],thread);
    let turns=retained["thread"]["turns"].as_array().expect("real retained turn history");
    assert_eq!(turns.len(),1,"one idle-only turn, never a duplicate or steering operation");
    let turn_id=turns[0]["id"].as_str().expect("actual retained turn identity");
    assert!(!turn_id.is_empty());
    let retained_json=retained.to_string();assert!(retained_json.contains("INV-100"));assert!(retained_json.contains("R01/R03"));
    let usage=private_rpc(&mut server,&mut host,"inquello/usage/read",json!({"taskId":task})).await;
    let attempts=usage["usage"]["attempts"].as_array().expect("native attempt ledger");
    assert_eq!(attempts.iter().filter(|a|a["snapshot"]["operation_kind"]=="human-requested-model").count(),2);
    assert_eq!(attempts.iter().filter(|a|a["snapshot"]["operation_kind"]=="local-tool").count(),usize::from(allow_once));
    assert!(attempts.iter().all(|a|a["snapshot"]["task_id"]==task&&a["snapshot"]["run_id"]==accepted["runId"]));
    assert!(!usage.to_string().contains("INV-100"),"canonical request never leaks into usage");
    fixture.server.await.expect("exactly two loopback requests, no retry");
    let requests=fixture.requests.lock().await;assert_eq!(requests.len(),2,"duplicate/lost acknowledgement never sampled another turn");
    let tools=requests[0]["tools"].as_array().expect("actual advertised tools");
    let exec=tools.iter().find(|tool|tool["name"]=="exec_command").expect("actual pinned command handler advertised");
    assert_eq!(exec["input_schema"]["properties"]["cmd"]["type"],"string");
    assert!(tools.iter().all(|tool|tool["name"]!="shell" && tool["name"]!="write_stdin"));
    assert!(requests[0]["messages"].to_string().contains("INV-100"));
    assert!(requests[1]["messages"].to_string().contains("tool_result"),"real denied tool output continued through retained history");
    assert_eq!(host.notifications.iter().filter(|n|n["method"]=="turn/started"&&n.to_string().contains(thread)&&n.to_string().contains(turn_id)).count(),1,"one actual native turn identity notification");
    server.shutdown_gracefully().await.expect("shutdown");
}
