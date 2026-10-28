//! HTTPS termination: a [`Listener`] that completes each TLS handshake off the
//! accept loop and hands axum only established TLS streams.
//!
//! The server speaks HTTP/1.1 only (ALPN `http/1.1`) with rustls' safe default
//! protocol versions and the aws-lc-rs provider. A handshake that fails or takes
//! longer than [`HANDSHAKE_TIMEOUT`] is dropped; its error never reaches a
//! response.

use crate::config::TlsConfig;
use axum::serve::Listener;
use std::io;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::net::TcpListener;
use tokio::net::TcpStream;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use tokio_rustls::TlsAcceptor;
use tokio_rustls::server::TlsStream;

/// How long a client may take to complete the TLS handshake.
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(10);

/// Established connections waiting for axum.
const ACCEPT_QUEUE: usize = 64;

/// Why the TLS server configuration was refused.
#[derive(Debug, thiserror::Error)]
#[error("TLS server configuration refused: {0}")]
pub struct TlsSetupError(String);

/// Builds the rustls server configuration for `tls`.
pub(crate) fn server_config(tls: &TlsConfig) -> Result<Arc<rustls::ServerConfig>, TlsSetupError> {
    let provider = Arc::new(rustls::crypto::aws_lc_rs::default_provider());
    let mut config = rustls::ServerConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()
        .map_err(|error| TlsSetupError(error.to_string()))?
        .with_no_client_auth()
        .with_single_cert(tls.cert_chain.clone(), tls.private_key.clone_key())
        .map_err(|error| TlsSetupError(error.to_string()))?;
    config.alpn_protocols = vec![b"http/1.1".to_vec()];
    Ok(Arc::new(config))
}

/// A TCP listener whose accepted connections are TLS streams.
pub(crate) struct TlsListener {
    established: mpsc::Receiver<(TlsStream<TcpStream>, SocketAddr)>,
    local_addr: SocketAddr,
    accept_task: JoinHandle<()>,
}

impl TlsListener {
    pub(crate) fn new(
        listener: TcpListener,
        config: Arc<rustls::ServerConfig>,
    ) -> io::Result<Self> {
        let local_addr = listener.local_addr()?;
        let acceptor = TlsAcceptor::from(config);
        let (sender, established) = mpsc::channel(ACCEPT_QUEUE);
        let accept_task = tokio::spawn(async move {
            loop {
                let (tcp, peer) = match listener.accept().await {
                    Ok(accepted) => accepted,
                    Err(error) => {
                        tracing::warn!(kind = ?error.kind(), "TCP accept failed");
                        tokio::time::sleep(Duration::from_millis(50)).await;
                        continue;
                    }
                };
                if sender.is_closed() {
                    break;
                }
                let acceptor = acceptor.clone();
                let sender = sender.clone();
                tokio::spawn(async move {
                    match tokio::time::timeout(HANDSHAKE_TIMEOUT, acceptor.accept(tcp)).await {
                        Ok(Ok(stream)) => {
                            let _ = sender.send((stream, peer)).await;
                        }
                        Ok(Err(error)) => {
                            tracing::debug!(kind = ?error.kind(), "TLS handshake failed");
                        }
                        Err(_) => tracing::debug!("TLS handshake timed out"),
                    }
                });
            }
        });
        Ok(Self {
            established,
            local_addr,
            accept_task,
        })
    }
}

impl Drop for TlsListener {
    fn drop(&mut self) {
        self.accept_task.abort();
    }
}

impl Listener for TlsListener {
    type Io = TlsStream<TcpStream>;
    type Addr = SocketAddr;

    async fn accept(&mut self) -> (Self::Io, Self::Addr) {
        match self.established.recv().await {
            Some(established) => established,
            // The accept task only ends when the listener is being dropped.
            None => std::future::pending().await,
        }
    }

    fn local_addr(&self) -> io::Result<Self::Addr> {
        Ok(self.local_addr)
    }
}
