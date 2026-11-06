//! Owned OAuth callback sockets, including idle and partial HTTP connections.
use std::future::Future;
use std::io;
use std::net::SocketAddr;
use std::pin::Pin;
use std::sync::Arc;
use std::sync::Mutex;
use std::task::Context;
use std::task::Poll;

use axum::Router;
use axum::extract::ConnectInfo;
use axum::extract::Request;
use axum::extract::connect_info::Connected;
use axum::http::StatusCode;
use axum::http::header::CONNECTION;
use tokio::io::AsyncRead;
use tokio::io::AsyncWrite;
use tokio::io::ReadBuf;
use tokio::net::TcpListener;
use tokio::net::TcpStream;
use tokio::sync::oneshot;
use tokio_util::sync::CancellationToken;

use super::CallbackOutcome;
use super::CallbackResult;
use super::parse_oauth_callback;
use super::send_oauth_callback;

pub(super) struct CallbackServerGuard {
    shutdown: CancellationToken,
}

impl Drop for CallbackServerGuard {
    fn drop(&mut self) {
        self.shutdown.cancel();
    }
}

type PendingCallback = Option<(oneshot::Sender<CallbackResult>, CallbackResult)>;

#[derive(Clone)]
struct CallbackPeer {
    _addr: SocketAddr,
    pending: Arc<Mutex<PendingCallback>>,
}

// Never format the pending callback (authorization code/state) in server diagnostics.
impl std::fmt::Debug for CallbackPeer {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        std::fmt::Debug::fmt(&self._addr, f)
    }
}

impl Connected<axum::serve::IncomingStream<'_, CallbackListener>> for CallbackPeer {
    fn connect_info(stream: axum::serve::IncomingStream<'_, CallbackListener>) -> Self {
        stream.remote_addr().clone()
    }
}

struct CallbackListener {
    listener: TcpListener,
    shutdown: CancellationToken,
}

struct CallbackStream {
    stream: TcpStream,
    cancelled: Pin<Box<dyn Future<Output = ()> + Send>>,
    cancellation_observed: bool,
    pending: Arc<Mutex<PendingCallback>>,
}

impl axum::serve::Listener for CallbackListener {
    type Io = CallbackStream;
    type Addr = CallbackPeer;

    async fn accept(&mut self) -> (Self::Io, Self::Addr) {
        loop {
            match self.listener.accept().await {
                Ok((stream, addr)) => {
                    let pending = Arc::new(Mutex::new(None));
                    return (
                        CallbackStream {
                            stream,
                            cancelled: Box::pin(self.shutdown.clone().cancelled_owned()),
                            cancellation_observed: false,
                            pending: Arc::clone(&pending),
                        },
                        CallbackPeer {
                            _addr: addr,
                            pending,
                        },
                    );
                }
                Err(_) => tokio::time::sleep(std::time::Duration::from_millis(10)).await,
            }
        }
    }

    fn local_addr(&self) -> io::Result<Self::Addr> {
        Ok(CallbackPeer {
            _addr: self.listener.local_addr()?,
            pending: Arc::new(Mutex::new(None)),
        })
    }
}

impl CallbackStream {
    fn poll_cancelled(&mut self, cx: &mut Context<'_>) -> bool {
        if !self.cancellation_observed {
            self.cancellation_observed = self.cancelled.as_mut().poll(cx).is_ready();
        }
        self.cancellation_observed
    }
}

impl AsyncRead for CallbackStream {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        if self.poll_cancelled(cx) {
            return Poll::Ready(Err(io::ErrorKind::ConnectionAborted.into()));
        }
        Pin::new(&mut self.stream).poll_read(cx, buf)
    }
}

impl AsyncWrite for CallbackStream {
    fn poll_write(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>> {
        if self.poll_cancelled(cx) {
            return Poll::Ready(Err(io::ErrorKind::ConnectionAborted.into()));
        }
        Pin::new(&mut self.stream).poll_write(cx, buf)
    }

    fn poll_flush(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        if self.poll_cancelled(cx) {
            return Poll::Ready(Err(io::ErrorKind::ConnectionAborted.into()));
        }
        Pin::new(&mut self.stream).poll_flush(cx)
    }

    fn poll_shutdown(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        let result = Pin::new(&mut self.stream).poll_shutdown(cx);
        if let Poll::Ready(Ok(())) = &result {
            // Connection: close makes Hyper flush the response before shutdown.
            // Only then deliver the callback: a fast token exchange must not
            // cancel its own browser response before it has been written.
            if let Some((tx, callback)) = self
                .pending
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .take()
            {
                let _ = send_oauth_callback(tx, callback);
            }
        }
        result
    }
}

pub(super) fn spawn_callback_server(
    listener: TcpListener,
    tx: oneshot::Sender<CallbackResult>,
    expected_callback_path: String,
    closed: CancellationToken,
) -> CallbackServerGuard {
    let shutdown = CancellationToken::new();
    let guard = CallbackServerGuard {
        shutdown: shutdown.clone(),
    };
    let listener = CallbackListener {
        listener,
        shutdown: shutdown.clone(),
    };
    let tx = Arc::new(Mutex::new(Some(tx)));
    let app = Router::new().fallback(
        move |ConnectInfo(peer): ConnectInfo<CallbackPeer>, request: Request| {
            let tx = Arc::clone(&tx);
            let expected = expected_callback_path.clone();
            async move {
                let path = request
                    .uri()
                    .path_and_query()
                    .map_or("", |value| value.as_str());
                let outcome = parse_oauth_callback(path, &expected);
                let mut tx = tx.lock().unwrap_or_else(|e| e.into_inner());
                let (status, message, callback) = if tx.is_none() {
                    (
                        StatusCode::GONE,
                        "OAuth callback already received".to_string(),
                        None,
                    )
                } else {
                    match outcome {
                        CallbackOutcome::Invalid => (
                            StatusCode::BAD_REQUEST,
                            "Invalid OAuth callback".to_string(),
                            None,
                        ),
                        CallbackOutcome::Success(callback) => (
                            StatusCode::OK,
                            "Authentication complete. You may close this window.".to_string(),
                            Some(CallbackResult::Success(callback)),
                        ),
                        CallbackOutcome::Error(error) => (
                            StatusCode::BAD_REQUEST,
                            error.to_string(),
                            Some(CallbackResult::Error(error)),
                        ),
                    }
                };
                if let Some(callback) = callback {
                    // The sender is consumed once globally, but its delivery belongs
                    // to this connection, never another connection's response.
                    if let Some(tx) = tx.take() {
                        *peer.pending.lock().unwrap_or_else(|e| e.into_inner()) =
                            Some((tx, callback));
                    }
                }
                (status, [(CONNECTION, "close")], message)
            }
        },
    );
    tokio::spawn(async move {
        // Axum waits for all connection tasks. Cancellation-aware I/O wakes
        // idle/partial readers as well; closure is published only afterwards.
        let _closed = closed.drop_guard();
        let _ = axum::serve(
            listener,
            app.into_make_service_with_connect_info::<CallbackPeer>(),
        )
        .with_graceful_shutdown(shutdown.cancelled_owned())
        .await;
    });
    guard
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;
    use tokio::io::AsyncReadExt;
    use tokio::io::AsyncWriteExt;
    use tokio::time::timeout;

    async fn start() -> (
        SocketAddr,
        CallbackServerGuard,
        CancellationToken,
        oneshot::Receiver<CallbackResult>,
    ) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let (tx, rx) = oneshot::channel();
        let closed = CancellationToken::new();
        let guard = spawn_callback_server(listener, tx, "/callback".to_string(), closed.clone());
        (addr, guard, closed, rx)
    }

    async fn request(addr: SocketAddr, path: &str) -> String {
        let mut stream = TcpStream::connect(addr).await.unwrap();
        stream
            .write_all(format!("GET {path} HTTP/1.1\r\nHost: {addr}\r\n\r\n").as_bytes())
            .await
            .unwrap();
        let mut response = String::new();
        timeout(Duration::from_secs(2), stream.read_to_string(&mut response))
            .await
            .unwrap()
            .unwrap();
        response
    }

    async fn assert_closed(stream: &mut TcpStream) {
        let mut byte = [0];
        match timeout(Duration::from_secs(2), stream.read(&mut byte)).await {
            Ok(Ok(0)) | Ok(Err(_)) => {}
            other => panic!("callback socket remained open: {other:?}"),
        }
    }

    #[tokio::test]
    async fn cancellation_closes_listener_idle_and_partial_connections_and_releases_port() {
        for _ in 0..4 {
            let (addr, guard, closed, rx) = start().await;
            let mut idle = TcpStream::connect(addr).await.unwrap();
            let mut partial = TcpStream::connect(addr).await.unwrap();
            partial
                .write_all(b"GET /callback HTTP/1.1\r\nHost:")
                .await
                .unwrap();
            // An independently served request proves the accept loop is running.
            assert!(request(addr, "/invalid").await.starts_with("HTTP/1.1 400"));
            drop(guard);
            timeout(Duration::from_secs(2), closed.cancelled())
                .await
                .unwrap();
            assert_closed(&mut idle).await;
            assert_closed(&mut partial).await;
            assert!(
                TcpStream::connect(addr).await.is_err(),
                "listener survived shutdown"
            );
            assert!(rx.await.is_err());
            let rebound = TcpListener::bind(addr)
                .await
                .expect("same port is immediately reusable");
            drop(rebound);
        }
    }

    #[tokio::test]
    async fn cancellation_wakes_a_proven_accepted_partial_reader() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let mut client = TcpStream::connect(listener.local_addr().unwrap())
            .await
            .unwrap();
        let (server, _) = listener.accept().await.unwrap();
        let cancel = CancellationToken::new();
        let mut stream = CallbackStream {
            stream: server,
            cancelled: Box::pin(cancel.clone().cancelled_owned()),
            cancellation_observed: false,
            pending: Arc::new(Mutex::new(None)),
        };
        client.write_all(b"GET /").await.unwrap();
        let mut first = [0; 5];
        stream.read_exact(&mut first).await.unwrap();
        assert_eq!(&first, b"GET /");
        let read = tokio::spawn(async move {
            let mut rest = Vec::new();
            stream.read_to_end(&mut rest).await
        });
        cancel.cancel();
        assert!(
            timeout(Duration::from_secs(2), read)
                .await
                .unwrap()
                .unwrap()
                .is_err()
        );
        assert_closed(&mut client).await;
    }

    #[tokio::test]
    async fn callback_response_is_delivered_and_keep_alive_is_closed_before_result() {
        let (addr, guard, closed, mut rx) = start().await;
        assert!(
            request(addr, "/not-callback?code=wrong&state=wrong")
                .await
                .starts_with("HTTP/1.1 400")
        );
        assert!(matches!(
            rx.try_recv(),
            Err(oneshot::error::TryRecvError::Empty)
        ));
        let response = request(
            addr,
            "/callback?code=test&state=state&iss=https%3A%2F%2Fissuer.example",
        )
        .await;
        assert!(response.starts_with("HTTP/1.1 200"));
        assert!(response.ends_with("Authentication complete. You may close this window."));
        assert!(matches!(rx.await.unwrap(), CallbackResult::Success(_)));
        assert!(
            request(addr, "/callback?code=late&state=late")
                .await
                .starts_with("HTTP/1.1 410")
        );
        drop(guard);
        timeout(Duration::from_secs(2), closed.cancelled())
            .await
            .unwrap();
        assert!(TcpStream::connect(addr).await.is_err());
    }

    #[tokio::test]
    async fn provider_error_response_is_delivered_before_terminal_result() {
        let (addr, guard, closed, rx) = start().await;
        let response = request(addr, "/callback?error=access_denied").await;
        assert!(response.starts_with("HTTP/1.1 400"));
        assert!(response.contains("access_denied"));
        assert!(matches!(rx.await.unwrap(), CallbackResult::Error(_)));
        drop(guard);
        timeout(Duration::from_secs(2), closed.cancelled())
            .await
            .unwrap();
    }
}
