use super::ResponsesStreamRequest;
use super::ResponsesStreamRetryState;
use super::handle_response_stream_error;
use super::log_retry;
use crate::realtime_history::RealtimeHistoryState;
use crate::session::step_context::StepContext;
use crate::session::tests::make_session_and_context;
use codex_http_client::RetryAfter;
use codex_protocol::error::CodexErr;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::time::Instant;
use tracing_test::internal::MockWriter;

#[tokio::test]
async fn sampling_retry_logs_stream_error_context() {
    let (_session, turn_context) = make_session_and_context().await;
    let buffer: &'static std::sync::Mutex<Vec<u8>> =
        Box::leak(Box::new(std::sync::Mutex::new(Vec::new())));
    let subscriber = tracing_subscriber::fmt()
        .with_ansi(false)
        .with_max_level(tracing::Level::WARN)
        .with_writer(MockWriter::new(buffer))
        .finish();
    let _subscriber_guard = tracing::subscriber::set_default(subscriber);

    log_retry(
        ResponsesStreamRequest::Sampling,
        &turn_context,
        &CodexErr::Stream("websocket closed by server before response.completed".to_string()),
        /*retries*/ 2,
        /*max_retries*/ 5,
        Duration::from_secs(1),
    );

    let logs = String::from_utf8(
        buffer
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .clone(),
    )
    .expect("retry log should be valid utf-8");
    assert!(logs.contains("stream disconnected - retrying sampling request"));
    assert!(logs.contains(&format!("turn_id={}", turn_context.sub_id)));
    assert!(logs.contains("retries=2"));
    assert!(logs.contains("max_retries=5"));
    assert!(logs.contains(
        "sampling_error=stream disconnected before completion: websocket closed by server before response.completed"
    ));
}

/// Time spent reporting a retry must count toward the server's original deadline.
#[tokio::test]
#[expect(
    clippy::await_holding_invalid_type,
    reason = "test holds the event-delivery lock to delay notification while virtual time advances"
)]
async fn stream_retry_preserves_deadline_across_delayed_notification() {
    let (mut session, turn_context) = make_session_and_context().await;
    let step_context = StepContext::for_test(Arc::new(turn_context));
    session.realtime_history = Some(Mutex::new(RealtimeHistoryState::default()));
    let mut client_session = session.services.model_client.new_session();
    // The second retry emits a notification even when release builds hide the first.
    let mut retry_state = ResponsesStreamRetryState {
        retries: 1,
        ..Default::default()
    };

    tokio::time::pause();
    let advice = RetryAfter::from_delay(Duration::from_secs(10)).expect("retry deadline");
    tokio::time::advance(Duration::from_secs(4)).await;

    // Hold the event-delivery lock so reporting the error consumes part of the deadline.
    let history_guard = session.realtime_history.as_ref().unwrap().lock().await;
    let retry = handle_response_stream_error(
        &mut retry_state,
        /*max_retries*/ 2,
        CodexErr::InternalServerError.with_retry_after(advice),
        &mut client_session,
        &session,
        &step_context,
        ResponsesStreamRequest::Sampling,
    );
    tokio::pin!(retry);
    assert!(futures::poll!(&mut retry).is_pending());
    tokio::time::advance(Duration::from_secs(4)).await;
    drop(history_guard);

    assert!(futures::poll!(&mut retry).is_pending());
    tokio::time::advance(Duration::from_secs(1)).await;
    assert!(futures::poll!(&mut retry).is_pending());
    retry.await.expect("retry should be allowed");
    // Tokio rounds timer deadlines up to the next millisecond.
    let resumed_at = Instant::now();
    assert!(
        (advice.deadline()..=advice.deadline() + Duration::from_millis(1)).contains(&resumed_at),
        "retry resumed at {resumed_at:?}, expected {advice:?}"
    );
}

#[tokio::test]
async fn inquello_private_errors_never_enter_unbounded_retry_or_transport_fallback() {
    use crate::session::tests::make_session_and_context_with_auth_and_config_and_rx;
    use codex_features::Feature;
    use codex_protocol::error::ConnectionFailedError;
    let (session, turn, _events) = make_session_and_context_with_auth_and_config_and_rx(
        codex_login::CodexAuth::from_api_key("synthetic-test-key"),
        Vec::new(),
        |config| {
            config
                .features
                .enable(Feature::UnboundedConnectionRetries)
                .unwrap_or_else(|error| panic!("retry feature fixture must be valid: {error}"));
            config.model_provider.supports_websockets = true;
        },
    )
    .await;
    assert!(
        turn.config
            .features
            .enabled(Feature::UnboundedConnectionRetries)
    );
    assert!(session.services.model_client.responses_websocket_enabled());
    crate::inquello_inference::mark_task_thread(&session.thread_id.to_string()).unwrap();
    assert!(!crate::inquello_inference::is_paid_task_thread(
        &session.thread_id.to_string()
    ));
    let step = StepContext::for_test(turn);
    let mut client = session.services.model_client.new_session();
    for error in [
        CodexErr::ConnectionFailed(ConnectionFailedError {
            source: codex_http_client::HttpError::Timeout,
        }),
        CodexErr::Stream("synthetic interrupted stream".into()),
        CodexErr::InternalServerError,
        CodexErr::TurnAborted,
    ] {
        let expected = error.to_string();
        let mut state = ResponsesStreamRetryState::default();
        let result = tokio::time::timeout(
            Duration::from_millis(100),
            handle_response_stream_error(
                &mut state,
                0,
                error,
                &mut client,
                &session,
                &step,
                ResponsesStreamRequest::Sampling,
            ),
        )
        .await
        .expect("private error must not sleep or wait for a retry");
        assert_eq!(result.unwrap_err().to_string(), expected);
        assert_eq!(state.retries, 0);
        assert_eq!(state.connection_retries, 0);
        assert!(
            session.services.model_client.responses_websocket_enabled(),
            "zero-budget fallback must not mutate the selected transport"
        );
    }
}
