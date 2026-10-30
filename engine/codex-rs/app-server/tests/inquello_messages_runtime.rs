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
