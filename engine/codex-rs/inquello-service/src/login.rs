//! SC-1 bootstrap: login transactions, ID-token sign-in and abandon.

use crate::credentials;
use crate::credentials::CredentialKind;
use crate::credentials::MAX_CREDENTIAL_BYTES;
use crate::error::ApiError;
use crate::oidc::MAX_ID_TOKEN_BYTES;
use crate::server::AppState;
use crate::sessions;
use chrono::DateTime;
use chrono::Utc;
use inquello_protocol::login::AbandonLoginRequest;
use inquello_protocol::login::AbandonLoginResponse;
use inquello_protocol::login::AbandonStatus;
use inquello_protocol::login::BootstrapRequest;
use inquello_protocol::login::CreateLoginTransactionRequest;
use inquello_protocol::login::LoginTransaction;
use inquello_protocol::login::SessionCredentials;
use sqlx::Row;
use uuid::Uuid;

/// The longest issuer, client ID or redirect URI accepted in a request.
const MAX_BINDING_BYTES: usize = 2048;

/// `POST /v1/login/transactions`: creates an expiring, one-use transaction bound
/// to an allowlisted issuer, its client and one of its exact redirect URIs.
pub(crate) async fn create_transaction(
    state: &AppState,
    request: CreateLoginTransactionRequest,
) -> Result<LoginTransaction, ApiError> {
    let issuer = state
        .issuer(&request.issuer)
        .filter(|issuer| issuer.client_id == request.client_id)
        .filter(|issuer| issuer.redirect_uris.contains(&request.redirect_uri))
        .ok_or_else(|| ApiError::denied("issuer, client or redirect URI not allowlisted"))?;
    let now = state.clock.now();
    let login_transaction_id = Uuid::new_v4();
    let proof = credentials::generate(CredentialKind::TransactionProof);
    let nonce = credentials::nonce();
    let expires_at = now + state.lifetimes.login_transaction;
    sqlx::query(
        "INSERT INTO login_transactions (login_transaction_id, proof_hash, nonce, issuer, \
         client_id, redirect_uri, device_id, created_at, expires_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(login_transaction_id)
    .bind(credentials::hash(proof.expose()))
    .bind(&nonce)
    .bind(&issuer.issuer)
    .bind(&issuer.client_id)
    .bind(&request.redirect_uri)
    .bind(request.device_id)
    .bind(now)
    .bind(expires_at)
    .execute(&state.pool)
    .await?;
    tracing::info!(%login_transaction_id, "login transaction created");
    Ok(LoginTransaction {
        login_transaction_id,
        transaction_proof: proof,
        nonce,
        issuer: issuer.issuer.clone(),
        client_id: issuer.client_id.clone(),
        redirect_uri: request.redirect_uri,
        device_id: request.device_id,
        expires_at,
    })
}

fn proof_hash(proof: &str) -> Result<Vec<u8>, ApiError> {
    if proof.is_empty() || proof.len() > MAX_CREDENTIAL_BYTES {
        return Err(ApiError::unauthenticated(
            "transaction proof length out of range",
        ));
    }
    Ok(credentials::hash(proof))
}

struct OpenTransaction {
    nonce: String,
    issuer: String,
    redirect_uri: String,
    device_id: Uuid,
}

/// `POST /v1/login/bootstrap`. The token is validated before any write, so a
/// token that fails a check leaves the transaction open for a retry. On success
/// the transaction is consumed, the token hash is recorded against replay, the
/// principal is found or created by `(issuer, subject)` and the session is
/// created, all in one transaction.
pub(crate) async fn bootstrap(
    state: &AppState,
    request: BootstrapRequest,
) -> Result<SessionCredentials, ApiError> {
    let now = state.clock.now();
    let proof = proof_hash(request.transaction_proof.expose())?;
    let id_token = request.id_token.expose();
    if id_token.is_empty() || id_token.len() > MAX_ID_TOKEN_BYTES {
        return Err(ApiError::unauthenticated("ID token length out of range"));
    }
    if request.redirect_uri.len() > MAX_BINDING_BYTES {
        return Err(ApiError::unauthenticated("redirect URI too long"));
    }

    let row = sqlx::query(
        "SELECT nonce, issuer, redirect_uri, device_id, expires_at, consumed_at \
         FROM login_transactions WHERE login_transaction_id = $1 AND proof_hash = $2",
    )
    .bind(request.login_transaction_id)
    .bind(&proof)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| ApiError::unauthenticated("unknown login transaction"))?;
    let consumed_at: Option<DateTime<Utc>> = row.try_get("consumed_at")?;
    let expires_at: DateTime<Utc> = row.try_get("expires_at")?;
    if consumed_at.is_some() {
        return Err(ApiError::unauthenticated(
            "login transaction already consumed",
        ));
    }
    if now >= expires_at {
        return Err(ApiError::unauthenticated("login transaction expired"));
    }
    let open = OpenTransaction {
        nonce: row.try_get("nonce")?,
        issuer: row.try_get("issuer")?,
        redirect_uri: row.try_get("redirect_uri")?,
        device_id: row.try_get("device_id")?,
    };
    if request.redirect_uri != open.redirect_uri {
        return Err(ApiError::unauthenticated(
            "redirect URI does not match the transaction",
        ));
    }
    let issuer = state
        .issuer(&open.issuer)
        .ok_or_else(|| ApiError::unauthenticated("transaction issuer no longer configured"))?;
    let claims = issuer
        .validate(
            id_token,
            &open.nonce,
            now,
            state.lifetimes.id_token_clock_skew,
        )
        .map_err(|rejection| {
            tracing::info!(
                login_transaction_id = %request.login_transaction_id,
                reason = rejection.0,
                "ID token rejected"
            );
            ApiError::unauthenticated("ID token rejected")
        })?;

    let mut tx = state.pool.begin().await?;
    let locked = sqlx::query(
        "SELECT expires_at, consumed_at FROM login_transactions \
         WHERE login_transaction_id = $1 FOR UPDATE",
    )
    .bind(request.login_transaction_id)
    .fetch_one(&mut *tx)
    .await?;
    let consumed_at: Option<DateTime<Utc>> = locked.try_get("consumed_at")?;
    let expires_at: DateTime<Utc> = locked.try_get("expires_at")?;
    if consumed_at.is_some() || now >= expires_at {
        return Err(ApiError::unauthenticated(
            "login transaction no longer open",
        ));
    }

    let token_recorded = sqlx::query(
        "INSERT INTO consumed_id_tokens (issuer, token_hash, consumed_at, token_expires_at) \
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
    )
    .bind(&open.issuer)
    .bind(credentials::hash(id_token))
    .bind(now)
    .bind(claims.expires_at)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if token_recorded == 0 {
        return Err(ApiError::unauthenticated("ID token replayed"));
    }

    // Find or create the principal by (issuer, subject) only. Email and name are
    // refreshed as attributes; a change bumps the principal revision.
    let principal = sqlx::query(
        "INSERT INTO principals (principal_id, issuer, subject, email, display_name, status, \
         revision, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, 'active', 1, $6, $6) \
         ON CONFLICT (issuer, subject) DO UPDATE SET \
           email = EXCLUDED.email, \
           display_name = EXCLUDED.display_name, \
           revision = principals.revision + CASE WHEN principals.email IS DISTINCT FROM EXCLUDED.email \
             OR principals.display_name IS DISTINCT FROM EXCLUDED.display_name THEN 1 ELSE 0 END, \
           updated_at = CASE WHEN principals.email IS DISTINCT FROM EXCLUDED.email \
             OR principals.display_name IS DISTINCT FROM EXCLUDED.display_name \
             THEN EXCLUDED.updated_at ELSE principals.updated_at END \
         RETURNING principal_id, status",
    )
    .bind(Uuid::new_v4())
    .bind(&open.issuer)
    .bind(&claims.subject)
    .bind(&claims.email)
    .bind(&claims.name)
    .bind(now)
    .fetch_one(&mut *tx)
    .await?;
    let principal_id: Uuid = principal.try_get("principal_id")?;
    let status: String = principal.try_get("status")?;
    if status != "active" {
        return Err(ApiError::unauthenticated("principal disabled"));
    }

    let family_id = Uuid::new_v4();
    let session_id = Uuid::new_v4();
    let session_expires_at = now + state.lifetimes.session;
    sqlx::query(
        "INSERT INTO refresh_families (family_id, principal_id, created_at) VALUES ($1, $2, $3)",
    )
    .bind(family_id)
    .bind(principal_id)
    .bind(now)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO sessions (session_id, principal_id, device_id, family_id, \
         login_transaction_id, issuer, subject, created_at, last_authenticated_at, expires_at, \
         revision) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, 1)",
    )
    .bind(session_id)
    .bind(principal_id)
    .bind(open.device_id)
    .bind(family_id)
    .bind(request.login_transaction_id)
    .bind(&open.issuer)
    .bind(&claims.subject)
    .bind(now)
    .bind(session_expires_at)
    .execute(&mut *tx)
    .await?;
    let issued = sessions::issue_credentials(
        &mut tx,
        state,
        principal_id,
        session_id,
        session_expires_at,
        1,
        now,
    )
    .await?;
    sqlx::query(
        "UPDATE login_transactions SET consumed_at = $2, consumed_reason = 'bootstrapped', \
         session_id = $3 WHERE login_transaction_id = $1",
    )
    .bind(request.login_transaction_id)
    .bind(now)
    .bind(session_id)
    .execute(&mut *tx)
    .await?;
    tx.commit()
        .await
        .map_err(|error| ApiError::uncertain(&error))?;
    tracing::info!(%principal_id, %session_id, "session created");
    Ok(issued)
}

/// `POST /v1/login/abandon`: closes an open transaction, or revokes the session a
/// consumed transaction created (for a lost bootstrap response). Idempotent.
pub(crate) async fn abandon(
    state: &AppState,
    request: AbandonLoginRequest,
) -> Result<AbandonLoginResponse, ApiError> {
    let now = state.clock.now();
    let proof = proof_hash(request.transaction_proof.expose())?;
    let mut tx = state.pool.begin().await?;
    let row = sqlx::query(
        "SELECT consumed_at, session_id FROM login_transactions \
         WHERE login_transaction_id = $1 AND proof_hash = $2 FOR UPDATE",
    )
    .bind(request.login_transaction_id)
    .bind(&proof)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| ApiError::unauthenticated("unknown login transaction"))?;
    let consumed_at: Option<DateTime<Utc>> = row.try_get("consumed_at")?;
    let session_id: Option<Uuid> = row.try_get("session_id")?;
    if consumed_at.is_none() {
        sqlx::query(
            "UPDATE login_transactions SET consumed_at = $2, consumed_reason = 'abandoned' \
             WHERE login_transaction_id = $1",
        )
        .bind(request.login_transaction_id)
        .bind(now)
        .execute(&mut *tx)
        .await?;
    }
    if let Some(session_id) = session_id {
        let owner =
            sqlx::query("SELECT principal_id, family_id FROM sessions WHERE session_id = $1")
                .bind(session_id)
                .fetch_one(&mut *tx)
                .await?;
        let principal_id: Uuid = owner.try_get("principal_id")?;
        let family_id: Uuid = owner.try_get("family_id")?;
        sqlx::query("SELECT 1 FROM principals WHERE principal_id = $1 FOR SHARE")
            .bind(principal_id)
            .execute(&mut *tx)
            .await?;
        sessions::revoke_family_locked(&mut tx, principal_id, family_id, now, "login_abandoned")
            .await?;
    }
    tx.commit()
        .await
        .map_err(|error| ApiError::uncertain(&error))?;
    Ok(AbandonLoginResponse {
        login_transaction_id: request.login_transaction_id,
        status: AbandonStatus::Abandoned,
    })
}
