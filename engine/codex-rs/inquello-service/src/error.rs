//! API errors: an SC-2 error kind plus a static, credential-free reason for logs.
//!
//! The response body carries only the kind and its fixed message
//! ([`inquello_protocol::error::ErrorBody`]); the reason is logged and never sent,
//! so a client cannot learn whether an inaccessible resource exists.

use crate::postgres::error_category;
use axum::Json;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::response::Response;
use inquello_protocol::error::ErrorBody;
use inquello_protocol::error::ErrorKind;

#[derive(Debug)]
pub(crate) struct ApiError {
    pub(crate) kind: ErrorKind,
    reason: &'static str,
}

impl ApiError {
    pub(crate) fn new(kind: ErrorKind, reason: &'static str) -> Self {
        Self { kind, reason }
    }

    pub(crate) fn unauthenticated(reason: &'static str) -> Self {
        Self::new(ErrorKind::Unauthenticated, reason)
    }

    pub(crate) fn denied(reason: &'static str) -> Self {
        Self::new(ErrorKind::Denied, reason)
    }

    pub(crate) fn version_conflict(reason: &'static str) -> Self {
        Self::new(ErrorKind::VersionConflict, reason)
    }

    pub(crate) fn unsupported_contract(reason: &'static str) -> Self {
        Self::new(ErrorKind::UnsupportedContract, reason)
    }

    /// A database failure: the authority is unavailable, so the request is blocked.
    pub(crate) fn dependency(error: &sqlx::Error) -> Self {
        tracing::warn!(
            category = %error_category(error),
            "authority database unavailable; request blocked"
        );
        Self::new(ErrorKind::DependencyUnavailable, "database unavailable")
    }

    /// A commit whose outcome is unknown.
    pub(crate) fn uncertain(error: &sqlx::Error) -> Self {
        tracing::warn!(
            category = %error_category(error),
            "commit outcome unknown"
        );
        Self::new(ErrorKind::UncertainOutcome, "commit outcome unknown")
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(error: sqlx::Error) -> Self {
        Self::dependency(&error)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        tracing::info!(kind = ?self.kind, reason = self.reason, "request refused");
        let status = StatusCode::from_u16(self.kind.http_status())
            .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
        (status, Json(ErrorBody::new(self.kind))).into_response()
    }
}
