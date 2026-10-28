//! SC-1 sessions: refresh, family revoke, and the session and membership views.

use crate::Revision;
use crate::login::Credential;
use crate::rfc3339_millis;
use chrono::DateTime;
use chrono::Utc;
use serde::Deserialize;
use serde::Serialize;
use uuid::Uuid;

/// `POST /v1/session/refresh`. Refresh rotates atomically: the response carries a
/// new access and refresh pair and the old pair stops working. Reusing a rotated
/// refresh credential revokes the whole refresh family. Refresh is not an SC-2
/// command and has no receipt; if its response is lost, the client revokes the
/// family and signs in again.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RefreshRequest {
    pub refresh_credential: Credential,
}

/// `POST /v1/session/refresh-family/revoke`. Revokes exactly one refresh family:
/// the one the given refresh credential belongs to or, when it is absent, the one
/// of the bearer access credential.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RevokeFamilyRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refresh_credential: Option<Credential>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RevokeFamilyStatus {
    Revoked,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RevokeFamilyResponse {
    pub status: RevokeFamilyStatus,
}

/// The principal as the service holds it. `email` and `display_name` are mutable
/// display attributes, never identity or link keys.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PrincipalView {
    pub principal_id: Uuid,
    pub revision: Revision,
    pub email: Option<String>,
    pub display_name: Option<String>,
}

/// `GET /v1/session`: the caller's own service-held session record.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SessionView {
    pub session_id: Uuid,
    pub device_id: Uuid,
    pub issuer: String,
    pub subject: String,
    #[serde(with = "rfc3339_millis")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "rfc3339_millis")]
    pub last_authenticated_at: DateTime<Utc>,
    #[serde(with = "rfc3339_millis")]
    pub expires_at: DateTime<Utc>,
    #[serde(with = "rfc3339_millis::option")]
    pub revoked_at: Option<DateTime<Utc>>,
    pub revision: Revision,
    pub principal: PrincipalView,
}

/// One displayable membership. It is an observation, not an offline
/// authorization token.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MembershipView {
    pub workspace_id: Uuid,
    pub workspace_kind: String,
    pub role: String,
    pub status: String,
    pub revision: Revision,
}

/// `GET /v1/memberships`: the caller's memberships with their revisions.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MembershipsView {
    pub principal_id: Uuid,
    pub principal_revision: Revision,
    pub memberships: Vec<MembershipView>,
}
