//! Sessions: protected-request resolution, refresh rotation, refresh-family
//! revocation and the session and membership views.
//!
//! Lock order is always principal, then session(s) in `session_id` order, then the
//! credential and family rows those sessions own. Every path that changes a
//! session or its credentials holds that session's row lock, so a reader holding
//! `FOR SHARE` on the session sees a consistent, current state.

use crate::credentials;
use crate::credentials::CredentialKind;
use crate::credentials::MAX_CREDENTIAL_BYTES;
use crate::error::ApiError;
use crate::server::AppState;
use chrono::DateTime;
use chrono::Utc;
use inquello_protocol::Revision;
use inquello_protocol::login::SessionCredentials;
use inquello_protocol::session::MembershipView;
use inquello_protocol::session::MembershipsView;
use inquello_protocol::session::PrincipalView;
use inquello_protocol::session::RefreshRequest;
use inquello_protocol::session::RevokeFamilyRequest;
use inquello_protocol::session::RevokeFamilyResponse;
use inquello_protocol::session::RevokeFamilyStatus;
use inquello_protocol::session::SessionView;
use sqlx::PgConnection;
use sqlx::Row;
use uuid::Uuid;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum LockMode {
    Share,
    Update,
}

/// A protected request's resolved authority, valid for the enclosing transaction.
#[derive(Clone, Copy, Debug)]
pub(crate) struct Authenticated {
    pub(crate) principal_id: Uuid,
    pub(crate) session_id: Uuid,
    pub(crate) family_id: Uuid,
}

fn revision(value: i64) -> Result<Revision, ApiError> {
    u64::try_from(value)
        .map(Revision::new)
        .map_err(|_| ApiError::dependency(&sqlx::Error::Decode("negative revision".into())))
}

fn credential_hash(presented: &str) -> Result<Vec<u8>, ApiError> {
    if presented.is_empty() || presented.len() > MAX_CREDENTIAL_BYTES {
        return Err(ApiError::unauthenticated("credential length out of range"));
    }
    Ok(credentials::hash(presented))
}

/// Locks the principal row and requires it to be active.
async fn lock_active_principal(
    conn: &mut PgConnection,
    principal_id: Uuid,
    mode: LockMode,
) -> Result<(), ApiError> {
    let sql = match mode {
        LockMode::Share => "SELECT status FROM principals WHERE principal_id = $1 FOR SHARE",
        LockMode::Update => "SELECT status FROM principals WHERE principal_id = $1 FOR UPDATE",
    };
    let status: Option<String> = sqlx::query_scalar(sql)
        .bind(principal_id)
        .fetch_optional(&mut *conn)
        .await?;
    match status.as_deref() {
        Some("active") => Ok(()),
        Some(_) => Err(ApiError::unauthenticated("principal disabled")),
        None => Err(ApiError::unauthenticated("principal missing")),
    }
}

struct LockedSession {
    family_id: Uuid,
    expires_at: DateTime<Utc>,
    revoked_at: Option<DateTime<Utc>>,
    family_revoked_at: Option<DateTime<Utc>>,
}

impl LockedSession {
    fn is_usable(&self, now: DateTime<Utc>) -> bool {
        self.revoked_at.is_none() && self.family_revoked_at.is_none() && now < self.expires_at
    }
}

async fn lock_session(
    conn: &mut PgConnection,
    session_id: Uuid,
    mode: LockMode,
) -> Result<LockedSession, ApiError> {
    let sql = match mode {
        LockMode::Share => {
            "SELECT s.family_id, s.expires_at, s.revoked_at, f.revoked_at AS family_revoked_at \
             FROM sessions s JOIN refresh_families f ON f.family_id = s.family_id \
             WHERE s.session_id = $1 FOR SHARE OF s"
        }
        LockMode::Update => {
            "SELECT s.family_id, s.expires_at, s.revoked_at, f.revoked_at AS family_revoked_at \
             FROM sessions s JOIN refresh_families f ON f.family_id = s.family_id \
             WHERE s.session_id = $1 FOR UPDATE OF s"
        }
    };
    let row = sqlx::query(sql)
        .bind(session_id)
        .fetch_optional(&mut *conn)
        .await?
        .ok_or_else(|| ApiError::unauthenticated("session missing"))?;
    Ok(LockedSession {
        family_id: row.try_get("family_id")?,
        expires_at: row.try_get("expires_at")?,
        revoked_at: row.try_get("revoked_at")?,
        family_revoked_at: row.try_get("family_revoked_at")?,
    })
}

/// Finds which principal and session a credential hash belongs to, without locks.
async fn find_credential_owner(
    conn: &mut PgConnection,
    hash: &[u8],
    kind: CredentialKind,
) -> Result<(Uuid, Uuid), ApiError> {
    let row = sqlx::query(
        "SELECT c.session_id, s.principal_id FROM session_credentials c \
         JOIN sessions s ON s.session_id = c.session_id \
         WHERE c.credential_hash = $1 AND c.kind = $2",
    )
    .bind(hash)
    .bind(kind.as_str())
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| ApiError::unauthenticated("unknown credential"))?;
    Ok((row.try_get("principal_id")?, row.try_get("session_id")?))
}

struct CredentialState {
    state: String,
    expires_at: DateTime<Utc>,
    generation: i64,
}

/// Reads a credential row. Call only while holding its session's row lock.
async fn read_credential(
    conn: &mut PgConnection,
    hash: &[u8],
) -> Result<CredentialState, ApiError> {
    let row = sqlx::query(
        "SELECT state, expires_at, generation FROM session_credentials WHERE credential_hash = $1",
    )
    .bind(hash)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| ApiError::unauthenticated("unknown credential"))?;
    Ok(CredentialState {
        state: row.try_get("state")?,
        expires_at: row.try_get("expires_at")?,
        generation: row.try_get("generation")?,
    })
}

/// Resolves a bearer access credential inside the caller's transaction: locks the
/// principal, then the session, then re-reads the credential under those locks.
/// Anything but a current credential on a live session of an active principal is
/// `unauthenticated`.
pub(crate) async fn authenticate(
    conn: &mut PgConnection,
    access: &str,
    now: DateTime<Utc>,
    principal_lock: LockMode,
    session_lock: LockMode,
) -> Result<Authenticated, ApiError> {
    let hash = credential_hash(access)?;
    let (principal_id, session_id) =
        find_credential_owner(conn, &hash, CredentialKind::Access).await?;
    lock_active_principal(conn, principal_id, principal_lock).await?;
    let session = lock_session(conn, session_id, session_lock).await?;
    let credential = read_credential(conn, &hash).await?;
    if credential.state != "current" {
        return Err(ApiError::unauthenticated("access credential not current"));
    }
    if now >= credential.expires_at {
        return Err(ApiError::unauthenticated("access credential expired"));
    }
    if !session.is_usable(now) {
        return Err(ApiError::unauthenticated("session revoked or expired"));
    }
    Ok(Authenticated {
        principal_id,
        session_id,
        family_id: session.family_id,
    })
}

/// Revokes a refresh family and every session in it, with a durable invalidation
/// event per newly revoked session. The caller holds the principal lock; this
/// locks the family's sessions in `session_id` order.
pub(crate) async fn revoke_family_locked(
    conn: &mut PgConnection,
    principal_id: Uuid,
    family_id: Uuid,
    now: DateTime<Utc>,
    reason: &'static str,
) -> Result<(), ApiError> {
    let sessions: Vec<Uuid> = sqlx::query_scalar(
        "SELECT session_id FROM sessions WHERE family_id = $1 ORDER BY session_id FOR UPDATE",
    )
    .bind(family_id)
    .fetch_all(&mut *conn)
    .await?;
    sqlx::query(
        "UPDATE refresh_families SET revoked_at = $2, revoked_reason = $3 \
         WHERE family_id = $1 AND revoked_at IS NULL",
    )
    .bind(family_id)
    .bind(now)
    .bind(reason)
    .execute(&mut *conn)
    .await?;
    let revoked: Vec<Uuid> = sqlx::query_scalar(
        "UPDATE sessions SET revoked_at = $2, revision = revision + 1 \
         WHERE family_id = $1 AND revoked_at IS NULL RETURNING session_id",
    )
    .bind(family_id)
    .bind(now)
    .fetch_all(&mut *conn)
    .await?;
    sqlx::query(
        "UPDATE session_credentials SET state = 'revoked' \
         WHERE session_id = ANY($1) AND state <> 'revoked'",
    )
    .bind(&sessions)
    .execute(&mut *conn)
    .await?;
    for session_id in revoked {
        sqlx::query(
            "INSERT INTO invalidation_events (principal_id, session_id, family_id, reason, recorded_at) \
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(principal_id)
        .bind(session_id)
        .bind(family_id)
        .bind(reason)
        .bind(now)
        .execute(&mut *conn)
        .await?;
    }
    tracing::info!(%principal_id, %family_id, reason, "refresh family revoked");
    Ok(())
}

/// Issues a new access and refresh pair for a session at `generation`.
pub(crate) async fn issue_credentials(
    conn: &mut PgConnection,
    state: &AppState,
    principal_id: Uuid,
    session_id: Uuid,
    session_expires_at: DateTime<Utc>,
    generation: i64,
    now: DateTime<Utc>,
) -> Result<SessionCredentials, ApiError> {
    let access = credentials::generate(CredentialKind::Access);
    let refresh = credentials::generate(CredentialKind::Refresh);
    let access_expires_at = (now + state.lifetimes.access).min(session_expires_at);
    let refresh_expires_at = (now + state.lifetimes.refresh).min(session_expires_at);
    for (credential, kind, expires_at) in [
        (&access, CredentialKind::Access, access_expires_at),
        (&refresh, CredentialKind::Refresh, refresh_expires_at),
    ] {
        sqlx::query(
            "INSERT INTO session_credentials \
             (credential_hash, kind, session_id, generation, state, issued_at, expires_at) \
             VALUES ($1, $2, $3, $4, 'current', $5, $6)",
        )
        .bind(credentials::hash(credential.expose()))
        .bind(kind.as_str())
        .bind(session_id)
        .bind(generation)
        .bind(now)
        .bind(expires_at)
        .execute(&mut *conn)
        .await?;
    }
    Ok(SessionCredentials {
        session_id,
        principal_id,
        access_credential: access,
        access_expires_at,
        refresh_credential: refresh,
        refresh_expires_at,
        session_expires_at,
    })
}

/// `POST /v1/session/refresh`.
pub(crate) async fn refresh(
    state: &AppState,
    request: RefreshRequest,
) -> Result<SessionCredentials, ApiError> {
    let now = state.clock.now();
    let hash = credential_hash(request.refresh_credential.expose())?;
    let mut tx = state.pool.begin().await?;
    let (principal_id, session_id) =
        find_credential_owner(&mut tx, &hash, CredentialKind::Refresh).await?;
    lock_active_principal(&mut tx, principal_id, LockMode::Share).await?;
    let session = lock_session(&mut tx, session_id, LockMode::Update).await?;
    let credential = read_credential(&mut tx, &hash).await?;

    if credential.state == "rotated" {
        // Reuse of a rotated refresh credential: revoke the whole family, commit
        // that revocation, and still refuse the request.
        revoke_family_locked(
            &mut tx,
            principal_id,
            session.family_id,
            now,
            "refresh_reuse",
        )
        .await?;
        tx.commit().await?;
        return Err(ApiError::unauthenticated(
            "rotated refresh credential reused",
        ));
    }
    if credential.state != "current" {
        return Err(ApiError::unauthenticated("refresh credential revoked"));
    }
    if now >= credential.expires_at {
        return Err(ApiError::unauthenticated("refresh credential expired"));
    }
    if !session.is_usable(now) {
        return Err(ApiError::unauthenticated("session revoked or expired"));
    }

    sqlx::query(
        "UPDATE session_credentials SET state = 'rotated' WHERE session_id = $1 AND state = 'current'",
    )
    .bind(session_id)
    .execute(&mut *tx)
    .await?;
    let issued = issue_credentials(
        &mut tx,
        state,
        principal_id,
        session_id,
        session.expires_at,
        credential.generation + 1,
        now,
    )
    .await?;
    tx.commit()
        .await
        .map_err(|error| ApiError::uncertain(&error))?;
    tracing::info!(%principal_id, %session_id, "session refreshed");
    Ok(issued)
}

/// `POST /v1/session/refresh-family/revoke`: revokes exactly the family of the
/// presented refresh credential (in any state) or, without one, of the bearer
/// access credential.
pub(crate) async fn revoke_family(
    state: &AppState,
    bearer: Option<&str>,
    request: RevokeFamilyRequest,
) -> Result<RevokeFamilyResponse, ApiError> {
    let now = state.clock.now();
    let mut tx = state.pool.begin().await?;
    let (principal_id, family_id) = match (&request.refresh_credential, bearer) {
        (Some(refresh), _) => {
            let hash = credential_hash(refresh.expose())?;
            let (principal_id, session_id) =
                find_credential_owner(&mut tx, &hash, CredentialKind::Refresh).await?;
            // The principal may be disabled; revoking its family is still allowed.
            sqlx::query("SELECT 1 FROM principals WHERE principal_id = $1 FOR SHARE")
                .bind(principal_id)
                .execute(&mut *tx)
                .await?;
            let session = lock_session(&mut tx, session_id, LockMode::Update).await?;
            (principal_id, session.family_id)
        }
        (None, Some(access)) => {
            let auth =
                authenticate(&mut tx, access, now, LockMode::Share, LockMode::Update).await?;
            (auth.principal_id, auth.family_id)
        }
        (None, None) => return Err(ApiError::unauthenticated("no credential presented")),
    };
    revoke_family_locked(&mut tx, principal_id, family_id, now, "family_revoke").await?;
    tx.commit()
        .await
        .map_err(|error| ApiError::uncertain(&error))?;
    Ok(RevokeFamilyResponse {
        status: RevokeFamilyStatus::Revoked,
    })
}

async fn principal_view(
    conn: &mut PgConnection,
    principal_id: Uuid,
) -> Result<PrincipalView, ApiError> {
    let row =
        sqlx::query("SELECT revision, email, display_name FROM principals WHERE principal_id = $1")
            .bind(principal_id)
            .fetch_one(&mut *conn)
            .await?;
    Ok(PrincipalView {
        principal_id,
        revision: revision(row.try_get("revision")?)?,
        email: row.try_get("email")?,
        display_name: row.try_get("display_name")?,
    })
}

/// `GET /v1/session`.
pub(crate) async fn session_view(state: &AppState, access: &str) -> Result<SessionView, ApiError> {
    let now = state.clock.now();
    let mut tx = state.pool.begin().await?;
    let auth = authenticate(&mut tx, access, now, LockMode::Share, LockMode::Share).await?;
    let principal = principal_view(&mut tx, auth.principal_id).await?;
    let row = sqlx::query(
        "SELECT device_id, issuer, subject, created_at, last_authenticated_at, expires_at, \
         revoked_at, revision FROM sessions WHERE session_id = $1",
    )
    .bind(auth.session_id)
    .fetch_one(&mut *tx)
    .await?;
    let view = SessionView {
        session_id: auth.session_id,
        device_id: row.try_get("device_id")?,
        issuer: row.try_get("issuer")?,
        subject: row.try_get("subject")?,
        created_at: row.try_get("created_at")?,
        last_authenticated_at: row.try_get("last_authenticated_at")?,
        expires_at: row.try_get("expires_at")?,
        revoked_at: row.try_get("revoked_at")?,
        revision: revision(row.try_get("revision")?)?,
        principal,
    };
    tx.commit().await?;
    Ok(view)
}

/// `GET /v1/memberships`: the caller's fixture-seeded memberships.
pub(crate) async fn memberships_view(
    state: &AppState,
    access: &str,
) -> Result<MembershipsView, ApiError> {
    let now = state.clock.now();
    let mut tx = state.pool.begin().await?;
    let auth = authenticate(&mut tx, access, now, LockMode::Share, LockMode::Share).await?;
    let principal = principal_view(&mut tx, auth.principal_id).await?;
    let rows = sqlx::query(
        "SELECT workspace_id, workspace_kind, role, status, revision FROM memberships \
         WHERE principal_id = $1 ORDER BY workspace_id",
    )
    .bind(auth.principal_id)
    .fetch_all(&mut *tx)
    .await?;
    let memberships = rows
        .iter()
        .map(|row| {
            Ok(MembershipView {
                workspace_id: row.try_get("workspace_id")?,
                workspace_kind: row.try_get("workspace_kind")?,
                role: row.try_get("role")?,
                status: row.try_get("status")?,
                revision: revision(row.try_get("revision")?)?,
            })
        })
        .collect::<Result<Vec<_>, ApiError>>()?;
    tx.commit().await?;
    Ok(MembershipsView {
        principal_id: auth.principal_id,
        principal_revision: principal.revision,
        memberships,
    })
}
