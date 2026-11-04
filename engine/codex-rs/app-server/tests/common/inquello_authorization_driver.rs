//! Authored real-child fixtures, not production evidence. Both enabled adapters
//! use ordinary Task APIs and the retained sandbox. No paid inference or keys.

#![allow(clippy::expect_used, clippy::unwrap_used)]
use app_test_support::TestAppServer;
use serde_json::{Value, json};
use std::{sync::Arc, time::Duration};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::{Mutex, Notify};
use tokio_rustls::rustls;
#[path = "inquello_private_host.rs"]
mod private_host;
use private_host::*;
#[path = "inquello_guest_observer.rs"]
mod guest_observer;
const ALICE: &str = "11111111-1111-4111-8111-111111111111";
const BOB: &str = "22222222-2222-4222-8222-222222222222";
const COMPANY_A: &str = "5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e";
const COMPANY_B: &str = "6d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e";
const LATE: &str = "INV-104 duplicated: potential K12,480; INV-105 distinct. Authorization fixture output, not professional approval. Vendor **evidence** required.";
fn event(kind: &str, value: Value) -> String {
    format!("event: {kind}\ndata: {value}\n\n")
}
const FOLLOWUP_REQUEST: &str = "Explain why the earlier finding still needs vendor evidence.";
const FOLLOWUP_ANSWER: &str = "The earlier finding remains an unchecked candidate; vendor evidence is needed before any conclusion.";

fn provider_accept_budget(scenario: &str, index: usize) -> Duration {
    let after_resume = match scenario {
        "lifecycle-completed-followup" | "lifecycle-progress-continuity" => index == 2,
        "lifecycle-bundled-text-followup"
        | "lifecycle-stop-resume"
        | "lifecycle-restart"
        | "lifecycle-crash"
        | "lifecycle-revoke-during-resume"
        | "lifecycle-stop-pending-steer"
        | "lifecycle-stop-inflight-steer"
        | "lifecycle-stop-provider-unavailable"
        | "lifecycle-warm-policy-change" => index == 1,
        _ => false,
    };
    if index == 0 || after_resume {
        PRIVATE_ADMISSION_BUDGET
    } else {
        Duration::from_secs(45)
    }
}

fn streams(route: &str, scenario: &str) -> Vec<String> {
    if scenario == "lifecycle-bundled-text-followup" {
        assert_eq!(route, "codex-responses");
        let text = |id: &str, answer: &str| {
            event(
                "response.created",
                json!({"type":"response.created","response":{"id":id,"status":"in_progress"}}),
            ) + &event(
                "response.output_item.done",
                json!({"type":"response.output_item.done","output_index":0,"item":{"type":"message","id":format!("msg_{id}"),"role":"assistant","status":"completed","content":[{"type":"output_text","text":answer,"annotations":[]}]}}),
            ) + &event(
                "response.completed",
                json!({"type":"response.completed","response":{"id":id,"status":"completed","output":[],"usage":{"input_tokens":24,"output_tokens":12,"total_tokens":36}}}),
            )
        };
        return vec![
            text("resp_bundled_initial", LATE),
            text("resp_bundled_followup", FOLLOWUP_ANSWER),
        ];
    }
    if scenario == "lifecycle-completed-followup" {
        // The first two responses genuinely finish the original tool-using turn.
        // Only the explicit follow-up may request this third, text-only response.
        let mut responses = streams(route, "lifecycle-stop-resume");
        let answer = if route == "codex-responses" {
            event(
                "response.created",
                json!({"type":"response.created","response":{"id":"resp_followup","status":"in_progress"}}),
            ) + &event(
                "response.output_item.done",
                json!({"type":"response.output_item.done","output_index":0,"item":{"type":"message","id":"msg_followup","role":"assistant","status":"completed","content":[{"type":"output_text","text":FOLLOWUP_ANSWER,"annotations":[]}]}}),
            ) + &event(
                "response.completed",
                json!({"type":"response.completed","response":{"id":"resp_followup","status":"completed","output":[],"usage":{"input_tokens":24,"output_tokens":12,"total_tokens":36}}}),
            )
        } else {
            event(
                "message_start",
                json!({"type":"message_start","message":{"id":"msg_followup","role":"assistant","model":"claude-sonnet-5-5","content":[],"usage":{"input_tokens":24}}}),
            ) + &event(
                "content_block_start",
                json!({"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}),
            ) + &event(
                "content_block_delta",
                json!({"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":FOLLOWUP_ANSWER}}),
            ) + &event(
                "content_block_stop",
                json!({"type":"content_block_stop","index":0}),
            ) + &event(
                "message_delta",
                json!({"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":12}}),
            ) + &event("message_stop", json!({"type":"message_stop"}))
        };
        responses.push(answer);
        return responses;
    }
    let waiting = scenario == "revoke-running-tool" || scenario.starts_with("lifecycle-");
    let command = if waiting {
        "printf '%s' \"$$\" > output/pid.txt; readlink /proc/self/ns/pid > output/pid-namespace.txt; printf started > output/started.txt; n=0; while [ ! -f output/release.txt ] && [ \"$n\" -lt 300 ]; do sleep 0.1; n=$((n+1)); done; printf late > output/late.txt"
    } else {
        "printf permitted > output/authorized.txt"
    };
    let arguments = json!({"cmd":command,"shell":fixture_shell(),"timeout_ms":120000}).to_string();
    if matches!(
        scenario,
        "lifecycle-progress-continuity" | "lifecycle-progress-cache"
    ) {
        let initial = json!({"version":1,"plan":[],"results":[
            {"id":"duplicates","kind":"observation","text":"Two candidate invoice pairs","evidenceIds":if scenario=="lifecycle-progress-cache" {vec!["call_authorized"]}else{vec![]},"revision":1,"changeReason":"Initial invoice comparison"},
            {"id":"unaffected","kind":"gap","text":"Approval remains missing","evidenceIds":[],"revision":1}]});
        let revised = json!({"version":1,"plan":[],"results":[
            {"id":"duplicates","kind":"observation","text":"One vendor and invoice pair","evidenceIds":[],"revision":2,"changeReason":"Exclude cancelled invoices"}]});
        if route == "codex-responses" {
            let response = |id: &str, items: Vec<Value>| {
                let mut stream = event(
                    "response.created",
                    json!({"type":"response.created","response":{"id":id,"status":"in_progress"}}),
                );
                for (index, item) in items.into_iter().enumerate() {
                    stream += &event(
                        "response.output_item.done",
                        json!({"type":"response.output_item.done","output_index":index,"item":item}),
                    );
                }
                stream
                    + &event(
                        "response.completed",
                        json!({"type":"response.completed","response":{"id":id,"status":"completed","end_turn":id == "resp_final","output":[],"usage":{"input_tokens":12,"output_tokens":8,"total_tokens":20}}}),
                    )
            };
            let call = |id: &str, name: &str, args: String| json!({"type":"function_call","id":format!("fc_{id}"),"call_id":id,"name":name,"arguments":args});
            if scenario == "lifecycle-progress-cache" {
                return vec![
                    response(
                        "resp_initial",
                        vec![
                            call("call_authorized", "exec_command", arguments),
                            call("publish_initial", "inquello_progress", initial.to_string()),
                        ],
                    ),
                    response(
                        "resp_revised",
                        vec![call(
                            "publish_revised",
                            "inquello_progress",
                            revised.to_string(),
                        )],
                    ),
                    response(
                        "resp_final",
                        vec![
                            json!({"type":"message","id":"msg_final","role":"assistant","status":"completed","content":[{"type":"output_text","text":LATE,"annotations":[]}]}),
                        ],
                    ),
                ];
            }
            return vec![
                response(
                    "resp_initial",
                    vec![call(
                        "publish_initial",
                        "inquello_progress",
                        initial.to_string(),
                    )],
                ),
                response(
                    "resp_tool",
                    vec![call("call_authorized", "exec_command", arguments)],
                ),
                response(
                    "resp_revised",
                    vec![call(
                        "publish_revised",
                        "inquello_progress",
                        revised.to_string(),
                    )],
                ),
                response(
                    "resp_final",
                    vec![
                        json!({"type":"message","id":"msg_final","role":"assistant","status":"completed","content":[{"type":"output_text","text":LATE,"annotations":[]}]}),
                    ],
                ),
            ];
        }
        let response = |id: &str, blocks: Vec<Value>, reason: &str| {
            let mut stream = event(
                "message_start",
                json!({"type":"message_start","message":{"id":id,"role":"assistant","model":"claude-sonnet-5-5","content":[],"usage":{"input_tokens":12}}}),
            );
            for (index, block) in blocks.into_iter().enumerate() {
                stream += &event(
                    "content_block_start",
                    json!({"type":"content_block_start","index":index,"content_block":block}),
                );
                stream += &event(
                    "content_block_stop",
                    json!({"type":"content_block_stop","index":index}),
                );
            }
            stream
                + &event(
                    "message_delta",
                    json!({"type":"message_delta","delta":{"stop_reason":reason},"usage":{"output_tokens":8}}),
                )
                + &event("message_stop", json!({"type":"message_stop"}))
        };
        if scenario == "lifecycle-progress-cache" {
            return vec![
                response(
                    "msg_initial",
                    vec![
                        json!({"type":"tool_use","id":"call_authorized","name":"exec_command","input":serde_json::from_str::<Value>(&arguments).unwrap()}),
                        json!({"type":"tool_use","id":"publish_initial","name":"inquello_progress","input":initial}),
                    ],
                    "tool_use",
                ),
                response(
                    "msg_revised",
                    vec![
                        json!({"type":"tool_use","id":"publish_revised","name":"inquello_progress","input":revised}),
                    ],
                    "tool_use",
                ),
                response(
                    "msg_final",
                    vec![json!({"type":"text","text":LATE})],
                    "end_turn",
                ),
            ];
        }
        return vec![
            response(
                "msg_initial",
                vec![
                    json!({"type":"tool_use","id":"publish_initial","name":"inquello_progress","input":initial}),
                ],
                "tool_use",
            ),
            response(
                "msg_tool",
                vec![
                    json!({"type":"tool_use","id":"call_authorized","name":"exec_command","input":serde_json::from_str::<Value>(&arguments).unwrap()}),
                ],
                "tool_use",
            ),
            response(
                "msg_revised",
                vec![
                    json!({"type":"tool_use","id":"publish_revised","name":"inquello_progress","input":revised}),
                ],
                "tool_use",
            ),
            response(
                "msg_final",
                vec![json!({"type":"text","text":LATE})],
                "end_turn",
            ),
        ];
    }
    if route == "codex-responses" {
        let start = |id: &str| {
            event(
                "response.created",
                json!({"type":"response.created","response":{"id":id,"status":"in_progress"}}),
            )
        };
        let done = |id: &str| {
            event(
                "response.completed",
                json!({"type":"response.completed","response":{"id":id,"status":"completed","end_turn":id == "resp_final","output":[],"usage":{"input_tokens":12,"output_tokens":8,"total_tokens":20}}}),
            )
        };
        vec![
            start("resp_tool")
                + &event(
                    "response.output_item.done",
                    json!({"type":"response.output_item.done","output_index":0,"item":{"type":"function_call","id":"fc_authorized","call_id":"call_authorized","name":"exec_command","arguments":arguments}}),
                )
                + &done("resp_tool"),
            start("resp_final")
                + &event(
                    "response.output_item.done",
                    json!({"type":"response.output_item.done","output_index":0,"item":{"type":"message","id":"msg_final","role":"assistant","status":"completed","content":[{"type":"output_text","text":LATE,"annotations":[]}]}}),
                )
                + &done("resp_final"),
        ]
    } else {
        let start = |id: &str| {
            event(
                "message_start",
                json!({"type":"message_start","message":{"id":id,"role":"assistant","model":"claude-sonnet-5-5","content":[],"usage":{"input_tokens":12}}}),
            )
        };
        let done = |reason: &str| {
            event(
                "message_delta",
                json!({"type":"message_delta","delta":{"stop_reason":reason},"usage":{"output_tokens":8}}),
            ) + &event("message_stop", json!({"type":"message_stop"}))
        };
        vec![
            start("msg_tool")
                + &event(
                    "content_block_start",
                    json!({"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"call_authorized","name":"exec_command","input":{}}}),
                )
                + &event(
                    "content_block_delta",
                    json!({"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":arguments}}),
                )
                + &event(
                    "content_block_stop",
                    json!({"type":"content_block_stop","index":0}),
                )
                + &done("tool_use"),
            start("msg_final")
                + &event(
                    "content_block_start",
                    json!({"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}),
                )
                + &event(
                    "content_block_delta",
                    json!({"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":LATE}}),
                )
                + &event(
                    "content_block_stop",
                    json!({"type":"content_block_stop","index":0}),
                )
                + &done("end_turn"),
        ]
    }
}
struct Fixture {
    endpoint: String,
    certificate: Vec<u8>,
    requests: Arc<Mutex<Vec<Value>>>,
    release: Arc<Notify>,
    stop: tokio::sync::oneshot::Sender<()>,
    task: tokio::task::JoinHandle<()>,
}
async fn fixture(
    route: &'static str,
    scenario: &'static str,
    expected_model: &'static str,
) -> Fixture {
    let hold_last = matches!(scenario, "revoke-model" | "lifecycle-revoke-during-resume");
    let count = if matches!(
        scenario,
        "lifecycle-progress-cache" | "lifecycle-completed-followup"
    ) {
        3
    } else if scenario == "lifecycle-progress-continuity" {
        4
    } else if scenario == "deny-before-dispatch" {
        0
    } else if matches!(
        scenario,
        "revoke-pending-permission"
            | "revoke-running-tool"
            | "lifecycle-revoke-before-resume"
            | "lifecycle-missing-linkage"
            | "lifecycle-peer-private"
            | "lifecycle-cross-company"
            | "lifecycle-unknown-turn"
            | "lifecycle-source-reference"
    ) {
        1
    } else {
        2
    };
    let certified = rcgen::generate_simple_self_signed(vec!["127.0.0.1".into()]).unwrap();
    let certificate = certified.cert.der().to_vec();
    let key = rustls::pki_types::PrivatePkcs8KeyDer::from(certified.signing_key.serialize_der());
    let config = rustls::ServerConfig::builder_with_provider(Arc::new(
        rustls::crypto::aws_lc_rs::default_provider(),
    ))
    .with_safe_default_protocol_versions()
    .unwrap()
    .with_no_client_auth()
    .with_single_cert(vec![certified.cert.der().clone()], key.into())
    .unwrap();
    let acceptor = tokio_rustls::TlsAcceptor::from(Arc::new(config));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let path = if route == "codex-responses" {
        "responses"
    } else {
        "messages"
    };
    let endpoint = format!(
        "https://127.0.0.1:{}/v1/{path}",
        listener.local_addr().unwrap().port()
    );
    let requests = Arc::new(Mutex::new(Vec::new()));
    let captured = requests.clone();
    let release = Arc::new(Notify::new());
    let released = release.clone();
    let (stop, stopped) = tokio::sync::oneshot::channel();
    let task = tokio::spawn(async move {
        for (index, response) in streams(route, scenario).into_iter().take(count).enumerate() {
            let (socket, _) =
                tokio::time::timeout(provider_accept_budget(scenario, index), listener.accept())
                    .await
                    .expect("actual provider request")
                    .unwrap();
            let mut socket = acceptor.accept(socket).await.unwrap();
            let mut bytes = Vec::new();
            loop {
                let mut chunk = [0; 8192];
                let n = tokio::time::timeout(Duration::from_secs(30), socket.read(&mut chunk))
                    .await
                    .unwrap()
                    .unwrap();
                assert!(n > 0);
                bytes.extend_from_slice(&chunk[..n]);
                assert!(bytes.len() < 1_048_576);
                if let Some(end) = bytes.windows(4).position(|w| w == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&bytes[..end]).to_ascii_lowercase();
                    assert!(headers.starts_with(&format!("post /v1/{path} ")));
                    assert!(
                        !headers.contains("authorization:"),
                        "no inherited or paid credential in fixture"
                    );
                    let length: usize = headers
                        .lines()
                        .find_map(|l| l.strip_prefix("content-length: "))
                        .unwrap()
                        .parse()
                        .unwrap();
                    if bytes.len() >= end + 4 + length {
                        if route == "claude-api-key" {
                            assert!(headers.contains("x-api-key: sk-ant-synthetic-fixture-only"));
                        }
                        let body: Value =
                            serde_json::from_slice(&bytes[end + 4..end + 4 + length]).unwrap();
                        assert_eq!(
                            body["model"].as_str(),
                            Some(expected_model),
                            "every actual pinned-loopback request must retain the exact configured model identifier"
                        );
                        if scenario == "lifecycle-progress-cache" && route == "claude-api-key" {
                            assert_eq!(
                                body["tool_choice"]["disable_parallel_tool_use"], false,
                                "fixture requires actual supported parallel-call binding"
                            );
                        }
                        assert!(!body.to_string().contains("sk-ant-"));
                        if route == "codex-responses" && expected_model == "gpt-6.1-terra" {
                            let namespaces: Vec<Value> = body["input"].as_array().unwrap()
                                .iter().filter(|item| item["type"] == "additional_tools")
                                .flat_map(|item| item["tools"].as_array().into_iter().flatten())
                                .map(|namespace| json!({"namespace": namespace["name"], "functions": namespace["tools"].as_array().map(|functions| functions.iter().map(|function| function["name"].clone()).collect::<Vec<_>>())}))
                                .collect();
                            eprintln!(
                                "bundled fixture request {index} declared tool names: {namespaces:?}; response is synthetic plain exec_command without namespace for tool turn"
                            );
                        }
                        captured.lock().await.push(body);
                        break;
                    }
                }
            }
            if (hold_last && index == 1)
                || (scenario == "lifecycle-progress-cache" && matches!(index, 1 | 2))
            {
                tokio::time::timeout(Duration::from_secs(45), released.notified())
                    .await
                    .expect("explicit fixture observation boundary before provider output");
            }
            let result=socket.write_all(format!("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{response}",response.len()).as_bytes()).await;
            if !hold_last || index != 1 {
                result.expect("permitted fixture response");
            }
            let _ = socket.shutdown().await;
        }
        tokio::select! {biased;
            unexpected=listener.accept()=>panic!("unexpected retry/fallback request: {unexpected:?}"),
            stopped=stopped=>stopped.expect("explicit replay observation end"),
            _=tokio::time::sleep(Duration::from_secs(60))=>panic!("fixture observer not stopped"),
        }
    });
    Fixture {
        endpoint,
        certificate,
        requests,
        release,
        stop,
        task,
    }
}
pub(super) struct ServiceFixture {
    pub(super) principal: String,
    pub(super) workspace: String,
    pub(super) policy: Value,
    pub(super) authority: private_host::AuthorityCallback,
    pub(super) revoke: private_host::RevokeCallback,
}
// Linux fixture: prove the original shell, not only its cancellation token, stopped.
// Unknown proc errors fail the test. Starttime prevents PID reuse from confusing identity.
#[cfg(target_os = "linux")]
fn shell_process(pid: u32) -> Option<(String, String)> {
    let value = match std::fs::read_to_string(format!("/proc/{pid}/stat")) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return None,
        Err(error) => panic!("cannot observe fixture shell termination: {error}"),
    };
    let (_, fields) = value
        .rsplit_once(')')
        .expect("Linux proc stat command delimiter");
    let fields: Vec<_> = fields.split_whitespace().collect();
    Some((
        fields.first().expect("process state").to_string(),
        fields.get(19).expect("process starttime").to_string(),
    ))
}
// Bounded fixture Tasks use the actual Linux executor on Windows too.
//
// On Linux the runtime keeps only the shell type from the model's `shell` and runs the
// `sh` it discovers on `PATH` (upstream `get_shell_by_model_provided_path`), for example
// `/usr/bin/sh` where `PATH` lists `/usr/bin` first. Workspace rules and permission argv
// name that executable, so the fixture's rules must name it too.
#[cfg(windows)]
pub(crate) fn fixture_shell() -> String {
    "/bin/bash".into()
}
#[cfg(unix)]
pub(crate) fn fixture_shell() -> String {
    use std::os::unix::fs::PermissionsExt;
    std::env::var_os("PATH")
        .into_iter()
        .flat_map(|path| std::env::split_paths(&path).collect::<Vec<_>>())
        .map(|dir| dir.join("sh"))
        .find(|candidate| {
            std::fs::metadata(candidate)
                .is_ok_and(|meta| meta.is_file() && meta.permissions().mode() & 0o111 != 0)
        })
        .map_or_else(
            || "/bin/sh".into(),
            |found| found.to_string_lossy().into_owned(),
        )
}
#[cfg(windows)]
fn shell_process(pid: u32) -> Option<(String, String)> {
    let value = guest_observer::observe("process", &pid.to_string(), "");
    let value = value.as_str()?;
    let (_, fields) = value.rsplit_once(')').expect("Linux proc stat delimiter");
    let fields: Vec<_> = fields.split_whitespace().collect();
    Some((fields[0].to_string(), fields[19].to_string()))
}
fn cleanup_fixture_shell(pid: u32) {
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("kill")
            .args(["-KILL", &pid.to_string()])
            .status();
    }
    #[cfg(windows)]
    {
        guest_observer::observe("cleanup", &pid.to_string(), "");
    }
}
fn assert_fixture_shell_command(pid: u32) {
    #[cfg(target_os = "linux")]
    {
        let cmdline =
            std::fs::read(format!("/proc/{pid}/cmdline")).expect("host-visible fixture shell");
        assert!(
            String::from_utf8_lossy(&cmdline).contains("output/late.txt"),
            "fixture PID must identify the actual shell"
        );
    }
    #[cfg(windows)]
    {
        let command = guest_observer::observe("command", &pid.to_string(), "");
        assert!(
            command.as_str().unwrap().contains("output/late.txt"),
            "fixture PID identifies actual guest shell"
        );
    }
}
// Inspect actual persisted TurnContext configuration after the native writer
// closes. This is fixture-side filesystem inspection, not a renderer capability.
fn retained_user_messages(home: &std::path::Path, thread: &str) -> Vec<(String, Option<String>)> {
    fn visit(dir: &std::path::Path, files: &mut Vec<std::path::PathBuf>) {
        for entry in std::fs::read_dir(dir).expect("retained fixture history") {
            let entry = entry.unwrap();
            if entry.file_type().unwrap().is_dir() {
                visit(&entry.path(), files);
            } else if entry.path().extension().and_then(|s| s.to_str()) == Some("jsonl") {
                files.push(entry.path());
            }
        }
    }
    let mut files = Vec::new();
    visit(&home.join("sessions"), &mut files);
    assert!(
        !files.is_empty() && files.len() < 100,
        "bounded retained fixture history"
    );
    let mut messages = Vec::new();
    for file in files {
        let text = std::fs::read_to_string(file).expect("closed retained rollout");
        let mut lines = text.lines();
        let first: Value = serde_json::from_str(lines.next().expect("rollout header")).unwrap();
        if first["type"] != "session_meta" || first["payload"]["id"] != thread {
            continue;
        }
        for line in lines.filter(|line| !line.is_empty()) {
            let record = codex_rollout::parse_rollout_line_bytes(line.as_bytes()).unwrap();
            match record.item {
                codex_rollout::RolloutItem::EventMsg(
                    codex_protocol::protocol::EventMsg::UserMessage(user),
                ) => messages.push((user.message, user.client_id)),
                codex_rollout::RolloutItem::EventMsg(
                    codex_protocol::protocol::EventMsg::ItemCompleted(event),
                ) => {
                    if let codex_protocol::items::TurnItem::UserMessage(user) = event.item {
                        messages.push((user.message(), user.client_id));
                    }
                }
                codex_rollout::RolloutItem::EventMsg(
                    codex_protocol::protocol::EventMsg::ItemStarted(event),
                ) => {
                    if let codex_protocol::items::TurnItem::UserMessage(user) = event.item {
                        messages.push((user.message(), user.client_id));
                    }
                }
                _ => {}
            }
        }
    }
    messages
}

fn retained_sandbox_modes(home: &std::path::Path, thread: &str) -> Vec<(String, String)> {
    fn visit(dir: &std::path::Path, files: &mut Vec<std::path::PathBuf>) {
        if !dir.exists() {
            return;
        }
        for entry in std::fs::read_dir(dir).expect("retained fixture history") {
            let entry = entry.unwrap();
            if entry.file_type().unwrap().is_dir() {
                visit(&entry.path(), files);
            } else {
                files.push(entry.path());
            }
        }
    }
    let mut files = Vec::new();
    visit(&home.join("sessions"), &mut files);
    assert!(files.len() < 100, "bounded isolated fixture history");
    let mut modes = Vec::new();
    for file in files {
        let text = std::fs::read_to_string(file).expect("retained rollout");
        let mut lines = text.lines();
        let first: Value = serde_json::from_str(lines.next().expect("rollout header")).unwrap();
        if first["type"] != "session_meta" || first["payload"]["id"] != thread {
            continue;
        }
        for line in lines {
            let record: Value = serde_json::from_str(line).expect("retained record");
            if record["type"] == "turn_context" {
                modes.push((
                    record["payload"]["turn_id"]
                        .as_str()
                        .expect("runtime turn identity")
                        .into(),
                    record["payload"]["sandbox_policy"]["type"]
                        .as_str()
                        .expect("persisted effective sandbox")
                        .into(),
                ));
            }
        }
    }
    modes
}
async fn wait_progress<F: Fn(&Value) -> bool>(
    server: &mut TestAppServer,
    host: &mut PrivateTaskHost,
    task: &str,
    policy: &Value,
    ready: F,
) -> Value {
    let deadline = tokio::time::Instant::now() + Duration::from_secs(45);
    loop {
        let value = private_rpc(
            server,
            host,
            "inquello/tasks/progress",
            json!({"taskId":task,"workspacePolicy":policy}),
        )
        .await;
        if value.get("rpcError").is_none() && ready(&value) {
            return value;
        }
        assert!(
            tokio::time::Instant::now() < deadline,
            "expected retained endpoint state: {value}"
        );
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
}
pub(super) async fn run(
    route: &'static str,
    scenario: &'static str,
    service: Option<ServiceFixture>,
) {
    let bundled_tools = scenario == "bundled-allowed";
    let scenario = if bundled_tools { "allowed" } else { scenario };
    let bundled_text = scenario == "lifecycle-bundled-text-followup";
    let bundled_catalog = bundled_tools || bundled_text;
    if bundled_catalog {
        assert_eq!(route, "codex-responses");
    }
    let revoke = scenario != "allowed"
        && scenario != "search-stalled-admission"
        && !scenario.starts_with("lifecycle-");
    let principal = service
        .as_ref()
        .map_or(ALICE, |s| s.principal.as_str())
        .to_owned();
    let workspace = service
        .as_ref()
        .map_or(COMPANY_A, |s| s.workspace.as_str())
        .to_owned();
    let directory = tempfile::tempdir().unwrap();
    let mut _guest_scope = guest_observer::FixtureScope::new(directory.path(), &principal);
    let home = directory.path().join("runtime");
    std::fs::create_dir(&home).unwrap();
    std::fs::write(
        directory.path().join(".inquello-fictional-audit-session"),
        b"explicit isolated fixture",
    )
    .unwrap();
    let model = if bundled_catalog {
        // This real-catalog witness is self-contained. Ambient selector options
        // belong to the other isolated scenarios, whose behavior stays intact.
        "gpt-6.1-terra"
    } else if route == "codex-responses" {
        let selection = match std::env::var("INQUELLO_SYNTHETIC_RESPONSES_MODEL") {
            Ok(value) => Some(value),
            Err(std::env::VarError::NotPresent) => None,
            Err(std::env::VarError::NotUnicode(_)) => {
                panic!("synthetic model selector must be Unicode")
            }
        };
        fixture_responses_model(selection.as_deref())
            .expect("allowlisted synthetic model identifier")
    } else {
        "claude-sonnet-5-5"
    };
    let catalog = home.join("models.json");
    let catalog_json = if bundled_catalog {
        let bundled = include_str!("../../../models-manager/models.json");
        let metadata: Value = serde_json::from_str(bundled).unwrap();
        let selected = metadata["models"]
            .as_array()
            .unwrap()
            .iter()
            .find(|entry| entry["slug"] == model)
            .expect("supported bundled model");
        assert_eq!(selected["use_responses_lite"], true);
        assert_eq!(selected["supports_reasoning_effort_updates"], true);
        assert_eq!(selected["default_reasoning_level"], "low");
        bundled.to_string()
    } else {
        json!({"models":[{"slug":model,"display_name":"Authorization fixture","description":"Fixture only","base_instructions":"Synthetic authorization fixture.","default_reasoning_level":null,"supported_reasoning_levels":[],"shell_type":"unified_exec","visibility":"list","supported_in_api":true,"priority":1,"upgrade":null,"model_messages":null,"support_verbosity":false,"default_verbosity":null,"apply_patch_tool_type":null,"truncation_policy":{"mode":"bytes","limit":10000},"supports_image_detail_original":false,"context_window":32000,"auto_compact_token_limit":null,"experimental_supported_tools":[]}]}).to_string()
    };
    std::fs::write(&catalog, catalog_json).unwrap();
    std::fs::write(home.join("config.toml"),format!("model_catalog_json = {}\ncli_auth_credentials_store = \"keyring\"\n[features]\nnetwork_proxy = true\n",serde_json::to_string(&catalog).unwrap())).unwrap();
    let binary = std::env::var_os("INQUELLO_FIXTURE_APP_SERVER_BIN")
        .expect("separately built debug inference-fixtures binary required");
    let database = directory.path().join("working.sqlite");
    let mut server = TestAppServer::builder()
        .with_program(std::path::Path::new(&binary))
        .with_codex_home(&home)
        .without_auto_env()
        .with_env_overrides(&[
            ("INQUELLO_WORKING_STORE", database.to_str()),
            ("OPENAI_API_KEY", None),
            ("ANTHROPIC_API_KEY", None),
        ])
        .build_initialized()
        .await
        .unwrap();
    let mut host = PrivateTaskHost {
        authority_context: json!({}),
        authority_callback: None,
        revoke_callback: service.as_ref().map(|s| s.revoke.clone()),
        authority_available: true,
        workspace_id: workspace.clone(),
        answered_questions: 0,
        allow_once: true,
        lifecycle: Some(scenario),
        policy: json!({"workspaceId":workspace,"policyRevision":1,"authorizationEpoch":1,"execution":{"command_rules":[{"prefix":[fixture_shell()],"decision":"prompt"}]}}),
        notifications: vec![],
        denied_commands: vec![],
        bound_thread: None,
        pending: Default::default(),
    };
    if let Some(service) = &service {
        host.policy = service.policy.clone();
    }
    assert!(
        private_rpc(
            &mut server,
            &mut host,
            "inquello/session/setPrincipal",
            json!({"principalId":principal})
        )
        .await
        .get("rpcError")
        .is_none()
    );
    assert_eq!(
        private_rpc(
            &mut server,
            &mut host,
            "inquello/tasks/bootstrap",
            json!({"workspaceId":workspace,"isolatedRoot":directory.path()})
        )
        .await["accepted"],
        true
    );
    let configuration = json!({"routeId":route,"deployment":if route=="codex-responses"{"openai-api"}else{"anthropic-direct"},"model":model,"apiVersion":if route=="codex-responses"{"responses-v1"}else{"2026-10-21"},"accountRef":principal,"region":null});
    assert!(private_rpc(&mut server,&mut host,"inquello/routes/configure",json!({"operationId":uuid::Uuid::new_v4(),"expectedRevision":0,"configuration":configuration})).await.get("rpcError").is_none());
    let fixture = fixture(route, scenario, model).await;
    assert_eq!(private_rpc(&mut server,&mut host,"inquello/fixture/taskTransport",json!({"workspaceId":workspace,"configurationRevision":1,"routeId":route,"endpoint":fixture.endpoint,"certificate":fixture.certificate,"holdProgressPublication":scenario=="lifecycle-progress-cache"})).await["accepted"],true);
    let policy = host.policy.clone();
    let operation = uuid::Uuid::new_v4().to_string();
    host.authority_context = json!({"configuration":configuration,"operationId":operation});
    let initial_request = if bundled_text {
        "Review fictional procurement: INV-104 K12,480 appears twice; INV-105 is distinct. Explain this fictional candidate duplicate without running tools."
    } else {
        "Review fictional procurement: INV-104 K12,480 appears twice; INV-105 is distinct. Write only the permitted local marker, then report the candidate duplicate."
    };
    let command = json!({"operationId":operation,"workspaceId":workspace,"engagementId":null,"folderId":null,
        "request":initial_request,
        "routeId":route,"configurationRevision":1,"reasoning":"default","speed":"default","workspacePolicy":policy});
    host.authority_callback = service.as_ref().map(|s| s.authority.clone());
    if scenario == "deny-before-dispatch" && service.is_none() {
        host.authority_available = false;
    }
    let mut start = private_rpc(
        &mut server,
        &mut host,
        "inquello/tasks/start",
        command.clone(),
    )
    .await;
    if scenario == "deny-before-dispatch" {
        assert!(
            start.get("rpcError").is_some(),
            "missing approval blocks first dispatch"
        );
        server.shutdown_gracefully().await.unwrap();
        assert!(fixture.requests.lock().await.is_empty());
        fixture.stop.send(()).unwrap();
        fixture.task.await.unwrap();
        return;
    }
    // A fast permission event can precede the start response. If withdrawal
    // fences that response, use only IDs captured from the earlier authorized
    // forThread response; do not require post-withdrawal disclosure to succeed.
    if scenario == "revoke-pending-permission"
        && !host.denied_commands.is_empty()
        && start.get("rpcError").is_some()
    {
        start = json!({"taskId":host.authority_context["taskId"],"runId":host.authority_context["runId"],"threadId":host.authority_context["threadId"]});
    }
    assert!(
        start.get("rpcError").is_none(),
        "normal retained start: {start}"
    );
    assert_ne!(
        start["status"], "setup-failed",
        "retained fixture setup failed: {start}"
    );
    host.authority_context["taskId"] = start["taskId"].clone();
    host.authority_context["runId"] = start["runId"].clone();
    if bundled_text {
        // This witness deliberately requests only text. Bundled tool execution
        // has its own allowed-effect scenario using the same unmodified metadata.
        assert!(service.is_none());
        let task = start["taskId"].as_str().unwrap().to_owned();
        let thread = start["threadId"].as_str().unwrap().to_owned();
        let first = wait_progress(&mut server, &mut host, &task, &policy, |p| {
            p["status"] == "completed"
        })
        .await;
        assert_eq!(first["threadId"], thread);
        assert!(first["items"].to_string().contains(LATE));
        assert_eq!(fixture.requests.lock().await.len(), 1);
        let completed = private_rpc(
            &mut server,
            &mut host,
            "inquello/tasks/forThread",
            json!({"threadId":thread}),
        )
        .await;
        assert_eq!(completed["runId"], first["runId"]);
        assert_eq!(completed["turnId"], first["turnId"]);
        let followup = json!({"operationId":uuid::Uuid::new_v4().to_string(),"taskId":task,"expectedRunId":completed["runId"],"expectedRuntimeId":completed["runtimeId"],"expectedTurnId":completed["turnId"],"request":FOLLOWUP_REQUEST,"workspacePolicy":policy});
        let admitted = private_rpc(
            &mut server,
            &mut host,
            "inquello/tasks/resume",
            followup.clone(),
        )
        .await;
        assert_eq!(admitted["status"], "admitted");
        assert_eq!(admitted["taskId"], task);
        assert_eq!(admitted["threadId"], thread);
        assert_ne!(admitted["runId"], completed["runId"]);
        assert_ne!(admitted["turnId"], completed["turnId"]);
        let replay = private_rpc(&mut server, &mut host, "inquello/tasks/resume", followup).await;
        assert_eq!(replay["runId"], admitted["runId"]);
        assert_eq!(replay["turnId"], admitted["turnId"]);
        let finished = wait_progress(&mut server, &mut host, &task, &policy, |p| {
            p["status"] == "completed" && p["runId"] == admitted["runId"]
        })
        .await;
        assert_eq!(finished["threadId"], thread);
        assert!(finished["items"].to_string().contains(FOLLOWUP_REQUEST));
        assert!(finished["items"].to_string().contains(FOLLOWUP_ANSWER));
        {
            let requests = fixture.requests.lock().await;
            assert_eq!(
                requests.len(),
                2,
                "one initial text turn and one explicit follow-up, without retry/fallback"
            );
            assert!(requests[1].to_string().contains(initial_request));
            assert!(requests[1].to_string().contains(LATE));
            assert!(requests[1].to_string().contains(FOLLOWUP_REQUEST));
            for request in requests.iter() {
                assert_eq!(request["model"], model);
                assert_eq!(request["reasoning"]["effort"], "low");
                assert!(request.get("service_tier").is_none());
                // The native SDK retains its genuine Responses Lite wire prefix.
                // These prompt-only declarations are not retained history items.
                assert!(request.get("tools").is_none_or(Value::is_null));
                let input = request["input"].as_array().unwrap();
                assert!(
                    input
                        .iter()
                        .all(|item| item["type"] != "configuration_update")
                );
                let declarations: Vec<_> = input
                    .iter()
                    .filter(|item| item["type"] == "additional_tools")
                    .collect();
                assert_eq!(declarations.len(), 1);
                assert_eq!(declarations[0]["role"], "developer");
                let namespaces = declarations[0]["tools"].as_array().unwrap();
                assert_eq!(namespaces.len(), 1);
                assert_eq!(namespaces[0]["type"], "namespace");
                assert_eq!(namespaces[0]["name"], "functions");
                let functions = namespaces[0]["tools"].as_array().unwrap();
                assert!(!functions.is_empty() && functions.len() <= 3);
                for function in functions {
                    assert_eq!(function["type"], "function");
                    assert!(matches!(
                        function["name"].as_str(),
                        Some("request_user_input" | "exec_command" | "inquello_progress")
                    ));
                }
            }
        }
        host.authority_available = false;
        let denied = private_rpc(&mut server, &mut host, "inquello/tasks/resume", json!({"operationId":uuid::Uuid::new_v4().to_string(),"taskId":task,"expectedRunId":finished["runId"],"expectedRuntimeId":finished["runtimeId"],"expectedTurnId":finished["turnId"],"request":"A denied additional text follow-up.","workspacePolicy":policy})).await;
        assert!(denied.get("rpcError").is_some());
        assert!(!denied.to_string().contains(FOLLOWUP_ANSWER));
        assert_eq!(fixture.requests.lock().await.len(), 2);
        server.shutdown_gracefully().await.unwrap();
        let rollout = codex_rollout::find_thread_path_by_id_str(&home, &thread, None)
            .await
            .unwrap()
            .expect("owned retained bundled-model history");
        assert!(std::fs::metadata(&rollout).unwrap().len() < 2_097_152);
        let retained = std::fs::read_to_string(rollout).unwrap();
        let mut user = false;
        let mut assistant = false;
        for line in retained.lines() {
            let record: Value = serde_json::from_str(line).unwrap();
            if record["type"] == "response_item" {
                assert!(
                    !matches!(
                        record["payload"]["type"].as_str(),
                        Some("additional_tools" | "configuration_update")
                    ),
                    "unsupported optional modes must not enter retained history"
                );
                user |= record["payload"]["role"] == "user";
                assistant |= record["payload"]["role"] == "assistant";
            }
        }
        assert!(user && assistant, "positive retained conversation control");
        assert!(
            retained.contains(initial_request)
                && retained.contains(FOLLOWUP_REQUEST)
                && retained.contains(FOLLOWUP_ANSWER)
        );
        fixture.stop.send(()).unwrap();
        fixture.task.await.unwrap();
        return;
    }
    if scenario.starts_with("lifecycle-") {
        assert!(
            service.is_none(),
            "Synthetic native route fixture, not organization eligibility proof"
        );
        let task = start["taskId"].as_str().unwrap().to_owned();
        let thread = start["threadId"].as_str().unwrap().to_owned();
        let output = guest_observer::task_output(directory.path(), &task, &principal);
        let deadline = tokio::time::Instant::now() + Duration::from_secs(45);
        while !guest_observer::exists(output.join("started.txt")) {
            assert!(
                tokio::time::Instant::now() < deadline,
                "actual gated local tool must start"
            );
            let observed = private_rpc(
                &mut server,
                &mut host,
                "inquello/tasks/reconcile",
                json!({"operationId":operation}),
            )
            .await;
            assert!(observed.get("rpcError").is_none());
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        let observed = private_rpc(
            &mut server,
            &mut host,
            "inquello/tasks/forThread",
            json!({"threadId":thread}),
        )
        .await;
        assert!(observed["turnId"].as_str().is_some());
        if scenario == "lifecycle-completed-followup" {
            guest_observer::write(output.join("release.txt"), b"finish the original answer")
                .unwrap();
            let first = wait_progress(&mut server, &mut host, &task, &policy, |p| {
                p["status"] == "completed"
            })
            .await;
            assert_eq!(first["runId"], observed["runId"]);
            assert_eq!(first["turnId"], observed["turnId"]);
            assert!(first["items"].to_string().contains(LATE));
            assert_eq!(fixture.requests.lock().await.len(), 2);
            let completed = private_rpc(
                &mut server,
                &mut host,
                "inquello/tasks/forThread",
                json!({"threadId":thread}),
            )
            .await;
            assert_eq!(completed["runId"], first["runId"]);
            assert_eq!(completed["turnId"], first["turnId"]);
            let followup_command = |request: Value| {
                json!({"operationId":uuid::Uuid::new_v4().to_string(),"taskId":task,
                    "expectedRunId":completed["runId"],"expectedRuntimeId":completed["runtimeId"],
                    "expectedTurnId":completed["turnId"],"request":request,"workspacePolicy":policy})
            };
            for request in [Value::Null, json!(""), json!(" \n\t")] {
                let refused = private_rpc(
                    &mut server,
                    &mut host,
                    "inquello/tasks/resume",
                    followup_command(request),
                )
                .await;
                assert!(
                    refused.get("rpcError").is_some(),
                    "completed work requires an explicit nonblank follow-up: {refused}"
                );
                assert_eq!(fixture.requests.lock().await.len(), 2);
            }
            let unchanged = private_rpc(
                &mut server,
                &mut host,
                "inquello/tasks/forThread",
                json!({"threadId":thread}),
            )
            .await;
            assert_eq!(unchanged["runId"], completed["runId"]);
            assert_eq!(unchanged["turnId"], completed["turnId"]);
            assert_eq!(
                fixture.requests.lock().await.len(),
                2,
                "reading or refusing empty follow-up never starts another turn"
            );
            let followup = followup_command(json!(FOLLOWUP_REQUEST));
            let admitted = private_rpc(
                &mut server,
                &mut host,
                "inquello/tasks/resume",
                followup.clone(),
            )
            .await;
            assert_eq!(
                admitted["status"], "admitted",
                "completed follow-up: {admitted}"
            );
            assert_eq!(admitted["taskId"], task);
            assert_eq!(admitted["threadId"], thread);
            assert_ne!(admitted["runId"], completed["runId"]);
            assert!(admitted["turnId"].as_str().is_some());
            assert_ne!(admitted["turnId"], completed["turnId"]);
            let replay = private_rpc(
                &mut server,
                &mut host,
                "inquello/tasks/resume",
                followup.clone(),
            )
            .await;
            assert_eq!(replay["runId"], admitted["runId"]);
            assert_eq!(replay["turnId"], admitted["turnId"]);
            assert_eq!(replay["threadId"], thread);
            let finished = wait_progress(&mut server, &mut host, &task, &policy, |p| {
                p["status"] == "completed" && p["runId"] == admitted["runId"]
            })
            .await;
            assert_eq!(finished["threadId"], thread);
            assert_eq!(finished["turnId"], admitted["turnId"]);
            assert!(finished["items"].to_string().contains(FOLLOWUP_REQUEST));
            assert!(finished["items"].to_string().contains(FOLLOWUP_ANSWER));
            let requests = fixture.requests.lock().await;
            assert_eq!(
                requests.len(),
                3,
                "one explicit new turn, with no replay/fallback"
            );
            let history = requests[2].to_string();
            assert!(history.contains("Review fictional procurement: INV-104"));
            assert!(
                history.contains(LATE),
                "prior answer reaches the real provider binding"
            );
            assert!(history.contains(FOLLOWUP_REQUEST));
            drop(requests);
            assert_eq!(
                guest_observer::read(output.join("late.txt")).unwrap(),
                "late"
            );

            // A later authority withdrawal prevents another explicit follow-up.
            // Keep this after the positive control: restoring authority must not
            // be fabricated merely to make the continued-turn witness succeed.
            host.authority_available = false;
            let denied = private_rpc(
                &mut server,
                &mut host,
                "inquello/tasks/resume",
                json!({"operationId":uuid::Uuid::new_v4().to_string(),"taskId":task,
                    "expectedRunId":finished["runId"],"expectedRuntimeId":finished["runtimeId"],
                    "expectedTurnId":finished["turnId"],"request":"A denied additional follow-up.",
                    "workspacePolicy":policy}),
            )
            .await;
            assert!(denied.get("rpcError").is_some());
            assert!(!denied.to_string().contains(FOLLOWUP_ANSWER));
            assert_eq!(fixture.requests.lock().await.len(), 3);
            server.shutdown_gracefully().await.unwrap();
            fixture.stop.send(()).unwrap();
            fixture.task.await.unwrap();
            return;
        }
        if scenario == "lifecycle-progress-continuity" {
            // The marker proves command admission, not completion of the parallel
            // progress publication. Use the existing bounded readiness helper;
            // require both retained findings while the original run is still live.
            let before = wait_progress(&mut server, &mut host, &task, &policy, |p| {
                p["status"] == "running"
                    && p["results"].as_array().is_some_and(|rows| {
                        rows.iter().any(|r| {
                            r["id"] == "result:unaffected"
                                && r["sourceTurnId"] == observed["turnId"]
                        }) && rows.iter().any(|r| {
                            r["id"] == "result:duplicates"
                                && r["revision"] == 1
                                && r["changeReason"] == "Initial invoice comparison"
                        })
                    })
            })
            .await;
            assert!(
                before.get("rpcError").is_none(),
                "actual pre-Resume endpoint: {before}"
            );
            let rows = before["results"].as_array().unwrap();
            assert!(
                rows.iter()
                    .any(|r| r["id"] == "result:unaffected"
                        && r["sourceTurnId"] == observed["turnId"])
            );
            assert!(rows.iter().any(|r| r["id"] == "result:duplicates"
                && r["revision"] == 1
                && r["changeReason"] == "Initial invoice comparison"));
            assert!(before["resultHistory"].as_array().unwrap().is_empty());
        }
        let command_for = |request: Option<&str>| {
            json!({"operationId":uuid::Uuid::new_v4().to_string(),"taskId":task,
            "expectedRunId":observed["runId"],"expectedRuntimeId":observed["runtimeId"],"expectedTurnId":observed["turnId"],"request":request,"workspacePolicy":policy})
        };
        if scenario == "lifecycle-progress-cache" {
            let initial = wait_progress(&mut server, &mut host, &task, &policy, |p| {
                p["items"].as_array().is_some_and(|items| {
                    items
                        .iter()
                        .any(|item| item["id"] == "call_authorized" && item["status"] == "running")
                }) && p["results"]
                    .as_array()
                    .is_some_and(|rows| rows.iter().any(|row| row["id"] == "result:duplicates"))
            })
            .await;
            let initial_id = initial["resultPage"]["snapshotId"].clone();
            assert!(initial["results"].as_array().unwrap().iter().any(|row| {
                row["id"] == "result:duplicates"
                    && row["evidenceIds"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .any(|id| id == "call_authorized")
            }));
            let items = initial["items"].as_array().unwrap();
            assert!(
                items
                    .iter()
                    .position(|item| item["id"] == "call_authorized")
                    .unwrap()
                    < items
                        .iter()
                        .rposition(|item| item["kind"] == "tool")
                        .unwrap(),
                "cited command is older than the retained publication"
            );
            // The one-shot command remains live while the parallel, non-effect
            // publisher records newer findings. Its later completion must invalidate
            // the snapshot even though the newest publication item has not changed.
            guest_observer::write(
                output.join("release.txt"),
                b"complete original evidence command",
            )
            .unwrap();
            let completed = wait_progress(&mut server, &mut host, &task, &policy, |p| {
                p["items"].as_array().is_some_and(|items| {
                    items.iter().any(|item| {
                        item["id"] == "call_authorized" && item["status"] == "completed"
                    })
                })
            })
            .await;
            assert_eq!(completed["turnId"], observed["turnId"]);
            assert_ne!(
                completed["resultPage"]["snapshotId"], initial_id,
                "older cited evidence completion invalidates the analytical snapshot"
            );
            let stale=private_rpc(&mut server,&mut host,"inquello/tasks/progress",json!({"taskId":task,"workspacePolicy":policy,"resultPage":{"snapshotId":initial_id,"currentOffset":0,"historyOffset":0}})).await;
            assert!(
                stale["rpcError"]["message"]
                    .as_str()
                    .is_some_and(|m| m.contains("Findings or cited evidence changed"))
            );
            fixture.release.notify_one(); // Deliver the next real inquello_progress call.
            let revised = wait_progress(&mut server, &mut host, &task, &policy, |p| {
                p["results"].as_array().is_some_and(|rows| {
                    rows.iter()
                        .any(|row| row["id"] == "result:duplicates" && row["revision"] == 2)
                })
            })
            .await;
            assert_eq!(
                revised["turnId"], observed["turnId"],
                "new publication is in the SAME turn, not Resume"
            );
            assert_ne!(
                revised["resultPage"]["snapshotId"],
                completed["resultPage"]["snapshotId"]
            );
            let stale=private_rpc(&mut server,&mut host,"inquello/tasks/progress",json!({"taskId":task,"workspacePolicy":policy,"resultPage":{"snapshotId":completed["resultPage"]["snapshotId"],"currentOffset":0,"historyOffset":0}})).await;
            assert!(
                stale["rpcError"]["message"]
                    .as_str()
                    .is_some_and(|m| m.contains("Findings or cited evidence changed"))
            );
            fixture.release.notify_one(); // Unrelated final assistant output.
            let ended = wait_progress(&mut server, &mut host, &task, &policy, |p| {
                p["status"] == "completed"
                    && p["items"]
                        .as_array()
                        .is_some_and(|items| items.iter().any(|item| item["text"] == LATE))
            })
            .await;
            assert_eq!(ended["turnId"], observed["turnId"]);
            assert_eq!(
                ended["resultPage"]["snapshotId"], revised["resultPage"]["snapshotId"],
                "unrelated assistant stream/completion preserves page identity"
            );
            assert_eq!(
                fixture.requests.lock().await.len(),
                3,
                "exact controlled parallel command+publication/publication/final sequence"
            );
            server.shutdown_gracefully().await.unwrap();
            fixture.stop.send(()).unwrap();
            fixture.task.await.unwrap();
            return;
        }
        if scenario == "lifecycle-stop-provider-unavailable" {
            // Fault new-inference readiness while the original authorized local
            // effect is genuinely running. Do not revoke cancellation authority
            // or credentials (which could automatically cancel the guard first).
            let pid: u32 = guest_observer::pid(&output);
            let (_, created) = shell_process(pid).expect("original shell before provider outage");
            std::fs::write(
                directory
                    .path()
                    .join(".inquello-fixture-provider-unavailable"),
                b"synthetic new-inference outage",
            )
            .unwrap();
            let refused=private_rpc(&mut server,&mut host,"inquello/tasks/preflight",json!({"workspaceId":workspace,"routeId":route,"configurationRevision":1,"workspacePolicy":policy})).await;
            assert!(
                refused["rpcError"]["message"].as_str().is_some_and(
                    |m| m.contains("Synthetic fixture provider readiness is unavailable")
                ),
                "must reach the real candidate-readiness boundary: {refused}"
            );
            let (state, current) =
                shell_process(pid).expect("readiness refusal must not stand in for Stop");
            assert_eq!(current, created);
            assert!(!matches!(state.as_str(), "Z" | "X"));
            let still_running = private_rpc(
                &mut server,
                &mut host,
                "inquello/tasks/forThread",
                json!({"threadId":thread}),
            )
            .await;
            assert_eq!(still_running["status"], "running");
            assert_eq!(still_running["turnId"], observed["turnId"]);
        }
        let mut timed_out_steer_operation = None;
        if scenario == "lifecycle-stop-inflight-steer" {
            host.authority_context["workingDatabase"] = json!(database);
            host.authority_context["concurrentStop"] = command_for(None);
            host.authority_context["holdSteerAuthority"] = json!(true);
            let guidance = command_for(Some(
                "Exclude cancelled invoices; preserve this draft if admission fails.",
            ));
            let steering_operation = guidance["operationId"].as_str().unwrap().to_owned();
            timed_out_steer_operation = Some(steering_operation.clone());
            let steer = private_rpc(&mut server, &mut host, "inquello/tasks/steer", guidance).await;
            assert!(
                host.authority_context["heldAuthorityRequest"].is_number()
                    || host.authority_context["heldAuthorityRequest"].is_string(),
                "a real writer-held authority request must be withheld"
            );
            assert!(
                steer["rpcError"]["message"]
                    .as_str()
                    .is_some_and(|message| message.contains(
                        "Lifecycle authority timed out before commit; no effect dispatched"
                    )),
                "writer-held admission must reach its exact bounded timeout, never admission: {steer}"
            );
            let reconciled = private_rpc(
                &mut server,
                &mut host,
                "inquello/tasks/lifecycleReconcile",
                json!({"operationId":steering_operation}),
            )
            .await;
            assert!(
                reconciled["rpcError"]["data"]["inquello"]["kind"] == "not_found"
                    || reconciled["status"] == "rejected",
                "timed-out admission leaves no admitted or dispatchable receipt: {reconciled}"
            );
            assert!(
                host.authority_context["concurrentStopId"]
                    .as_i64()
                    .is_some(),
                "Stop was sent while steering authority remained pending"
            );
        }
        let steer_only = matches!(scenario, "lifecycle-steer" | "lifecycle-steer-lost-ack");
        let mut lost_steer_operation = None;
        if steer_only || scenario == "lifecycle-stop-pending-steer" {
            let correction = "Exclude cancelled invoices, reanalyse affected findings and explain the changes; retain unrelated work.";
            let mut wrong = command_for(Some(correction));
            wrong["expectedTurnId"] = json!("ended-turn");
            assert!(
                private_rpc(&mut server, &mut host, "inquello/tasks/steer", wrong)
                    .await
                    .get("rpcError")
                    .is_some()
            );
            let guidance = command_for(Some(correction));
            let admitted = private_rpc(
                &mut server,
                &mut host,
                "inquello/tasks/steer",
                guidance.clone(),
            )
            .await;
            assert_eq!(
                admitted["status"], "admitted",
                "actual same-active-turn steering admission only"
            );
            let replay = private_rpc(
                &mut server,
                &mut host,
                "inquello/tasks/steer",
                guidance.clone(),
            )
            .await;
            assert_eq!(replay["operationId"], admitted["operationId"]);
            if scenario != "lifecycle-steer" {
                use sqlx::Connection;
                let mut db = sqlx::SqliteConnection::connect_with(
                    &sqlx::sqlite::SqliteConnectOptions::new().filename(&database),
                )
                .await
                .unwrap();
                // Fault only the acknowledgement journal, not runtime input or
                // identity. Native admission must be recovered by operation ID.
                let operation = guidance["operationId"].as_str().unwrap().to_owned();
                let changed=sqlx::query("UPDATE task_lifecycle SET receipt=json_set(receipt,'$.status','uncertain') WHERE operation_id=?")
                    .bind(&operation).execute(&mut db).await.unwrap();
                assert_eq!(changed.rows_affected(), 1);
                db.close().await.unwrap();
                lost_steer_operation = Some(operation);
            }
            if steer_only {
                guest_observer::write(
                    output.join("release.txt"),
                    b"release authorized fixture tool",
                )
                .unwrap();
            }
        }
        if steer_only {
            // Continue the same active turn; never substitute Resume/start.
        } else if matches!(scenario, "lifecycle-restart" | "lifecycle-crash") {
            // Actual native process loss followed by explicit retained resume.
            // Neither authored fixture is executed Windows/Electron evidence.
            if scenario == "lifecycle-crash" {
                let pid: u32 = guest_observer::pid(&output);
                let prior = shell_process(pid);
                server.crash_and_wait().await.unwrap();
                // A crashed host does not prove every external effect terminated.
                // Clean any surviving fixture shell without attributing that test
                // cleanup to the application's Stop or recovery semantics.
                if let (Some((_, before)), Some((state, after))) = (prior, shell_process(pid)) {
                    if before == after && !matches!(state.as_str(), "Z" | "X") {
                        cleanup_fixture_shell(pid);
                    }
                }
            } else {
                server.shutdown_gracefully().await.unwrap();
            }
            server = TestAppServer::builder()
                .with_program(std::path::Path::new(&binary))
                .with_codex_home(&home)
                .without_auto_env()
                .with_env_overrides(&[
                    ("INQUELLO_WORKING_STORE", database.to_str()),
                    ("OPENAI_API_KEY", None),
                    ("ANTHROPIC_API_KEY", None),
                ])
                .build_initialized()
                .await
                .unwrap();
            host.pending.clear();
            host.notifications.clear();
            private_rpc(
                &mut server,
                &mut host,
                "inquello/session/setPrincipal",
                json!({"principalId":principal}),
            )
            .await;
            assert_eq!(
                private_rpc(
                    &mut server,
                    &mut host,
                    "inquello/tasks/bootstrap",
                    json!({"workspaceId":workspace,"isolatedRoot":directory.path()})
                )
                .await["accepted"],
                true
            );
            assert_eq!(private_rpc(&mut server,&mut host,"inquello/fixture/taskTransport",json!({"workspaceId":workspace,"configurationRevision":1,"routeId":route,"endpoint":fixture.endpoint,"certificate":fixture.certificate})).await["accepted"],true);
            let retained = private_rpc(
                &mut server,
                &mut host,
                "inquello/tasks/progress",
                json!({"taskId":task,"workspacePolicy":policy}),
            )
            .await;
            // Progress is Task-bound; it exposes no generic replacement-thread API.
            assert!(
                retained.get("rpcError").is_none(),
                "authorized retained progress after runtime loss: {retained}"
            );
            assert!(matches!(
                retained["status"].as_str(),
                Some("cancelled" | "uncertain" | "failed")
            ));
            assert_eq!(
                fixture.requests.lock().await.len(),
                1,
                "restarting never automatically samples"
            );
        } else {
            let pid: u32 = guest_observer::pid(&output);
            let (_, starttime) = shell_process(pid).expect("real local shell before Stop");
            let stop = if scenario == "lifecycle-stop-inflight-steer" {
                host.authority_context["concurrentStop"].clone()
            } else {
                command_for(None)
            };
            // Concurrent clicks share one operation identity; neither may dispatch twice.
            let first = if scenario == "lifecycle-stop-inflight-steer" {
                host.authority_context["concurrentStopId"].as_i64().unwrap()
            } else {
                server
                    .send_request("inquello/tasks/stop", Some(stop.clone()))
                    .await
                    .unwrap()
            };
            let second = server
                .send_request("inquello/tasks/stop", Some(stop.clone()))
                .await
                .unwrap();
            let stopped = private_response(&mut server, &mut host, first).await;
            let duplicate = private_response(&mut server, &mut host, second).await;
            // Concurrent handlers may acquire the operation in either order:
            // either caller can observe the intermediate dispatching receipt.
            // At least one must contain native interruption confirmation.
            let confirmed = if stopped["status"] == "interrupted" {
                &stopped
            } else {
                assert_eq!(
                    duplicate["status"], "interrupted",
                    "submission alone is not the stop receipt: {stopped}; {duplicate}"
                );
                &duplicate
            };
            assert!(matches!(
                stopped["status"].as_str(),
                Some("dispatching" | "interrupted")
            ));
            // A replay may precede the other caller's confirmation.
            // Its exact operation binding is stable; a subsequent replay must
            // expose the same settled receipt without dispatching Stop again.
            for field in [
                "kind",
                "operationId",
                "runId",
                "runtimeId",
                "taskId",
                "threadId",
                "turnId",
            ] {
                assert_eq!(
                    duplicate[field], stopped[field],
                    "stable Stop binding: {field}"
                );
            }
            assert!(matches!(
                duplicate["status"].as_str(),
                Some("dispatching" | "interrupted")
            ));
            let settled = private_rpc(&mut server, &mut host, "inquello/tasks/stop", stop).await;
            assert_eq!(
                &settled, confirmed,
                "replay preserves the confirmed Stop receipt"
            );
            let deadline = tokio::time::Instant::now() + Duration::from_secs(15);
            loop {
                if shell_process(pid).is_none_or(|(state, current)| {
                    current != starttime || matches!(state.as_str(), "Z" | "X")
                }) {
                    break;
                }
                assert!(
                    tokio::time::Instant::now() < deadline,
                    "Stop must preserve native local shell cancellation"
                );
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
            assert!(
                guest_observer::exists(output.join("started.txt")),
                "Stop did not roll back a confirmed effect"
            );
            assert!(
                !guest_observer::exists(output.join("late.txt")),
                "pending effect was not labelled or executed as complete"
            );
            guest_observer::write(
                output.join("release.txt"),
                b"release after confirmed shell termination",
            )
            .unwrap();
            assert!(!guest_observer::exists(output.join("late.txt")));
        }
        if scenario == "lifecycle-stop-provider-unavailable" {
            // The fault stayed active through actual Stop/PID termination above.
            // Recovery of provider readiness permits a fresh explicit Resume;
            // clearing a fixture fault never dispatches work by itself.
            assert_eq!(fixture.requests.lock().await.len(), 1);
            std::fs::remove_file(
                directory
                    .path()
                    .join(".inquello-fixture-provider-unavailable"),
            )
            .unwrap();
        }
        if !steer_only {
            let mut resume = command_for(Some(
                "Resume this same retained Task without replaying confirmed effects; explain what remains.",
            ));
            match scenario {
                "lifecycle-warm-policy-change" => {
                    // Same process and same retained thread, but a stricter
                    // current policy must replace the warm runtime's profile.
                    host.policy["policyRevision"] = json!(2);
                    host.policy["authorizationEpoch"] = json!(2);
                    host.policy["execution"]["sandbox"] = json!("read_only");
                    resume["workspacePolicy"] = host.policy.clone();
                }
                "lifecycle-revoke-before-resume" => host.authority_available = false,
                "lifecycle-peer-private" => {
                    private_rpc(
                        &mut server,
                        &mut host,
                        "inquello/session/setPrincipal",
                        json!({"principalId":BOB}),
                    )
                    .await;
                }
                "lifecycle-cross-company" => {
                    host.workspace_id = COMPANY_B.into();
                    host.policy["workspaceId"] = json!(COMPANY_B);
                    resume["workspacePolicy"] = host.policy.clone();
                    private_rpc(
                        &mut server,
                        &mut host,
                        "inquello/tasks/bootstrap",
                        json!({"workspaceId":COMPANY_B,"isolatedRoot":directory.path()}),
                    )
                    .await;
                }
                "lifecycle-missing-linkage" => {
                    use sqlx::Connection;
                    let mut db = sqlx::SqliteConnection::connect_with(
                        &sqlx::sqlite::SqliteConnectOptions::new().filename(&database),
                    )
                    .await
                    .unwrap();
                    // Simulate lost journal linkage, without weakening the immutable
                    // Task-thread trigger or invoking any generic runtime API.
                    sqlx::query("DELETE FROM task_runs WHERE task_id=?")
                        .bind(&task)
                        .execute(&mut db)
                        .await
                        .unwrap();
                    db.close().await.unwrap();
                }
                "lifecycle-source-reference" => {
                    use sqlx::Connection;
                    let mut db = sqlx::SqliteConnection::connect_with(
                        &sqlx::sqlite::SqliteConnectOptions::new().filename(&database),
                    )
                    .await
                    .unwrap();
                    // Isolated retained-metadata fault: this route has no source
                    // attachment authority or continuity grant to reconstruct it.
                    sqlx::query("UPDATE tasks SET source_refs=? WHERE task_id=?")
                        .bind("[\"unavailable-source-context\"]")
                        .bind(&task)
                        .execute(&mut db)
                        .await
                        .unwrap();
                    db.close().await.unwrap();
                }
                "lifecycle-unknown-turn" => {
                    use sqlx::Connection;
                    let mut db = sqlx::SqliteConnection::connect_with(
                        &sqlx::sqlite::SqliteConnectOptions::new().filename(&database),
                    )
                    .await
                    .unwrap();
                    let mut tx = db.begin().await.unwrap();
                    let row:(String,String,String,String,Option<String>,String)=sqlx::query_as("SELECT principal_id,operation_id,task_id,runtime_id,thread_id,record FROM task_runs WHERE task_id=?")
                        .bind(&task).fetch_one(&mut *tx).await.unwrap();
                    let mut record: Value = serde_json::from_str(&row.5).unwrap();
                    record["turn_id"] = json!("unverified-lineage-turn");
                    // Controlled corruption in this disposable fixture replaces
                    // only the recorded turn identity. Task/thread/owner remain
                    // unchanged, so Resume must reach its retained-turn check:
                    // the real runtime turn is now outside verified lineage.
                    sqlx::query("DELETE FROM task_runs WHERE task_id=?")
                        .bind(&task)
                        .execute(&mut *tx)
                        .await
                        .unwrap();
                    sqlx::query("INSERT INTO task_runs(principal_id,operation_id,task_id,runtime_id,thread_id,record) VALUES(?,?,?,?,?,?)")
                        .bind(row.0).bind(row.1).bind(row.2).bind(row.3).bind(row.4).bind(record.to_string()).execute(&mut *tx).await.unwrap();
                    tx.commit().await.unwrap();
                    db.close().await.unwrap();
                    resume["expectedTurnId"] = json!("unverified-lineage-turn");
                }
                _ => {}
            }
            let resumed = private_rpc(
                &mut server,
                &mut host,
                "inquello/tasks/resume",
                resume.clone(),
            )
            .await;
            if matches!(
                scenario,
                "lifecycle-revoke-before-resume"
                    | "lifecycle-missing-linkage"
                    | "lifecycle-peer-private"
                    | "lifecycle-cross-company"
                    | "lifecycle-unknown-turn"
                    | "lifecycle-source-reference"
            ) {
                assert!(
                    resumed.get("rpcError").is_some(),
                    "unverifiable/unauthorized context refuses actual Resume"
                );
                assert!(!resumed.to_string().contains("INV-104"));
                if scenario == "lifecycle-unknown-turn" {
                    assert!(
                        resumed["rpcError"]["message"]
                            .as_str()
                            .unwrap()
                            .contains("unverified Task turn"),
                        "must reject actual retained history outside verified lineage, not an unrelated preflight: {resumed}"
                    );
                }
                if scenario == "lifecycle-source-reference" {
                    assert!(
                        resumed["rpcError"]["message"]
                            .as_str()
                            .unwrap()
                            .contains("source or artifact context"),
                        "must reject unavailable retained source context before execution: {resumed}"
                    );
                }
                assert_eq!(
                    fixture.requests.lock().await.len(),
                    1,
                    "negative Resume gate made no model call or replacement work"
                );
                {
                    use sqlx::Connection;
                    let mut db = sqlx::SqliteConnection::connect_with(
                        &sqlx::sqlite::SqliteConnectOptions::new()
                            .filename(&database)
                            .read_only(true),
                    )
                    .await
                    .unwrap();
                    let receipts: i64 = sqlx::query_scalar(
                        "SELECT COUNT(*) FROM task_lifecycle WHERE operation_id=?",
                    )
                    .bind(resume["operationId"].as_str().unwrap())
                    .fetch_one(&mut db)
                    .await
                    .unwrap();
                    let archived: i64 =
                        sqlx::query_scalar("SELECT COUNT(*) FROM task_run_history WHERE task_id=?")
                            .bind(&task)
                            .fetch_one(&mut db)
                            .await
                            .unwrap();
                    let tasks: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM tasks")
                        .fetch_one(&mut db)
                        .await
                        .unwrap();
                    assert_eq!(
                        receipts, 0,
                        "context denial happened before lifecycle reservation/dispatch"
                    );
                    assert_eq!(archived, 0, "denial did not rotate the retained run");
                    assert_eq!(tasks, 1, "denial did not create replacement work");
                    db.close().await.unwrap();
                }
                server.shutdown_gracefully().await.unwrap();
                fixture.stop.send(()).unwrap();
                fixture.task.await.unwrap();
                return;
            }
            assert_eq!(
                resumed["status"], "admitted",
                "real retained turn admission: {resumed}"
            );
            assert_eq!(resumed["taskId"], task);
            assert_eq!(resumed["threadId"], thread);
            assert_ne!(resumed["runId"], observed["runId"]);
            // Treat the first host acknowledgement as lost: recover only this receipt.
            let reconciled = private_rpc(
                &mut server,
                &mut host,
                "inquello/tasks/lifecycleReconcile",
                json!({"operationId":resume["operationId"]}),
            )
            .await;
            assert_eq!(reconciled["runId"], resumed["runId"]);
            assert_eq!(reconciled["threadId"], thread);
            if scenario == "lifecycle-revoke-during-resume" {
                let deadline = tokio::time::Instant::now() + Duration::from_secs(30);
                while fixture.requests.lock().await.len() < 2 {
                    assert!(tokio::time::Instant::now() < deadline);
                    private_rpc(
                        &mut server,
                        &mut host,
                        "inquello/tasks/reconcile",
                        json!({"operationId":operation}),
                    )
                    .await;
                    tokio::time::sleep(Duration::from_millis(20)).await;
                }
                host.authority_available = false;
                assert!(
                    private_rpc(
                        &mut server,
                        &mut host,
                        "inquello/tasks/lifecycleReconcile",
                        json!({"operationId":resume["operationId"]})
                    )
                    .await
                    .get("rpcError")
                    .is_some()
                );
                fixture.release.notify_one();
                assert!(
                    private_rpc(
                        &mut server,
                        &mut host,
                        "thread/read",
                        json!({"threadId":thread,"includeTurns":true})
                    )
                    .await
                    .get("rpcError")
                    .is_some()
                );
                assert!(
                    !host
                        .notifications
                        .iter()
                        .any(|n| n.to_string().contains(LATE)),
                    "revoked Resume never discloses late output"
                );
                server.shutdown_gracefully().await.unwrap();
                fixture.stop.send(()).unwrap();
                fixture.task.await.unwrap();
                return;
            }
            let replay = private_rpc(&mut server, &mut host, "inquello/tasks/resume", resume).await;
            assert_eq!(
                replay["runId"], resumed["runId"],
                "repeat submission reconciles, never starts twice"
            );
        }
        let deadline = tokio::time::Instant::now() + Duration::from_secs(45);
        loop {
            let status = private_rpc(
                &mut server,
                &mut host,
                "inquello/tasks/reconcile",
                json!({"operationId":operation}),
            )
            .await;
            assert!(status.get("rpcError").is_none());
            if status["status"] == "completed" {
                break;
            }
            assert!(
                tokio::time::Instant::now() < deadline,
                "retained continuation terminal state: {status}"
            );
            assert!(!matches!(
                status["status"].as_str(),
                Some("failed" | "cancelled" | "uncertain")
            ));
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        if scenario == "lifecycle-progress-continuity" {
            let after = private_rpc(
                &mut server,
                &mut host,
                "inquello/tasks/progress",
                json!({"taskId":task,"workspacePolicy":policy}),
            )
            .await;
            assert!(
                after.get("rpcError").is_none(),
                "actual post-Resume endpoint: {after}"
            );
            let current = after["results"].as_array().unwrap();
            let history = after["resultHistory"].as_array().unwrap();
            assert!(current.iter().any(|r| r["id"] == "result:unaffected"
                && r["text"] == "Approval remains missing"
                && r["sourceTurnId"] == observed["turnId"]));
            assert!(current.iter().any(|r| r["id"] == "result:duplicates"
                && r["revision"] == 2
                && r["state"] == "current"
                && r["sourceTurnId"] == after["turnId"]));
            let old = history
                .iter()
                .find(|r| r["id"] == "result:duplicates" && r["revision"] == 1)
                .expect("retained predecessor through actual endpoint");
            assert_eq!(old["sourceTurnId"], observed["turnId"]);
            assert_eq!(old["state"], "superseded");
            assert_eq!(old["changeReason"], "Initial invoice comparison");
            assert_eq!(old["supersededReason"], "Exclude cancelled invoices");
        }
        let requests = fixture.requests.lock().await;
        assert_eq!(
            requests.len(),
            if scenario == "lifecycle-progress-continuity" {
                4
            } else {
                2
            },
            "no automatic replay, extra model request or provider fallback"
        );
        assert!(
            requests[if scenario == "lifecycle-progress-continuity" {
                2
            } else {
                1
            }]
            .to_string()
            .contains("INV-104"),
            "resumed/steered model actually receives permitted retained context"
        );
        if steer_only {
            assert!(
                requests[1]
                    .to_string()
                    .contains("Exclude cancelled invoices")
            );
        }
        drop(requests);
        if scenario == "lifecycle-steer-lost-ack" {
            let operation = lost_steer_operation
                .as_ref()
                .expect("correlated lost acknowledgement");
            let recovered = private_rpc(
                &mut server,
                &mut host,
                "inquello/tasks/lifecycleReconcile",
                json!({"operationId":operation}),
            )
            .await;
            assert_eq!(
                recovered["status"], "admitted",
                "retained user-message client_id proves this exact steering admission: {recovered}"
            );
            assert_eq!(recovered["operationId"], *operation);
            assert_eq!(
                fixture.requests.lock().await.len(),
                2,
                "reconciliation does not dispatch another effect"
            );
        }
        // Both finish races are truthful and cannot create a new turn.
        let final_binding = private_rpc(
            &mut server,
            &mut host,
            "inquello/tasks/forThread",
            json!({"threadId":thread}),
        )
        .await;
        let ended = json!({"operationId":uuid::Uuid::new_v4().to_string(),"taskId":task,"expectedRunId":final_binding["runId"],"expectedRuntimeId":final_binding["runtimeId"],"expectedTurnId":final_binding["turnId"],"request":null,"workspacePolicy":host.policy});
        assert_eq!(
            private_rpc(&mut server, &mut host, "inquello/tasks/stop", ended.clone()).await["status"],
            "completed"
        );
        let mut correction = ended;
        correction["operationId"] = json!(uuid::Uuid::new_v4().to_string());
        correction["request"] = json!("Keep this draft; do not start a new turn.");
        assert!(
            private_rpc(&mut server, &mut host, "inquello/tasks/steer", correction)
                .await
                .get("rpcError")
                .is_some()
        );
        assert_eq!(
            fixture.requests.lock().await.len(),
            if scenario == "lifecycle-progress-continuity" {
                4
            } else {
                2
            }
        );
        if scenario == "lifecycle-stop-resume" {
            // The phrase appears in the original request, not the resumed turn.
            // Exercise both retained formats through actual private RPCs.
            for legacy in [false, true] {
                if legacy {
                    server.shutdown_gracefully().await.unwrap();
                    use sqlx::Connection;
                    let mut changed = 0;
                    for entry in std::fs::read_dir(&home).unwrap() {
                        let path = entry.unwrap().path();
                        if path.extension().and_then(|s| s.to_str()) != Some("sqlite") {
                            continue;
                        }
                        let mut db = sqlx::SqliteConnection::connect_with(
                            &sqlx::sqlite::SqliteConnectOptions::new().filename(&path),
                        )
                        .await
                        .unwrap();
                        let has:i64=sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='threads'").fetch_one(&mut db).await.unwrap();
                        if has == 1 {
                            changed +=
                                sqlx::query("UPDATE threads SET history_mode='legacy' WHERE id=?")
                                    .bind(&thread)
                                    .execute(&mut db)
                                    .await
                                    .unwrap()
                                    .rows_affected();
                        }
                        db.close().await.unwrap();
                    }
                    assert_eq!(
                        changed, 1,
                        "explicit isolated legacy-format fixture, never production metadata"
                    );
                    convert_saved_fixture_to_legacy(&home, &thread);
                    server = TestAppServer::builder()
                        .with_program(std::path::Path::new(&binary))
                        .with_codex_home(&home)
                        .without_auto_env()
                        .with_env_overrides(&[
                            ("INQUELLO_WORKING_STORE", database.to_str()),
                            ("OPENAI_API_KEY", None),
                            ("ANTHROPIC_API_KEY", None),
                        ])
                        .build_initialized()
                        .await
                        .unwrap();
                    host.pending.clear();
                    host.notifications.clear();
                    private_rpc(
                        &mut server,
                        &mut host,
                        "inquello/session/setPrincipal",
                        json!({"principalId":principal}),
                    )
                    .await;
                    assert_eq!(
                        private_rpc(
                            &mut server,
                            &mut host,
                            "inquello/tasks/bootstrap",
                            json!({"workspaceId":workspace,"isolatedRoot":directory.path()})
                        )
                        .await["accepted"],
                        true
                    );
                }
                let found=private_rpc(&mut server,&mut host,"inquello/workspace/search",json!({"workspaceId":workspace,"query":"INV-105 is distinct","includeArchived":true,"cursor":null})).await;
                assert!(
                    found.get("rpcError").is_none(),
                    "old-turn native search legacy={legacy}: {found}"
                );
                assert_eq!(
                    found["unavailable"], false,
                    "supported history must not silently omit coverage"
                );
                let hit = found["items"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .find(|v| v["kind"] == "conversation" && v["turnId"] == observed["turnId"])
                    .expect("older retained turn exact hit");
                assert_ne!(hit["turnId"], final_binding["turnId"]);
                let opened=private_rpc(&mut server,&mut host,"inquello/task/reopen",json!({"workspaceId":workspace,"taskId":task,"query":"INV-105 is distinct","turnId":hit["turnId"],"itemId":hit["itemId"]})).await;
                assert!(
                    opened.get("rpcError").is_none(),
                    "old-turn exact native reopen legacy={legacy}: {opened}"
                );
                assert_eq!(opened["hit"]["turnId"], observed["turnId"]);
                assert_eq!(opened["hit"]["itemId"], hit["itemId"]);
                assert!(
                    opened["hit"]["text"]
                        .as_str()
                        .unwrap()
                        .contains("INV-105 is distinct")
                );
                let markdown=private_rpc(&mut server,&mut host,"inquello/workspace/search",json!({"workspaceId":workspace,"query":"Vendor evidence required","includeArchived":true,"cursor":null})).await;
                assert_eq!(
                    markdown["unavailable"], false,
                    "Markdown coverage legacy={legacy}: {markdown}"
                );
                let selected = markdown["items"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .find(|item| item["kind"] == "conversation")
                    .expect("both history formats match visible Markdown phrase");
                let exact=private_rpc(&mut server,&mut host,"inquello/task/reopen",json!({"workspaceId":workspace,"taskId":task,"query":"Vendor evidence required","turnId":selected["turnId"],"itemId":selected["itemId"]})).await;
                assert_eq!(
                    exact["hit"]["itemId"], selected["itemId"],
                    "same normalized legacy/paginated exact activation"
                );
                assert_eq!(
                    fixture.requests.lock().await.len(),
                    2,
                    "retained inspection never samples"
                );
            }
        }
        server.shutdown_gracefully().await.unwrap();
        if let Some(operation) = timed_out_steer_operation {
            // The writer is closed: absence is checked against flushed retained
            // user messages, not a racing or filtered progress projection.
            let messages = retained_user_messages(&home, &thread);
            assert!(
                messages
                    .iter()
                    .any(|(text, _)| text.contains("Review fictional procurement: INV-104")),
                "positive control: the original permitted request is retained"
            );
            assert!(
                messages
                    .iter()
                    .all(|(_, client_id)| client_id.as_deref() != Some(operation.as_str())),
                "timed-out validation must never append its user-message operation"
            );
        }
        if scenario == "lifecycle-warm-policy-change" {
            let modes = retained_sandbox_modes(&home, &thread);
            let prior = observed["turnId"].as_str().unwrap();
            let current = final_binding["turnId"].as_str().unwrap();
            assert_ne!(prior, current);
            assert!(
                modes
                    .iter()
                    .any(|(turn, mode)| turn == prior && mode != "read-only"),
                "positive control: original runtime could write its confirmed marker"
            );
            assert!(
                modes
                    .iter()
                    .any(|(turn, mode)| turn == current && mode == "read-only"),
                "same-thread warm Resume must instantiate the new effective read-only sandbox, not merely replace its guard: {modes:?}"
            );
        }
        fixture.stop.send(()).unwrap();
        fixture.task.await.unwrap();
        return;
    }
    let deadline = tokio::time::Instant::now() + Duration::from_secs(60);
    let mut running_shell = None;
    let final_status = loop {
        assert!(
            tokio::time::Instant::now() < deadline,
            "actual retained turn progress"
        );
        let status = private_rpc(
            &mut server,
            &mut host,
            "inquello/tasks/reconcile",
            json!({"operationId":operation}),
        )
        .await;
        if scenario == "revoke-pending-permission" && !host.denied_commands.is_empty() {
            break start.clone();
        }
        if scenario == "revoke-running-tool" {
            let task = start["taskId"].as_str().unwrap();
            let output = guest_observer::task_output(directory.path(), task, &principal);
            if guest_observer::exists(output.join("started.txt")) {
                let pid: u32 = guest_observer::pid(&output);
                let (state, starttime) =
                    shell_process(pid).expect("running fixture shell before withdrawal");
                assert!(!matches!(state.as_str(), "Z" | "X"));
                assert_fixture_shell_command(pid);
                running_shell = Some((pid, starttime));
                if let Some(revoke) = host.revoke_callback.clone() {
                    revoke().await;
                } else {
                    host.authority_available = false;
                }
                // Do not release the shell into a race with authorization observation.
                break start.clone();
            }
        }
        assert!(
            status.get("rpcError").is_none(),
            "before withdrawal: {status}"
        );
        if scenario == "revoke-model" && fixture.requests.lock().await.len() == 2 {
            break status;
        }
        if status["status"] == "completed" {
            assert!(!revoke);
            break status;
        }
        assert!(
            !matches!(
                status["status"].as_str(),
                Some("failed" | "cancelled" | "uncertain")
            ),
            "fixture failed: {status}"
        );
        tokio::time::sleep(Duration::from_millis(20)).await;
    };
    let task = final_status["taskId"].as_str().unwrap();
    let thread = final_status["threadId"].as_str().unwrap();
    if bundled_tools {
        let requests = fixture.requests.lock().await;
        assert_eq!(requests.len(), 2);
        for request in requests.iter() {
            assert_eq!(request["model"], "gpt-6.1-terra");
            assert_eq!(request["reasoning"]["effort"], "low");
            let declarations = request["input"]
                .as_array()
                .unwrap()
                .iter()
                .find(|item| item["type"] == "additional_tools")
                .expect("trusted Responses Lite function declarations");
            let functions = declarations["tools"][0]["tools"].as_array().unwrap();
            assert_eq!(functions.len(), 3);
            for name in ["exec_command", "inquello_progress", "request_user_input"] {
                assert!(functions.iter().any(|tool| tool["name"] == name));
            }
            assert!(
                !functions
                    .iter()
                    .any(|tool| tool["name"] == "shell_command" || tool["name"] == "write_stdin")
            );
        }
        assert!(
            requests[1]["input"]
                .as_array()
                .unwrap()
                .iter()
                .any(|item| item["type"] == "function_call_output"
                    && item["call_id"] == "call_authorized")
        );
    }
    if matches!(
        scenario,
        "allowed" | "revoke-model" | "search-stalled-admission"
    ) {
        assert_eq!(
            guest_observer::read(
                guest_observer::task_output(directory.path(), task, &principal)
                    .join("authorized.txt")
            )
            .unwrap(),
            "permitted",
            "actual allowed tool effect before any withdrawal"
        );
        assert_eq!(
            host.denied_commands.len(),
            1,
            "ordinary exact one-use permission"
        );
        assert_eq!(fixture.requests.lock().await.len(), 2);
    } else {
        assert_eq!(
            fixture.requests.lock().await.len(),
            1,
            "no post-withdrawal model dispatch"
        );
        if scenario == "revoke-pending-permission" {
            assert!(!guest_observer::exists(
                guest_observer::task_output(directory.path(), task, &principal)
                    .join("authorized.txt")
            ));
        }
    }
    if revoke {
        if scenario == "revoke-model" {
            if let Some(revoke) = host.revoke_callback.clone() {
                revoke().await;
            } else {
                host.authority_available = false;
            }
        }
        let denied = private_rpc(
            &mut server,
            &mut host,
            "inquello/tasks/reconcile",
            json!({"operationId":operation}),
        )
        .await;
        assert!(
            denied.get("rpcError").is_some(),
            "current authority uncertainty fences disclosure"
        );
        if let Some((pid, starttime)) = &running_shell {
            let stopped_by = tokio::time::Instant::now() + Duration::from_secs(15);
            loop {
                let stopped = match shell_process(*pid) {
                    None => true,
                    Some((state, current)) => {
                        current != *starttime || matches!(state.as_str(), "Z" | "X")
                    }
                };
                if stopped {
                    break;
                }
                assert!(
                    tokio::time::Instant::now() < stopped_by,
                    "observed authorization denial must actually terminate the running shell"
                );
                // Service callbacks for the ordinary cancellation observer must remain serviced.
                let denied = private_rpc(
                    &mut server,
                    &mut host,
                    "inquello/tasks/reconcile",
                    json!({"operationId":operation}),
                )
                .await;
                assert!(denied.get("rpcError").is_some());
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
            let output = guest_observer::task_output(directory.path(), task, &principal);
            assert!(
                !guest_observer::exists(output.join("late.txt")),
                "blocked side effect did not run before cancellation acknowledgment"
            );
            guest_observer::write(
                output.join("release.txt"),
                b"release only after actual shell termination",
            )
            .unwrap();
            assert!(
                !guest_observer::exists(output.join("late.txt")),
                "terminated shell cannot execute a later gated effect"
            );
        }
        if scenario == "revoke-model" {
            fixture.release.notify_one();
        }
        for method in ["inquello/tasks/forThread", "thread/read"] {
            let params = if method == "thread/read" {
                json!({"threadId":thread,"includeTurns":true})
            } else {
                json!({"threadId":thread})
            };
            let denied = private_rpc(&mut server, &mut host, method, params).await;
            assert!(denied.get("rpcError").is_some());
            assert!(!denied.to_string().contains(LATE));
        }
        assert!(
            !host
                .notifications
                .iter()
                .any(|n| n.to_string().contains(LATE)),
            "late output never reaches another visible cache"
        );
    } else {
        let retained = private_rpc(
            &mut server,
            &mut host,
            "thread/read",
            json!({"threadId":thread,"includeTurns":true}),
        )
        .await;
        assert!(retained.to_string().contains("INV-104"));
        assert!(retained.get("rpcError").is_none());
        let retry = private_rpc(&mut server, &mut host, "inquello/tasks/start", command).await;
        assert_eq!(retry["taskId"], task);
        assert_eq!(
            fixture.requests.lock().await.len(),
            2,
            "reconcile/replay never dispatches another model attempt"
        );
        // Actual native search and exact-hit inspection, not generic search fixtures.
        let search = json!({"workspaceId":workspace,"query":"potential K12,480","includeArchived":true,"cursor":null});
        let found = private_rpc(
            &mut server,
            &mut host,
            "inquello/workspace/search",
            search.clone(),
        )
        .await;
        assert!(
            found.get("rpcError").is_none(),
            "private retained search: {found}"
        );
        let hit = found["items"]
            .as_array()
            .unwrap()
            .iter()
            .find(|v| v["kind"] == "conversation" && v["taskId"] == task)
            .expect("actual saved conversation hit");
        let activation = json!({"workspaceId":workspace,"taskId":task,"query":"potential K12,480","turnId":hit["turnId"],"itemId":hit["itemId"]});
        let opened = private_rpc(
            &mut server,
            &mut host,
            "inquello/task/reopen",
            activation.clone(),
        )
        .await;
        assert!(
            opened.get("rpcError").is_none(),
            "exact native retained reopen: {opened}"
        );
        assert_eq!(opened["hit"]["turnId"], hit["turnId"]);
        assert_eq!(opened["hit"]["itemId"], hit["itemId"]);
        assert!(
            opened["hit"]["text"]
                .as_str()
                .unwrap()
                .contains("potential K12,480")
        );
        assert_eq!(
            fixture.requests.lock().await.len(),
            2,
            "search/reopen perform no inference"
        );
        // Occurrence matching normalizes Markdown; activation must use that same matcher.
        let markdown=private_rpc(&mut server,&mut host,"inquello/workspace/search",json!({"workspaceId":workspace,"query":"Vendor evidence required","includeArchived":true,"cursor":null})).await;
        let exact = markdown["items"]
            .as_array()
            .unwrap()
            .iter()
            .find(|v| v["kind"] == "conversation")
            .expect("Markdown-normalized native occurrence");
        let reopened=private_rpc(&mut server,&mut host,"inquello/task/reopen",json!({"workspaceId":workspace,"taskId":task,"query":"Vendor evidence required","turnId":exact["turnId"],"itemId":exact["itemId"]})).await;
        assert!(
            reopened.get("rpcError").is_none(),
            "same matcher must activate Markdown hit: {reopened}"
        );
        assert_eq!(reopened["hit"]["itemId"], exact["itemId"]);
        let forged = json!({"workspaceId":workspace,"taskId":task,"query":"potential K12,480","turnId":hit["turnId"],"itemId":"foreign-item"});
        assert!(
            private_rpc(&mut server, &mut host, "inquello/task/reopen", forged)
                .await
                .get("rpcError")
                .is_some()
        );
        if service.is_none() {
            if scenario == "search-stalled-admission" {
                _guest_scope.keep_running();
            }
            saved_navigation_matrix(
                &mut server,
                &mut host,
                &database,
                &home,
                &workspace,
                &task,
                &thread,
                &activation,
                route,
                &configuration,
                scenario == "search-stalled-admission",
            )
            .await;
        }
        host.authority_callback = None;
        host.revoke_callback = None;
        // Same Workspace peer cannot read a retained creator-private Task.
        private_rpc(
            &mut server,
            &mut host,
            "inquello/session/setPrincipal",
            json!({"principalId":BOB}),
        )
        .await;
        let denied = private_rpc(
            &mut server,
            &mut host,
            "inquello/tasks/forThread",
            json!({"threadId":thread}),
        )
        .await;
        let denied_hit = private_rpc(
            &mut server,
            &mut host,
            "inquello/task/reopen",
            activation.clone(),
        )
        .await;
        assert!(denied_hit.get("rpcError").is_some());
        assert!(!denied_hit.to_string().contains("potential K12,480"));
        let denied_search = private_rpc(
            &mut server,
            &mut host,
            "inquello/workspace/search",
            search.clone(),
        )
        .await;
        if let Some(items) = denied_search["items"].as_array() {
            assert!(items.is_empty(), "peer-private results and counts absent");
        }
        let missing = private_rpc(
            &mut server,
            &mut host,
            "inquello/tasks/forThread",
            json!({"threadId":uuid::Uuid::new_v4()}),
        )
        .await;
        assert_eq!(
            denied, missing,
            "foreign and nonexistent bindings have the same bounded response"
        );
        assert!(!denied.to_string().contains("INV-104"));
        let permission = uuid::Uuid::new_v4().to_string();
        let policy = host.policy.clone();
        let foreign=private_rpc(&mut server,&mut host,"inquello/tasks/consumePermission",json!({"taskId":task,"requestId":permission,"command":[fixture_shell(),"-c","fixture forbidden"],"workspacePolicy":policy})).await;
        assert!(foreign.get("rpcError").is_some());
        assert!(!foreign.to_string().contains("INV-104"));
        // The original principal still cannot use the old Task in another company.
        private_rpc(
            &mut server,
            &mut host,
            "inquello/session/setPrincipal",
            json!({"principalId":principal}),
        )
        .await;
        // A second company session cannot reuse the original thread either.
        host.workspace_id = COMPANY_B.into();
        host.policy["workspaceId"] = json!(COMPANY_B);
        private_rpc(
            &mut server,
            &mut host,
            "inquello/tasks/bootstrap",
            json!({"workspaceId":COMPANY_B,"isolatedRoot":directory.path()}),
        )
        .await;
        let denied = private_rpc(
            &mut server,
            &mut host,
            "thread/read",
            json!({"threadId":thread,"includeTurns":true}),
        )
        .await;
        assert!(denied.get("rpcError").is_some());
        assert!(!denied.to_string().contains("INV-104"));
        let mut crossed_activation = activation;
        crossed_activation["workspaceId"] = json!(COMPANY_B);
        let crossed = private_rpc(
            &mut server,
            &mut host,
            "inquello/task/reopen",
            crossed_activation,
        )
        .await;
        assert!(crossed.get("rpcError").is_some());
        assert!(!crossed.to_string().contains("potential K12,480"));
    }
    server.shutdown_gracefully().await.unwrap();
    if scenario == "revoke-pending-permission" {
        assert!(
            !guest_observer::exists(
                guest_observer::task_output(directory.path(), task, &principal)
                    .join("authorized.txt")
            ),
            "late approval never executes after cancellation"
        );
    }
    if running_shell.is_some() {
        assert!(
            !guest_observer::exists(
                guest_observer::task_output(directory.path(), task, &principal).join("late.txt")
            ),
            "no late side effect after observed shell termination and runtime shutdown"
        );
    }
    fixture.stop.send(()).unwrap();
    fixture.task.await.unwrap();
}

/// Real RPC matrix with a parent-controlled final-callback barrier. All records
/// are fictional and each denial follows a positive search/activation control.
async fn saved_navigation_matrix(
    server: &mut TestAppServer,
    host: &mut PrivateTaskHost,
    database: &std::path::Path,
    home: &std::path::Path,
    workspace: &str,
    task: &str,
    thread: &str,
    activation: &Value,
    route: &str,
    configuration: &Value,
    exercise_stall: bool,
) {
    use sqlx::Connection;
    for index in 0..51 {
        let made=private_rpc(server,host,"inquello/task/create",json!({"operationId":uuid::Uuid::new_v4(),"expectedRevision":0,"workspaceId":workspace,"engagementId":null,"folderId":null,"title":format!("Pagination procurement {index:02}")})).await;
        assert!(
            made.get("rpcError").is_none(),
            "normal private draft fixture: {made}"
        );
    }
    let request = json!({"workspaceId":workspace,"query":"Pagination procurement","includeArchived":true,"cursor":null});
    let before_inventory = host.authority_context["inventoryCalls"]
        .as_u64()
        .unwrap_or(0);
    let before_policy = host.authority_context["policyCalls"].as_u64().unwrap_or(0);
    let first = private_rpc(server, host, "inquello/workspace/search", request.clone()).await;
    assert_eq!(first["items"].as_array().unwrap().len(), 50);
    assert!(
        first["nextCursor"].is_string(),
        "actual nonempty next cursor"
    );
    assert_eq!(
        host.authority_context["inventoryCalls"].as_u64().unwrap() - before_inventory,
        2,
        "51 candidates still use two inventory observations"
    );
    assert_eq!(
        host.authority_context["policyCalls"].as_u64().unwrap() - before_policy,
        4,
        "generic/initial/final policy observations are request bounded for fictional records"
    );
    let mut next = request.clone();
    next["cursor"] = first["nextCursor"].clone();
    let second = private_rpc(server, host, "inquello/workspace/search", next.clone()).await;
    assert_eq!(second["items"].as_array().unwrap().len(), 1);
    assert!(second["nextCursor"].is_null());
    let off_page = second["items"][0]["taskId"].as_str().unwrap().to_owned();
    let opened = private_rpc(
        server,
        host,
        "inquello/task/reopen",
        json!({"workspaceId":workspace,"taskId":off_page,"query":null,"turnId":null,"itemId":null}),
    )
    .await;
    assert_eq!(opened["task"]["taskId"], off_page);
    for (field, value) in [
        ("query", json!("different procurement")),
        ("includeArchived", json!(false)),
        ("workspaceId", json!(COMPANY_B)),
    ] {
        let mut changed = next.clone();
        changed[field] = value;
        assert!(
            private_rpc(server, host, "inquello/workspace/search", changed)
                .await
                .get("rpcError")
                .is_some(),
            "cursor scope mismatch {field}"
        );
    }
    host.authority_context["inventorySnapshot"] = json!("fictional-scope-v2");
    assert!(
        private_rpc(server, host, "inquello/workspace/search", next.clone())
            .await
            .get("rpcError")
            .is_some(),
        "same labels do not preserve stale authority cursor"
    );
    host.authority_context["inventorySnapshot"] = json!("fictional-scope-v1");
    let mut db = sqlx::SqliteConnection::connect_with(
        &sqlx::sqlite::SqliteConnectOptions::new().filename(database),
    )
    .await
    .unwrap();
    let title: String = sqlx::query_scalar("SELECT title FROM tasks WHERE task_id=?")
        .bind(&off_page)
        .fetch_one(&mut db)
        .await
        .unwrap();
    host.authority_context["finalMutationExecuted"] = json!(false);
    host.authority_context["inventoryFinalMutation"] = json!({"database":database,"sql":"UPDATE tasks SET title=? WHERE task_id=?","arguments":["Withdrawn off-page private contributor",off_page]});
    let denied = private_rpc(server, host, "inquello/workspace/search", request.clone()).await;
    assert_eq!(
        host.authority_context["finalMutationExecuted"], true,
        "must reach actual final await"
    );
    assert!(
        denied.get("rpcError").is_some(),
        "off-page contributor mutation invalidates first page: {denied}"
    );
    assert!(denied.get("items").is_none(), "no partial snippets/counts");
    sqlx::query("UPDATE tasks SET title=? WHERE task_id=?")
        .bind(&title)
        .bind(&off_page)
        .execute(&mut db)
        .await
        .unwrap();
    assert!(
        private_rpc(server, host, "inquello/workspace/search", request)
            .await
            .get("rpcError")
            .is_none(),
        "restored positive control"
    );
    // Retained lineage changes during the final service wait, not before entry.
    let original_run: String = sqlx::query_scalar("SELECT record FROM task_runs WHERE task_id=?")
        .bind(task)
        .fetch_one(&mut db)
        .await
        .unwrap();
    host.authority_context["inventoryFinalMutation"] = json!({"database":database,"sql":"UPDATE task_runs SET record=json_set(record,'$.status','interrupted') WHERE task_id=?","arguments":[task]});
    let denied = private_rpc(server, host, "inquello/task/reopen", activation.clone()).await;
    assert!(
        denied.get("rpcError").is_some(),
        "final-await lineage mutation rejects exact hit: {denied}"
    );
    assert!(!denied.to_string().contains("potential K12,480"));
    sqlx::query("UPDATE task_runs SET record=? WHERE task_id=?")
        .bind(&original_run)
        .bind(task)
        .execute(&mut db)
        .await
        .unwrap();
    // A genuinely indexed old-message edit at the same final boundary.
    let mut history_database = None;
    for entry in std::fs::read_dir(home).unwrap() {
        let path = entry.unwrap().path();
        if path.extension().and_then(|x| x.to_str()) != Some("sqlite") {
            continue;
        }
        let mut history = sqlx::SqliteConnection::connect_with(
            &sqlx::sqlite::SqliteConnectOptions::new().filename(&path),
        )
        .await
        .unwrap();
        let table: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='thread_items'",
        )
        .fetch_one(&mut history)
        .await
        .unwrap();
        history.close().await.unwrap();
        if table == 1 {
            assert!(history_database.replace(path).is_none());
        }
    }
    let history_database = history_database.expect("real native indexed history database");
    let mut history = sqlx::SqliteConnection::connect_with(
        &sqlx::sqlite::SqliteConnectOptions::new().filename(&history_database),
    )
    .await
    .unwrap();
    let item = activation["itemId"].as_str().unwrap();
    let original_item: String =
        sqlx::query_scalar("SELECT item_json FROM thread_items WHERE thread_id=? AND item_id=?")
            .bind(thread)
            .bind(item)
            .fetch_one(&mut history)
            .await
            .unwrap();
    // No-hit histories still contribute to the completed search observation.
    let absent = json!({"workspaceId":workspace,"query":"newly permitted zero-match witness","includeArchived":true,"cursor":null});
    let empty = private_rpc(server, host, "inquello/workspace/search", absent.clone()).await;
    assert_eq!(empty["unavailable"], false);
    assert!(empty["items"].as_array().unwrap().is_empty());
    host.authority_context["finalMutationExecuted"] = json!(false);
    host.authority_context["inventoryFinalMutation"] = json!({"database":history_database,"sql":"UPDATE thread_items SET item_json=json_set(item_json,'$.text','newly permitted zero-match witness') WHERE thread_id=? AND item_id=?","arguments":[thread,item]});
    let changed = private_rpc(server, host, "inquello/workspace/search", absent.clone()).await;
    assert_eq!(host.authority_context["finalMutationExecuted"], true);
    assert!(
        changed.get("rpcError").is_some(),
        "zero-to-match change during final await must not return a stale zero: {changed}"
    );
    let positive = private_rpc(server, host, "inquello/workspace/search", absent).await;
    assert!(
        positive["items"]
            .as_array()
            .unwrap()
            .iter()
            .any(|hit| hit["itemId"] == item),
        "new request observes the new match"
    );
    sqlx::query("UPDATE thread_items SET item_json=? WHERE thread_id=? AND item_id=?")
        .bind(&original_item)
        .bind(thread)
        .bind(item)
        .execute(&mut history)
        .await
        .unwrap();
    host.authority_context["inventoryFinalMutation"] = json!({"database":history_database,"sql":"UPDATE thread_items SET item_json=json_set(item_json,'$.text','Withheld retained message') WHERE thread_id=? AND item_id=?","arguments":[thread,item]});
    let denied = private_rpc(server, host, "inquello/task/reopen", activation.clone()).await;
    assert!(
        denied.get("rpcError").is_some(),
        "final-await indexed content mutation rejects exact hit: {denied}"
    );
    assert!(!denied.to_string().contains("potential K12,480"));
    sqlx::query("UPDATE thread_items SET item_json=? WHERE thread_id=? AND item_id=?")
        .bind(original_item)
        .bind(thread)
        .bind(item)
        .execute(&mut history)
        .await
        .unwrap();
    history.close().await.unwrap();
    assert!(
        private_rpc(server, host, "inquello/task/reopen", activation.clone())
            .await
            .get("rpcError")
            .is_none()
    );
    if exercise_stall {
        host.authority_context["holdNextAdmission"] = json!(true);
        let notifications_before = host.notifications.len();
        let started = tokio::time::Instant::now();
        let stalled=private_rpc(server,host,"inquello/workspace/search",json!({"workspaceId":workspace,"query":"potential K12,480","includeArchived":true,"cursor":null})).await;
        assert!(
            started.elapsed() < Duration::from_secs(35),
            "admission is inside the saved-work deadline"
        );
        assert!(stalled.get("rpcError").is_some());
        assert!(stalled.get("items").is_none());
        assert!(!stalled.to_string().contains("potential K12,480"));
        let held: codex_app_server_protocol::RequestId =
            serde_json::from_value(host.authority_context["heldAdmissionId"].take())
                .expect("actual stalled native callback");
        server
            .send_response(held, json!({"workspacePolicy":host.policy}))
            .await
            .unwrap();
        // Fresh explicit bootstrap is required after authority loss; no inference
        // or provider fallback is involved. The late old reply cannot revive it.
        assert_eq!(
            private_rpc(
                server,
                host,
                "inquello/tasks/bootstrap",
                json!({"workspaceId":workspace,"isolatedRoot":home.parent().unwrap()})
            )
            .await["accepted"],
            true
        );
        assert!(
            private_rpc(server, host, "inquello/task/reopen", activation.clone())
                .await
                .get("rpcError")
                .is_none()
        );
        assert!(
            host.pending.is_empty(),
            "no late success response escaped the cancelled request"
        );
        assert!(
            !host.notifications[notifications_before..]
                .iter()
                .any(|message| message.to_string().contains("potential K12,480")),
            "late authority response reveals no retained text"
        );
    }
    // Current selection revision 2 must not stand in for retained run revision 1.
    assert!(private_rpc(server,host,"inquello/routes/configure",json!({"operationId":uuid::Uuid::new_v4(),"expectedRevision":1,"configuration":configuration})).await.get("rpcError").is_none());
    let current = private_rpc(
        server,
        host,
        "inquello/routes/task/read",
        json!({"taskId":task}),
    )
    .await;
    let expected = current["revision"].as_u64().expect("Task route revision");
    assert!(private_rpc(server,host,"inquello/routes/task/set",json!({"operationId":uuid::Uuid::new_v4(),"expectedRevision":expected,"taskId":task,"routeId":route,"configurationRevision":2})).await.get("rpcError").is_none());
    assert!(
        private_rpc(server, host, "inquello/task/reopen", activation.clone())
            .await
            .get("rpcError")
            .is_none(),
        "retained revision 1 still works with current selection 2"
    );
    sqlx::query("PRAGMA foreign_keys=OFF")
        .execute(&mut db)
        .await
        .unwrap();
    assert_eq!(sqlx::query("DELETE FROM processing_route_candidates WHERE principal_id=? AND route_id=? AND revision=1").bind(ALICE).bind(route).execute(&mut db).await.unwrap().rows_affected(),1);
    let denied = private_rpc(server, host, "inquello/task/reopen", activation.clone()).await;
    assert!(
        denied.get("rpcError").is_some(),
        "current route cannot substitute for missing exact retained configuration: {denied}"
    );
    db.close().await.unwrap();
}

fn convert_saved_fixture_to_legacy(home: &std::path::Path, thread: &str) {
    fn visit(path: &std::path::Path, thread: &str, changed: &mut usize) {
        for entry in std::fs::read_dir(path).unwrap() {
            let path = entry.unwrap().path();
            if path.is_dir() {
                visit(&path, thread, changed);
                continue;
            }
            if path.extension().and_then(|s| s.to_str()) != Some("jsonl") {
                continue;
            }
            let original = std::fs::read_to_string(&path).unwrap();
            let Some((first, rest)) = original.split_once('\n') else {
                continue;
            };
            let mut header: Value = serde_json::from_str(first).unwrap();
            if header["type"] == "session_meta" && header["payload"]["id"] == thread {
                header["payload"]["history_mode"] = json!("legacy");
                // Renaming only the header leaves paginated ItemCompleted
                // messages, which the legacy reader intentionally ignores.
                // Translate the actual retained text to its legacy event form;
                // preserve turn boundaries and never invent conversation text.
                let mut converted = format!("{header}\n");
                let mut messages = 0;
                for source in rest.lines().filter(|line| !line.is_empty()) {
                    let parsed =
                        codex_rollout::parse_rollout_line_bytes(source.as_bytes()).unwrap();
                    let replacement = match parsed.item {
                        codex_rollout::RolloutItem::EventMsg(
                            codex_protocol::protocol::EventMsg::ItemCompleted(event),
                        ) => match event.item {
                            codex_protocol::items::TurnItem::UserMessage(user) => {
                                assert!(user.content.iter().all(|input| matches!(input, codex_protocol::user_input::UserInput::Text { .. })));
                                Some(codex_protocol::protocol::EventMsg::UserMessage(
                                    codex_protocol::protocol::UserMessageEvent {
                                        message: user.message(),
                                        text_elements: user.text_elements(),
                                        client_id: user.client_id,
                                        ..Default::default()
                                    },
                                ))
                            }
                            codex_protocol::items::TurnItem::AgentMessage(agent) => {
                                Some(codex_protocol::protocol::EventMsg::AgentMessage(
                                    codex_protocol::protocol::AgentMessageEvent {
                                        message: agent.content.iter().map(|content| match content {
                                            codex_protocol::items::AgentMessageContent::Text { text } => text.as_str(),
                                        }).collect::<Vec<_>>().join(""),
                                        phase: agent.phase,
                                        memory_citation: agent.memory_citation,
                                        delivery: agent.delivery,
                                        questions: agent.questions,
                                    },
                                ))
                            }
                            _ => None,
                        },
                        _ => None,
                    };
                    if let Some(event) = replacement {
                        let mut line: Value = serde_json::from_str(source).unwrap();
                        line["payload"] = serde_json::to_value(event).unwrap();
                        converted.push_str(&line.to_string());
                        messages += 1;
                    } else {
                        converted.push_str(source);
                    }
                    converted.push('\n');
                }
                assert!(
                    messages > 0,
                    "legacy fixture contains actual retained messages"
                );
                std::fs::write(path, converted).unwrap();
                *changed += 1;
            }
        }
    }
    let mut changed = 0;
    visit(&home.join("sessions"), thread, &mut changed);
    assert_eq!(
        changed, 1,
        "fixture converts both authoritative header and indexed mode"
    );
}

/// Selects only the label used by a synthetic catalog and pinned local transport.
/// This is not a model capability, live-account, or organization eligibility claim.
fn fixture_responses_model(selection: Option<&str>) -> Result<&'static str, &'static str> {
    match selection {
        None | Some("fixture-responses-20261031") => Ok("fixture-responses-20261031"),
        Some("gpt-6.1-terra") => Ok("gpt-6.1-terra"),
        Some(_) => Err("unsupported synthetic Responses model selector"),
    }
}

#[test]
fn synthetic_model_selector_preserves_default_and_exact_terra() {
    assert_eq!(
        fixture_responses_model(None),
        Ok("fixture-responses-20261031")
    );
    assert_eq!(
        fixture_responses_model(Some("fixture-responses-20261031")),
        Ok("fixture-responses-20261031")
    );
    assert_eq!(
        fixture_responses_model(Some("gpt-6.1-terra")),
        Ok("gpt-6.1-terra")
    );
}
#[test]
fn synthetic_model_selector_refuses_unknown_or_normalized_labels() {
    for value in [
        "",
        "gpt-6.1-terra ",
        "GPT-6.1-TERRA",
        "gpt-6.1",
        "https://api.openai.com",
        "fixture-responses-other",
    ] {
        assert!(fixture_responses_model(Some(value)).is_err());
    }
}

#[test]
fn fixture_admission_budget_does_not_extend_effect_or_security_waits() {
    assert_eq!(
        provider_accept_budget("allowed", 0),
        PRIVATE_ADMISSION_BUDGET
    );
    assert_eq!(
        provider_accept_budget("lifecycle-warm-policy-change", 1),
        PRIVATE_ADMISSION_BUDGET
    );
    assert_eq!(
        provider_accept_budget("lifecycle-completed-followup", 2),
        PRIVATE_ADMISSION_BUDGET
    );
    for (scenario, index) in [
        ("allowed", 1),
        ("revoke-model", 1),
        ("lifecycle-steer", 1),
        ("lifecycle-progress-cache", 1),
        ("lifecycle-progress-continuity", 1),
        ("lifecycle-progress-continuity", 3),
    ] {
        assert_eq!(
            provider_accept_budget(scenario, index),
            Duration::from_secs(45)
        );
    }
}
