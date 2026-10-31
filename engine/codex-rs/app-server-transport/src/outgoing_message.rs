use std::fmt;

use codex_app_server_protocol::ClientResponsePayload;
use codex_app_server_protocol::JSONRPCErrorError;
use codex_app_server_protocol::RequestId;
use codex_app_server_protocol::ServerNotificationEnvelope;
use codex_app_server_protocol::ServerRequest;
use serde::Serialize;
use tokio::sync::oneshot;

/// Stable identifier for a transport connection.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub struct ConnectionId(pub u64);

impl fmt::Display for ConnectionId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Outgoing message from the server to the client.
#[derive(Debug, Clone, Serialize)]
#[serde(untagged)]
#[allow(clippy::large_enum_variant)]
pub enum OutgoingMessage {
    Request(ServerRequest),
    /// AppServerNotification is specific to the case where this is run as an
    /// "app server" as opposed to an MCP server.
    AppServerNotification(ServerNotificationEnvelope),
    Response(OutgoingResponse),
    Error(OutgoingError),
}

#[derive(Debug, Clone, Serialize)]
pub struct OutgoingResponse {
    pub id: RequestId,
    pub result: Box<ClientResponsePayload>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct OutgoingError {
    pub error: JSONRPCErrorError,
    pub id: RequestId,
}

/// Process-local write-admission fence. Never serialized or renewed for queued data.
#[derive(Clone, Debug)]
pub struct PrivateOutputFence(Vec<tokio_util::sync::CancellationToken>);
impl PrivateOutputFence {
    pub fn new(token: tokio_util::sync::CancellationToken) -> Self { Self(vec![token]) }
    pub fn with_token(mut self, token: tokio_util::sync::CancellationToken) -> Self { self.0.push(token); self }
    pub fn is_current(&self) -> bool { self.0.iter().all(|token| !token.is_cancelled()) }
}

#[derive(Debug)]
pub struct QueuedOutgoingMessage {
    pub message: OutgoingMessage,
    pub private_fence: Option<PrivateOutputFence>,
    pub write_complete_tx: Option<oneshot::Sender<()>>,
}

impl QueuedOutgoingMessage {
    pub fn new(message: OutgoingMessage) -> Self {
        Self {
            message,
            private_fence: None,
            write_complete_tx: None,
        }
    }
}

#[cfg(test)]
mod private_fence_tests {
    use super::*;
    #[test]
    fn fence_is_local_only_and_cancelled_payload_cannot_be_renewed() {
        let token = tokio_util::sync::CancellationToken::new();
        let message = OutgoingMessage::Error(OutgoingError { id: RequestId::Integer(1),
            error: JSONRPCErrorError { code: -32000, message: "fixture".into(), data: None } });
        let expected = serde_json::to_value(&message).unwrap();
        let mut queued = QueuedOutgoingMessage::new(message);
        queued.private_fence = Some(PrivateOutputFence::new(token.clone()));
        assert_eq!(serde_json::to_value(&queued.message).unwrap(),expected);
        assert!(queued.private_fence.as_ref().unwrap().is_current());
        token.cancel();
        assert!(!queued.private_fence.as_ref().unwrap().is_current());
        let fresh = PrivateOutputFence::new(tokio_util::sync::CancellationToken::new());
        assert!(fresh.is_current());
        assert!(!queued.private_fence.as_ref().unwrap().is_current());
        assert!(!expected.to_string().contains("fence"));
    }
}

/// Content-free settlement for an invalidated serialized response. Notifications
/// and requests are suppressed; no fields other than the original response ID survive.
pub(crate) fn unavailable_private_response(json: &str) -> Option<String> {
    let value: serde_json::Value = serde_json::from_str(json).ok()?;
    if value.get("method").is_some() || (value.get("result").is_none() && value.get("error").is_none()) { return None; }
    let id: RequestId = serde_json::from_value(value.get("id")?.clone()).ok()?;
    serde_json::to_string(&OutgoingError { id, error: JSONRPCErrorError {
        code: -32001, message: "Private work unavailable".into(), data: None,
    }}).ok()
}
