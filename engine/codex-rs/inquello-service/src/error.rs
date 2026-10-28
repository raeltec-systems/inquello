//! API errors: an SC-2 error kind plus a static, credential-free reason for logs.
//!
//! The response body carries only the kind and its fixed message
//! ([`inquello_protocol::error::ErrorBody`]); the reason is logged and never sent,
//! so a client cannot learn whether an inaccessible resource exists. A
//! Workspace-scoped refusal also sends its [`DenyReason`], which names only the
//! caller's missing authority.

use crate::postgres::error_category;
use axum::Json;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::response::Response;
use inquello_domain::authorization::DenyReason;
use inquello_protocol::error::ErrorBody;
use inquello_protocol::error::ErrorKind;
use inquello_protocol::workspace::DenyReason as WireDenyReason;

#[derive(Debug)]
pub(crate) struct ApiError {
    pub(crate) kind: ErrorKind,
    reason: &'static str,
    /// The Workspace deny reason sent in the body, if any.
    pub(crate) deny: Option<DenyReason>,
}

fn wire_reason(reason: DenyReason) -> WireDenyReason {
    match reason {
        DenyReason::NotSignedIn => WireDenyReason::NotSignedIn,
        DenyReason::NotAMember => WireDenyReason::NotAMember,
        DenyReason::RoleLacksAction => WireDenyReason::RoleLacksAction,
        DenyReason::NoGrant => WireDenyReason::NoGrant,
        DenyReason::NotTheCreator => WireDenyReason::NotTheCreator,
        DenyReason::RouteNotAvailable => WireDenyReason::RouteNotAvailable,
    }
}

impl ApiError {
    pub(crate) fn new(kind: ErrorKind, reason: &'static str) -> Self {
        Self {
            kind,
            reason,
            deny: None,
        }
    }

    /// A Workspace-scoped refusal with its reason from the fixed set:
    /// `unauthenticated` for `not_signed_in`, otherwise `denied`.
    pub(crate) fn refused(reason: DenyReason) -> Self {
        let kind = match reason {
            DenyReason::NotSignedIn => ErrorKind::Unauthenticated,
            _ => ErrorKind::Denied,
        };
        Self {
            kind,
            reason: reason.as_str(),
            deny: Some(reason),
        }
    }

    /// On a Workspace route, a failed sign-in check carries `not_signed_in`.
    pub(crate) fn on_workspace_route(self) -> Self {
        if self.kind == ErrorKind::Unauthenticated && self.deny.is_none() {
            tracing::info!(reason = self.reason, "workspace request not signed in");
            Self::refused(DenyReason::NotSignedIn)
        } else {
            self
        }
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
        let body = match self.deny {
            Some(reason) => ErrorBody::refused(wire_reason(reason)),
            None => ErrorBody::new(self.kind),
        };
        (status, Json(body)).into_response()
    }
}
