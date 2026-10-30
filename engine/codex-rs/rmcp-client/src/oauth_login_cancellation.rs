//! Arbitration for runtime-owned MCP sign-in. Cancellation and credential
//! persistence share one lock: a successful cancellation can never be followed
//! by a write from that attempt. A write already in progress wins instead.
use anyhow::Result;
use anyhow::bail;
use std::future::Future;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OAuthLoginState {
    Pending,
    Cancelled,
    Completed,
    Failed,
}

#[derive(Clone)]
pub struct OAuthLoginCancellation {
    state: Arc<Mutex<OAuthLoginState>>,
    cancelled: CancellationToken,
}

impl Default for OAuthLoginCancellation {
    fn default() -> Self {
        Self {
            state: Arc::new(Mutex::new(OAuthLoginState::Pending)),
            cancelled: CancellationToken::new(),
        }
    }
}

impl OAuthLoginCancellation {
    pub async fn state(&self) -> OAuthLoginState {
        *self.state.lock().await
    }

    /// Returns the actual terminal state. In particular, never reports a
    /// cancellation while a credential write is in flight or has completed.
    pub async fn cancel(&self) -> OAuthLoginState {
        let mut state = self.state.lock().await;
        if *state == OAuthLoginState::Pending {
            *state = OAuthLoginState::Cancelled;
            self.cancelled.cancel();
        }
        *state
    }

    pub(crate) async fn cancelled(&self) {
        self.cancelled.cancelled().await;
    }

    pub(crate) async fn fail(&self) {
        let mut state = self.state.lock().await;
        if *state == OAuthLoginState::Pending {
            *state = OAuthLoginState::Failed;
        }
    }

    #[allow(
        clippy::await_holding_invalid_type,
        reason = "credential persistence and cancellation must retain one exclusive gate through the write"
    )]
    pub(crate) async fn persist<F>(&self, write: F) -> Result<()>
    where
        F: Future<Output = Result<()>>,
    {
        let mut state = self.state.lock().await;
        if *state != OAuthLoginState::Pending {
            bail!("MCP OAuth sign-in is no longer pending");
        }
        // Do not abort this future or release the guard during the write.
        // Keyring writes may use blocking workers, so dropping their future is
        // not a safe way to promise that persistence was cancelled.
        let result = write.await;
        *state = if result.is_ok() {
            OAuthLoginState::Completed
        } else {
            OAuthLoginState::Failed
        };
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;
    use std::sync::atomic::Ordering;
    use tokio::sync::oneshot;

    #[tokio::test]
    async fn cancellation_prevents_late_completion_from_writing_credentials() {
        let login = OAuthLoginCancellation::default();
        let writes = AtomicUsize::new(0);
        assert_eq!(login.cancel().await, OAuthLoginState::Cancelled);
        // A late provider result tries to persist after cancellation succeeded.
        assert!(login.persist(async {
            writes.fetch_add(1, Ordering::SeqCst);
            Ok(())
        }).await.is_err());
        assert_eq!(writes.load(Ordering::SeqCst), 0);
        login.fail().await;
        assert_eq!(login.state().await, OAuthLoginState::Cancelled);
    }

    #[tokio::test]
    async fn an_in_progress_write_wins_and_cancel_reports_completed() {
        let login = OAuthLoginCancellation::default();
        let writer = login.clone();
        let writes = Arc::new(AtomicUsize::new(0));
        let stored = Arc::clone(&writes);
        let (entered_tx, entered_rx) = oneshot::channel();
        let (release_tx, release_rx) = oneshot::channel();
        let writing = tokio::spawn(async move {
            writer.persist(async move {
                let _ = entered_tx.send(());
                let _ = release_rx.await;
                stored.fetch_add(1, Ordering::SeqCst);
                Ok(())
            }).await
        });
        assert!(entered_rx.await.is_ok());
        let cancelling = tokio::spawn(async move { login.cancel().await });
        tokio::task::yield_now().await;
        assert!(!cancelling.is_finished());
        assert!(release_tx.send(()).is_ok());
        assert!(matches!(writing.await, Ok(Ok(()))));
        assert!(matches!(cancelling.await, Ok(OAuthLoginState::Completed)));
        assert_eq!(writes.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn failed_write_and_completed_write_are_not_claimed_as_cancelled() {
        let failed = OAuthLoginCancellation::default();
        assert!(failed.persist(async { bail!("isolated store unavailable") }).await.is_err());
        assert_eq!(failed.cancel().await, OAuthLoginState::Failed);
        let completed = OAuthLoginCancellation::default();
        assert!(completed.persist(async { Ok(()) }).await.is_ok());
        assert_eq!(completed.cancel().await, OAuthLoginState::Completed);
    }

    #[tokio::test]
    async fn cancellation_wakes_the_callback_wait_without_external_credentials() {
        let login = OAuthLoginCancellation::default();
        let waiting = login.clone();
        let worker = tokio::spawn(async move {
            tokio::select! {
                biased;
                _ = waiting.cancelled() => false,
                _ = std::future::pending::<()>() => true,
            }
        });
        assert_eq!(login.cancel().await, OAuthLoginState::Cancelled);
        assert!(matches!(worker.await, Ok(false)));
    }
}
