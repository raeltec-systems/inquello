//! Native Messages, not a translating gateway or a tool executor.
mod auth;
mod request;
mod stream;
pub use auth::{AttemptLease, AuthScope, AuthStore};
pub use request::encode_request;
pub use stream::MessagesDecoder;
use eventsource_stream::Eventsource;
use futures::StreamExt;
use inquello_protocol::inference::{ErrorKind, Event, InferenceRequest, CLAUDE_API_VERSION};
use std::time::Duration;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

pub const ENDPOINT: &str = "https://api.anthropic.com/v1/messages";
pub struct MessagesClient { client: reqwest::Client, endpoint: String }
impl MessagesClient {
    pub fn production() -> Result<Self, &'static str> {
        let client = reqwest::Client::builder().retry(reqwest::retry::never()).redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_secs(15)).timeout(Duration::from_secs(300))
            .https_only(true).no_proxy().build().map_err(|_| "Messages transport unavailable")?;
        Ok(Self { client, endpoint: ENDPOINT.into() })
    }
    /// No production endpoint override exists, including in unpackaged builds.
    #[cfg(any(test, feature = "inference-fixtures"))]
    fn fixture(endpoint: &str, certificate: reqwest::Certificate) -> Result<Self, &'static str> {
        let url = reqwest::Url::parse(endpoint).map_err(|_| "invalid fixture endpoint")?;
        if url.scheme() != "https" || !matches!(url.host_str(), Some("127.0.0.1" | "[::1]" | "localhost"))
            || url.path() != "/v1/messages" || url.query().is_some() || url.fragment().is_some()
            || !url.username().is_empty() || url.password().is_some() { return Err("non-loopback fixture refused"); }
        let client = reqwest::Client::builder().retry(reqwest::retry::never()).redirect(reqwest::redirect::Policy::none()).https_only(true)
            .no_proxy().add_root_certificate(certificate).timeout(Duration::from_secs(10)).build()
            .map_err(|_| "fixture transport unavailable")?;
        Ok(Self { client, endpoint: endpoint.into() })
    }
    #[cfg(feature = "inference-fixtures")]
    pub fn fixture_from_der(endpoint: &str, certificate: &[u8]) -> Result<Self, &'static str> {
        let certificate = reqwest::Certificate::from_der(certificate).map_err(|_| "invalid synthetic fixture CA")?;
        Self::fixture(endpoint, certificate)
    }
    pub async fn stream(&self, request: InferenceRequest, lease: AttemptLease) -> Result<mpsc::Receiver<Event>, &'static str> {
        self.stream_with_cancellation(request, lease, CancellationToken::new()).await
    }
    /// The caller's authority token is observed by the transport itself, including
    /// before dispatch and while awaiting headers. Dropping the receiver also ends
    /// local HTTP work; neither cancellation path asserts remote rollback.
    pub async fn stream_with_cancellation(&self, request: InferenceRequest, lease: AttemptLease,
        authority: CancellationToken) -> Result<mpsc::Receiver<Event>, &'static str> {
        if authority.is_cancelled() { return Err("inference attempt cancelled before dispatch"); }
        if lease.binding() != &request.binding || !lease.is_current() { return Err("stale inference authority"); }
        let body = encode_request(&request)?;
        let builder = self.client.post(&self.endpoint).header("anthropic-version", CLAUDE_API_VERSION)
            .header("accept", "text/event-stream").json(&body);
        let builder = lease.authorize(builder)?;
        let cancellation = lease.cancellation();
        let (sender, receiver) = mpsc::channel(32);
        tokio::spawn(async move {
            // Keep lease alive until terminal delivery/drop; no transport retry.
            let mut decoder = MessagesDecoder::new(request.clone(), None);
            let response = tokio::select! {
                biased;
                _ = authority.cancelled() => { cancellation.cancel(); return; }
                _ = cancellation.cancelled() => return,
                _ = sender.closed() => { cancellation.cancel(); return; }
                response = builder.send() => response,
            };
            let response = match response {
                Ok(response) => response,
                Err(_) => { send_failure(&sender, &authority, &cancellation, &mut decoder, ErrorKind::Transport, true).await; return; }
            };
            let request_id = response.headers().get("request-id").and_then(|v| v.to_str().ok()).map(str::to_string);
            decoder = MessagesDecoder::new(request, request_id);
            if !response.status().is_success() {
                let kind = match response.status().as_u16() {
                    401 | 403 => ErrorKind::Auth, 402 => ErrorKind::CreditLimit, 429 => ErrorKind::RateLimit,
                    500..=599 => ErrorKind::ProviderUnavailable, _ => ErrorKind::InvalidRequest,
                };
                send_failure(&sender, &authority, &cancellation, &mut decoder, kind, false).await;
                return;
            }
            if response.headers().get("content-type").and_then(|v| v.to_str().ok())
                .is_none_or(|value| !value.starts_with("text/event-stream")) {
                send_failure(&sender, &authority, &cancellation, &mut decoder, ErrorKind::MalformedStream, true).await;
                return;
            }
            // Bound the raw stream before the SSE parser can accumulate an oversized line.
            let bounded = response.bytes_stream().scan(0usize, |total, chunk| {
                let result = match chunk {
                    Ok(chunk) => {
                        *total = total.saturating_add(chunk.len());
                        if *total > inquello_protocol::inference::MAX_CONTENT_BYTES {
                            Err(std::io::Error::other("Messages stream size limit"))
                        } else { Ok(chunk) }
                    }
                    Err(_) => Err(std::io::Error::other("Messages transport failed")),
                };
                futures::future::ready(Some(result))
            });
            let mut stream = bounded.eventsource();
            loop {
                let next = tokio::select! {
                    biased;
                    _ = authority.cancelled() => { cancellation.cancel(); break; }
                    _ = cancellation.cancelled() => break,
                    _ = sender.closed() => { cancellation.cancel(); break; },
                    event = tokio::time::timeout(Duration::from_secs(60), stream.next()) => event,
                };
                let events = match next {
                    Ok(Some(Ok(event))) => decoder.push(&event.event, &event.data),
                    Ok(None) => { if let Some(event) = decoder.finish() { let _ = send_event(&sender, event, &authority, &cancellation).await; } break; }
                    _ => Err(ErrorKind::Transport),
                };
                match events {
                    Ok(events) => {
                        for event in events {
                            if !lease.is_current() { send_failure(&sender, &authority, &cancellation, &mut decoder, ErrorKind::Cancelled, true).await; return; }
                            let sent = send_event(&sender, event, &authority, &cancellation).await;
                            if !sent { return; }
                        }
                        if decoder.terminal() { break; }
                    }
                    Err(error) => { send_failure(&sender, &authority, &cancellation, &mut decoder, error, true).await; break; }
                }
            }
        });
        Ok(receiver)
    }
}
async fn send_event(sender: &mpsc::Sender<Event>, event: Event, authority: &CancellationToken,
    cancellation: &CancellationToken) -> bool {
    let permit = tokio::select! {
        biased;
        _ = authority.cancelled() => { cancellation.cancel(); return false; }
        _ = cancellation.cancelled() => return false,
        permit = sender.reserve() => match permit { Ok(permit) => permit, Err(_) => { cancellation.cancel(); return false; } },
    };
    if authority.is_cancelled() || cancellation.is_cancelled() { cancellation.cancel(); return false; }
    permit.send(event);
    true
}
async fn send_failure(sender: &mpsc::Sender<Event>, authority: &CancellationToken,
    cancellation: &CancellationToken, decoder: &mut MessagesDecoder, error: ErrorKind, uncertain: bool) {
    if let Some(event) = decoder.fail(error, uncertain) { let _ = send_event(sender, event, authority, cancellation).await; }
}

#[cfg(test)]
mod tests;
