//! The transport input loop must return before main can answer server authority requests.
use super::message_processor_tracing_tests::{
    TEST_CONNECTION_ID, build_test_processor, read_response,
};
use super::*;
use crate::outgoing_message::{OutgoingEnvelope, OutgoingMessage, PrivateThreadAuthority};
use codex_app_server_protocol::{
    InitializeResponse, InquelloSetPrincipalParams, InquelloTasksBootstrapParams, RequestId,
};
use codex_config::{LoaderOverrides, types::AuthCredentialsStoreMode};
use codex_login::AuthKeyringBackendKind;
use serde_json::json;
use tokio::sync::mpsc;

const PRINCIPAL: &str = "11111111-1111-4111-8111-111111111111";
const WORKSPACE: &str = "5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e";

async fn harness() -> anyhow::Result<(
    tempfile::TempDir,
    Arc<MessageProcessor>,
    Arc<ConnectionSessionState>,
    mpsc::Receiver<OutgoingEnvelope>,
)> {
    let root = tempfile::tempdir()?;
    let home = root.path().join("runtime-home");
    std::fs::create_dir(&home)?;
    let config = Arc::new(
        codex_core::config::ConfigBuilder::default()
            .codex_home(home.clone())
            .loader_overrides(LoaderOverrides::without_managed_config_for_tests())
            .build()
            .await?,
    );
    let auth = Arc::new(
        AuthManager::new(
            home,
            false,
            AuthCredentialsStoreMode::File,
            None,
            Some(config.chatgpt_base_url.clone()),
            AuthKeyringBackendKind::default(),
            config.auth_config().auth_route_config,
        )
        .await,
    );
    let (mut processor, mut initial_rx) = build_test_processor(config, auth).await;
    processor.models_refresh_worker.shutdown();
    let session = Arc::new(ConnectionSessionState::new(
        crate::transport::ConnectionOrigin::Stdio,
    ));
    processor.process_request(TEST_CONNECTION_ID, serde_json::from_value(json!({
        "id":1,"method":"initialize","params":{"clientInfo":{"name":"fixture-dispatch-test","version":"1"}}
    }))?, &AppServerTransport::Stdio, session.clone()).await;
    let _: InitializeResponse = read_response(&mut initial_rx, 1).await;
    // Replace this test's store/sender together. The normal sender's authority is
    // once-bound; never attempt to rebind it or alter process-global environment.
    let (tx, rx) = mpsc::channel(16);
    let outgoing = Arc::new(OutgoingMessageSender::new(
        tx,
        AnalyticsEventsClient::disabled(),
    ));
    let owned = Arc::get_mut(&mut processor).expect("test processor has not scheduled handlers");
    let private = Arc::new(
        InquelloRequestProcessor::with_store_path(Some(root.path().join("working.sqlite")), vec![])
            .with_task_outgoing(outgoing.clone())
            .with_task_config(owned.config_processor.clone()),
    );
    outgoing.bind_private_authority(&private);
    owned.outgoing = outgoing;
    owned.inquello_processor = private.clone();
    std::fs::write(
        root.path().join(".inquello-fictional-audit-session"),
        "synthetic",
    )?;
    private
        .set_principal(
            TEST_CONNECTION_ID,
            InquelloSetPrincipalParams {
                principal_id: Some(PRINCIPAL.into()),
            },
        )
        .await
        .unwrap();
    private
        .tasks_bootstrap(
            TEST_CONNECTION_ID,
            InquelloTasksBootstrapParams {
                recovery_only: false,
                workspace_id: WORKSPACE.into(),
                isolated_root: root.path().to_string_lossy().into_owned(),
                real_session: None,
            },
        )
        .await
        .unwrap();
    private.route_configure(TEST_CONNECTION_ID, serde_json::from_value(json!({
        "operationId":"dispatcher-route","expectedRevision":0,"configuration":{
          "routeId":"claude-api-key","deployment":"anthropic-direct","model":"claude-sonnet-5-5",
          "apiVersion":"2026-10-21","accountRef":PRINCIPAL,"region":null}
    }))?).await.unwrap();
    let cert = rcgen::generate_simple_self_signed(vec!["127.0.0.1".into()])?
        .cert
        .der()
        .to_vec();
    private
        .prepare_task_fixture(
            TEST_CONNECTION_ID,
            Some(json!({
                "workspaceId":WORKSPACE,"routeId":"claude-api-key","configurationRevision":1,
                "endpoint":"https://127.0.0.1:1/v1/messages","certificate":cert
            })),
        )
        .await
        .unwrap();
    Ok((root, processor, session, rx))
}

async fn dispatch(
    processor: &Arc<MessageProcessor>,
    session: &Arc<ConnectionSessionState>,
    id: i64,
) {
    // Crucially NOT join!(dispatch, authority_reply): that would mask the real
    // serial input-loop deadlock by servicing the reply concurrently in the test.
    tokio::time::timeout(
        Duration::from_secs(2),
        processor.process_request(
            TEST_CONNECTION_ID,
            serde_json::from_value(json!({"id":id,
        "method":"inquello/fixture/taskTransportStatus","params":{
        "workspaceId":WORKSPACE,"routeId":"claude-api-key","configurationRevision":1}}))
            .unwrap(),
            &AppServerTransport::Stdio,
            session.clone(),
        ),
    )
    .await
    .expect("dispatcher must return before the peer can supply authority");
}

async fn authority_request(rx: &mut mpsc::Receiver<OutgoingEnvelope>) -> RequestId {
    let envelope = tokio::time::timeout(Duration::from_secs(2), rx.recv())
        .await
        .unwrap()
        .unwrap();
    let OutgoingEnvelope::ToConnection {
        connection_id,
        message,
        ..
    } = envelope
    else {
        panic!("private authority request");
    };
    assert_eq!(connection_id, TEST_CONNECTION_ID);
    let raw = serde_json::to_value(message).unwrap();
    assert_eq!(raw["method"], "inquello/tasks/authority");
    serde_json::from_value(raw["id"].clone()).unwrap()
}
async fn answer(processor: &MessageProcessor, id: RequestId) {
    processor.process_response(TEST_CONNECTION_ID,JSONRPCResponse{id,result:json!({
        "workspacePolicy":{"workspaceId":WORKSPACE,"policyRevision":1,"authorizationEpoch":1,"execution":null}
    })}).await;
}

#[tokio::test]
async fn fixture_status_dispatch_returns_before_authority_and_preserves_queue_fence()
-> anyhow::Result<()> {
    let (_root, processor, session, mut rx) = harness().await?;
    dispatch(&processor, &session, 20).await;
    let id = authority_request(&mut rx).await;
    answer(&processor, id).await;
    let envelope = tokio::time::timeout(Duration::from_secs(2), rx.recv())
        .await?
        .unwrap();
    let OutgoingEnvelope::ToConnection {
        message,
        private_fence,
        ..
    } = envelope
    else {
        panic!("private result");
    };
    let OutgoingMessage::Response(response) = message else {
        panic!("accepted proof response");
    };
    assert_eq!(response.id, RequestId::Integer(20));
    assert_eq!(
        serde_json::to_value(response.result)?,
        json!({"accepted":true})
    );
    let original = private_fence.expect("proof remains fenced after first output queue");
    assert!(original.is_current());
    processor
        .inquello_processor
        .set_principal(
            TEST_CONNECTION_ID,
            InquelloSetPrincipalParams {
                principal_id: Some(PRINCIPAL.into()),
            },
        )
        .await
        .unwrap();
    assert!(
        !original.is_current(),
        "same-principal replacement cannot revive queued proof"
    );
    session.rpc_gate.shutdown().await;
    processor.shutdown_threads().await;
    Ok(())
}

#[tokio::test]
async fn fixture_status_dispatch_cannot_accept_replaced_authority_while_waiting()
-> anyhow::Result<()> {
    let (_root, processor, session, mut rx) = harness().await?;
    let original = processor
        .inquello_processor
        .capture_fence(TEST_CONNECTION_ID)
        .await
        .unwrap();
    dispatch(&processor, &session, 21).await;
    let id = authority_request(&mut rx).await;
    processor
        .inquello_processor
        .set_principal(
            TEST_CONNECTION_ID,
            InquelloSetPrincipalParams {
                principal_id: Some(PRINCIPAL.into()),
            },
        )
        .await
        .unwrap();
    answer(&processor, id).await;
    let envelope = tokio::time::timeout(Duration::from_secs(2), rx.recv())
        .await?
        .unwrap();
    let OutgoingEnvelope::ToConnection { message, .. } = envelope else {
        panic!("private refusal");
    };
    assert!(
        matches!(message, OutgoingMessage::Error(_)),
        "old proof cannot become success"
    );
    assert!(!original.is_current());
    session.rpc_gate.shutdown().await;
    processor.shutdown_threads().await;
    Ok(())
}
