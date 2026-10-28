//! SC-2 error kinds and the error body.
//!
//! Error messages are fixed per kind. They never echo request content, never carry
//! a credential and never confirm whether an inaccessible resource exists.

use serde::Deserialize;
use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorKind {
    Unauthenticated,
    Denied,
    VersionConflict,
    UnsupportedContract,
    IncompleteMaterial,
    DependencyUnavailable,
    UncertainOutcome,
}

impl ErrorKind {
    pub const ALL: [ErrorKind; 7] = [
        ErrorKind::Unauthenticated,
        ErrorKind::Denied,
        ErrorKind::VersionConflict,
        ErrorKind::UnsupportedContract,
        ErrorKind::IncompleteMaterial,
        ErrorKind::DependencyUnavailable,
        ErrorKind::UncertainOutcome,
    ];

    /// The HTTP status the service answers with.
    pub const fn http_status(self) -> u16 {
        match self {
            ErrorKind::Unauthenticated => 401,
            ErrorKind::Denied => 403,
            ErrorKind::VersionConflict => 409,
            ErrorKind::UnsupportedContract => 400,
            ErrorKind::IncompleteMaterial => 422,
            ErrorKind::DependencyUnavailable => 503,
            ErrorKind::UncertainOutcome => 500,
        }
    }

    /// The one message the service sends for this kind.
    pub const fn message(self) -> &'static str {
        match self {
            ErrorKind::Unauthenticated => "sign-in is required",
            ErrorKind::Denied => "the request is not permitted",
            ErrorKind::VersionConflict => {
                "the request conflicts with the current state or an earlier operation; reload and review"
            }
            ErrorKind::UnsupportedContract => "the request does not match a supported contract",
            ErrorKind::IncompleteMaterial => "the request is missing required material",
            ErrorKind::DependencyUnavailable => "a required dependency is unavailable",
            ErrorKind::UncertainOutcome => {
                "the outcome is uncertain; look up the operation receipt before retrying"
            }
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ErrorDetail {
    pub kind: ErrorKind,
    pub message: String,
}

/// The body of every error response.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ErrorBody {
    pub error: ErrorDetail,
}

impl ErrorBody {
    pub fn new(kind: ErrorKind) -> Self {
        Self {
            error: ErrorDetail {
                kind,
                message: kind.message().to_string(),
            },
        }
    }
}
