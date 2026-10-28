//! SC-1 bootstrap: the login transaction and ID-token sign-in.
//!
//! Bootstrap is its own pre-Workspace protocol, not an SC-2 command. The service
//! creates an expiring, one-use login transaction bound to an issuer, client and
//! redirect URI, with a service-chosen nonce. The native host runs the browser
//! flow (PKCE stays with the host), then submits the issuer's ID token together
//! with the transaction proof. The service validates the token itself and, in one
//! transaction, consumes the login transaction and creates the session.

use crate::rfc3339_millis;
use chrono::DateTime;
use chrono::Utc;
use serde::Deserialize;
use serde::Serialize;
use std::fmt;
use uuid::Uuid;

/// A secret string on the wire: an access or refresh credential, a login
/// transaction proof or an ID token. Its `Debug` output is redacted so it cannot
/// leak through logs or error formatting.
#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Credential(String);

impl Credential {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }

    /// The raw secret. Callers must not log or persist it.
    pub fn expose(&self) -> &str {
        &self.0
    }
}

impl fmt::Debug for Credential {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Credential(<redacted>)")
    }
}

/// `POST /v1/login/transactions`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateLoginTransactionRequest {
    pub issuer: String,
    pub client_id: String,
    pub redirect_uri: String,
    /// The opaque installation ID the session will be bound to.
    pub device_id: Uuid,
}

/// The created login transaction. `transaction_proof` is returned once and is
/// needed to bootstrap or abandon the transaction; the service stores only its
/// SHA-256 hash.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LoginTransaction {
    pub login_transaction_id: Uuid,
    pub transaction_proof: Credential,
    /// The nonce the host must send in the authorization request.
    pub nonce: String,
    pub issuer: String,
    pub client_id: String,
    pub redirect_uri: String,
    pub device_id: Uuid,
    #[serde(with = "rfc3339_millis")]
    pub expires_at: DateTime<Utc>,
}

/// `POST /v1/login/bootstrap`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BootstrapRequest {
    pub login_transaction_id: Uuid,
    pub transaction_proof: Credential,
    /// Must equal the redirect URI the transaction was created for.
    pub redirect_uri: String,
    /// The issuer's signed ID token, exactly as received.
    pub id_token: Credential,
}

/// The credentials of a newly created or refreshed session. The access
/// credential is opaque and short-lived; the refresh credential rotates on every
/// use.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SessionCredentials {
    pub session_id: Uuid,
    pub principal_id: Uuid,
    pub access_credential: Credential,
    #[serde(with = "rfc3339_millis")]
    pub access_expires_at: DateTime<Utc>,
    pub refresh_credential: Credential,
    #[serde(with = "rfc3339_millis")]
    pub refresh_expires_at: DateTime<Utc>,
    #[serde(with = "rfc3339_millis")]
    pub session_expires_at: DateTime<Utc>,
}

/// `POST /v1/login/abandon`: used when a bootstrap response was lost. It closes
/// an open transaction, or revokes the session the transaction created, so the
/// host can start a fresh sign-in instead of replaying bootstrap.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AbandonLoginRequest {
    pub login_transaction_id: Uuid,
    pub transaction_proof: Credential,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AbandonStatus {
    Abandoned,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AbandonLoginResponse {
    pub login_transaction_id: Uuid,
    pub status: AbandonStatus,
}
