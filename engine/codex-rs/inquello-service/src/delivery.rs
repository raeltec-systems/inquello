//! Optional invitation notification delivery. No token or acceptance authority is
//! carried in email. A durable outbox is committed with invitation + receipt.
//! Resend deduplicates for 24h only: stop automatically retrying before that
//! boundary. A provider acceptance is NOT proof of inbox delivery.
use crate::clock::Clock;
use chrono::{DateTime, TimeDelta, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgConnection, PgPool, Row};
use std::{future::Future, pin::Pin, sync::Arc, time::Duration};
use uuid::Uuid;

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct EmailPayload {
    pub from: String,
    pub to: Vec<String>,
    pub subject: String,
    pub text: String,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DeliveryOutcome {
    ProviderAccepted(String),
    /// Includes lost responses and timeouts; same payload/key only.
    Uncertain,
    Rejected,
}
pub type DeliveryFuture<'a> = Pin<Box<dyn Future<Output = DeliveryOutcome> + Send + 'a>>;
pub trait DeliveryTransport: Send + Sync {
    /// Stable non-secret fingerprint of endpoint/account/credential context.
    /// Changing it after an attempt fences automatic retries.
    fn configuration_id(&self) -> String;
    fn send<'a>(&'a self, key: &'a str, payload: &'a EmailPayload) -> DeliveryFuture<'a>;
}
/// Secret deliberately has no Debug implementation.
pub struct ResendTransport {
    client: reqwest::Client,
    api_key: String,
}
#[derive(Debug, thiserror::Error)]
#[error("invalid invitation delivery configuration")]
pub struct DeliveryConfigError;
impl ResendTransport {
    /// No network request is made until the explicitly enabled worker runs.
    pub fn new(api_key: String) -> Result<Self, DeliveryConfigError> {
        if api_key.is_empty()
            || api_key.len() > 4096
            || api_key
                .bytes()
                .any(|b| b.is_ascii_control() || b.is_ascii_whitespace())
        {
            return Err(DeliveryConfigError);
        }
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(15))
            .build()
            .map_err(|_| DeliveryConfigError)?;
        Ok(Self { client, api_key })
    }
}
impl DeliveryTransport for ResendTransport {
    fn configuration_id(&self) -> String {
        use sha2::Digest;
        format!(
            "resend-v1:{:x}",
            sha2::Sha256::digest(
                format!("https://api.resend.com/emails:{}", self.api_key).as_bytes()
            )
        )
    }
    fn send<'a>(&'a self, key: &'a str, payload: &'a EmailPayload) -> DeliveryFuture<'a> {
        Box::pin(async move {
            let result = self
                .client
                .post("https://api.resend.com/emails")
                .bearer_auth(&self.api_key)
                .header("Idempotency-Key", key)
                .json(payload)
                .send()
                .await;
            let Ok(mut response) = result else {
                return DeliveryOutcome::Uncertain;
            };
            let status = response.status();
            // Never log provider bodies (which can echo recipient or credentials).
            if status.is_success() {
                let mut bytes = Vec::new();
                loop {
                    match response.chunk().await {
                        Ok(Some(chunk)) if bytes.len() + chunk.len() <= 8192 => {
                            bytes.extend_from_slice(&chunk)
                        }
                        Ok(None) => break,
                        _ => return DeliveryOutcome::Uncertain,
                    }
                }
                let Ok(body) = serde_json::from_slice::<serde_json::Value>(&bytes) else {
                    return DeliveryOutcome::Uncertain;
                };
                return match body.get("id").and_then(serde_json::Value::as_str) {
                    Some(id) if Uuid::parse_str(id).is_ok() => {
                        DeliveryOutcome::ProviderAccepted(id.to_owned())
                    }
                    _ => DeliveryOutcome::Uncertain,
                };
            }
            if status.is_server_error() || status.as_u16() == 429 || status.as_u16() == 409 {
                DeliveryOutcome::Uncertain
            } else {
                DeliveryOutcome::Rejected
            }
        })
    }
}
/// Explicit opt-in, separate from identity/service trust. Resend uses its
/// public HTTPS roots, never a fixture CA or disabled TLS.
#[derive(Clone)]
pub struct DeliveryConfig {
    sender: String,
    transport: Arc<dyn DeliveryTransport>,
    configuration_id: String,
}
impl DeliveryConfig {
    pub fn new(
        sender: String,
        transport: Arc<dyn DeliveryTransport>,
    ) -> Result<Self, DeliveryConfigError> {
        // Plain address only avoids header injection and ambiguous display names.
        let sender = crate::oidc::normalize_email(&sender).ok_or(DeliveryConfigError)?;
        use sha2::Digest;
        let configuration_id = format!(
            "{:x}",
            sha2::Sha256::digest(format!("{}:{}", transport.configuration_id(), sender).as_bytes())
        );
        Ok(Self {
            sender,
            transport,
            configuration_id,
        })
    }
    pub fn resend(sender: String, api_key: String) -> Result<Self, DeliveryConfigError> {
        Self::new(sender, Arc::new(ResendTransport::new(api_key)?))
    }
}

pub(crate) async fn enqueue(
    conn: &mut PgConnection,
    invite_id: Uuid,
    recipient: &str,
    now: DateTime<Utc>,
) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT INTO invitation_deliveries (invite_id,idempotency_key,recipient,updated_at) VALUES ($1,$2,$3,$4)")
        .bind(invite_id).bind(format!("inquello-invitation/{invite_id}")).bind(recipient).bind(now)
        .execute(conn).await?;
    Ok(())
}

/// Processes at most one notification; suitable for an injected transport in
/// tests or an explicitly configured service worker. Database errors are not
/// converted into send retries: the durable lease/receipt is reconciled first.
pub async fn dispatch_one(
    pool: &PgPool,
    clock: &dyn Clock,
    config: &DeliveryConfig,
) -> Result<bool, sqlx::Error> {
    let now = clock.now();
    // Explicitly configured dispatcher acknowledges the bounded queued batch.
    sqlx::query("UPDATE invitation_deliveries SET state='pending' WHERE invite_id IN (SELECT invite_id FROM invitation_deliveries WHERE state='not_configured' AND first_attempt_at IS NULL ORDER BY updated_at,invite_id FOR UPDATE SKIP LOCKED LIMIT 100)")
        .execute(pool).await?;
    let mut tx = pool.begin().await?;
    let row = sqlx::query("SELECT d.invite_id,d.idempotency_key,d.recipient,d.payload,d.configuration_id,d.first_attempt_at,i.state AS invite_state,i.expires_at FROM invitation_deliveries d JOIN invites i USING(invite_id) WHERE d.state IN ('not_configured','pending','sending','retry_pending') AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= $1) AND (d.lease_until IS NULL OR d.lease_until <= $1) ORDER BY d.updated_at,d.invite_id FOR UPDATE OF d SKIP LOCKED LIMIT 1")
        .bind(now).fetch_optional(&mut *tx).await?;
    let Some(row) = row else {
        tx.commit().await?;
        return Ok(false);
    };
    let id: Uuid = row.try_get("invite_id")?;
    let first: Option<DateTime<Utc>> = row.try_get("first_attempt_at")?;
    let unavailable = row.try_get::<String, _>("invite_state")? != "pending"
        || row.try_get::<DateTime<Utc>, _>("expires_at")? <= now
        || !currently_eligible(&mut tx, id, now).await?;
    let expired_window =
        first.is_some_and(|first| now < first || now - first >= TimeDelta::hours(23));
    let previous_config: Option<String> = row.try_get("configuration_id")?;
    let changed_config =
        first.is_some() && previous_config.as_deref() != Some(config.configuration_id.as_str());
    if unavailable || expired_window || changed_config {
        let state = if expired_window || changed_config {
            "manual_reconciliation_required"
        } else {
            "cancelled"
        };
        sqlx::query("UPDATE invitation_deliveries SET state=$2,lease_until=NULL,updated_at=$3 WHERE invite_id=$1")
            .bind(id).bind(state).bind(now).execute(&mut *tx).await?;
        tx.commit().await?;
        return Ok(true);
    }
    let payload: Option<sqlx::types::Json<EmailPayload>> = row.try_get("payload")?;
    let payload = payload.map(|p| p.0).unwrap_or_else(|| EmailPayload {
        from: config.sender.clone(),
        to: vec![row.get("recipient")],
        subject: "Your Inquello workspace invitation".to_string(),
        text: "You have a pending Inquello workspace invitation. Open Inquello, sign in with this verified email address, and review Invitations. Accept only if you recognize the workspace. This notification does not grant access. No password, key or invitation token is included.".to_string(),
    });
    let key: String = row.try_get("idempotency_key")?;
    let attempt = Uuid::new_v4();
    sqlx::query("UPDATE invitation_deliveries SET payload=$2,configuration_id=$6,state='sending',first_attempt_at=COALESCE(first_attempt_at,$3),lease_until=$4,attempt_id=$5,attempts=attempts+1,updated_at=$3 WHERE invite_id=$1")
        .bind(id).bind(sqlx::types::Json(&payload)).bind(now).bind(now + TimeDelta::minutes(1)).bind(attempt).bind(&config.configuration_id)
        .execute(&mut *tx).await?;
    // Commit BEFORE contacting the provider. A lost DB commit response means no
    // send now; a subsequent worker reclaims the lease with the same key/body.
    tx.commit().await?;
    let outcome = tokio::time::timeout(
        Duration::from_secs(20),
        config.transport.send(&key, &payload),
    )
    .await
    .unwrap_or(DeliveryOutcome::Uncertain);
    let (state, provider_id) = match outcome {
        DeliveryOutcome::ProviderAccepted(id) => ("provider_accepted", Some(id)),
        DeliveryOutcome::Uncertain => ("retry_pending", None),
        DeliveryOutcome::Rejected => ("failed", None),
    };
    let finished = clock.now();
    sqlx::query("UPDATE invitation_deliveries SET state=$3,provider_id=$4,lease_until=NULL,next_attempt_at=$5,updated_at=$6 WHERE invite_id=$1 AND attempt_id=$2 AND state='sending'")
        .bind(id).bind(attempt).bind(state).bind(provider_id).bind(finished + TimeDelta::minutes(1)).bind(finished)
        .execute(pool).await?;
    Ok(true)
}

pub(crate) async fn statuses(
    state: &crate::server::AppState,
    access: &str,
    workspace_id: Uuid,
) -> Result<inquello_protocol::onboarding::InvitationDeliveriesView, crate::error::ApiError> {
    use crate::sessions::LockMode;
    use inquello_protocol::onboarding::{InvitationDeliveriesView, InvitationDeliveryView};
    let mut tx = state.pool.begin().await?;
    let auth = crate::sessions::authenticate(
        &mut tx,
        access,
        state.clock.as_ref(),
        LockMode::Share,
        LockMode::Share,
    )
    .await?;
    crate::workspaces::resolve(&mut tx, &auth, workspace_id, LockMode::Share)
        .await?
        .require(inquello_domain::authorization::Action::ManageMembership)?;
    let rows = sqlx::query("SELECT d.invite_id,d.state FROM invitation_deliveries d JOIN invites i USING(invite_id) WHERE i.workspace_id=$1 ORDER BY d.updated_at DESC,d.invite_id LIMIT 100")
        .bind(workspace_id).fetch_all(&mut *tx).await?;
    let mut deliveries = Vec::new();
    for row in rows {
        let state: String = row.try_get("state")?;
        deliveries.push(InvitationDeliveryView {
            invite_id: row.try_get("invite_id")?,
            state: serde_json::from_value(serde_json::Value::String(state)).map_err(|_| {
                crate::error::ApiError::unsupported_contract("invalid delivery status")
            })?,
        });
    }
    tx.commit().await?;
    Ok(InvitationDeliveriesView {
        workspace_id,
        deliveries,
    })
}

/// A fresh authorization snapshot immediately before the durable attempt. No
/// authority lock is held over the network; an already-in-flight notification
/// cannot be recalled, and carries no access capability.
async fn currently_eligible(
    conn: &mut PgConnection,
    invite_id: Uuid,
    now: DateTime<Utc>,
) -> Result<bool, sqlx::Error> {
    use inquello_domain::authorization::WorkspacePolicy;
    let row=sqlx::query("SELECT m.roles AS grantor_roles,i.roles AS invited_roles,p.document FROM invites i JOIN workspaces w USING(workspace_id) JOIN workspace_policies p ON p.workspace_id=w.workspace_id AND p.policy_revision=w.policy_revision JOIN principals g ON g.principal_id=i.issued_by JOIN memberships m ON m.workspace_id=w.workspace_id AND m.principal_id=i.issued_by WHERE i.invite_id=$1 AND i.state='pending' AND i.expires_at>$2 AND w.kind='internal_company' AND i.policy_revision=w.policy_revision AND g.status='active' AND m.status='active'")
        .bind(invite_id).bind(now).fetch_optional(conn).await?;
    let Some(row) = row else {
        return Ok(false);
    };
    let document: serde_json::Value = row.try_get("document")?;
    let Ok(policy) = WorkspacePolicy::parse(&document.to_string()) else {
        return Ok(false);
    };
    let grantor_roles: Vec<String> = row.try_get("grantor_roles")?;
    let invited_roles: Vec<String> = row.try_get("invited_roles")?;
    Ok(
        crate::workspaces::may_grant_roles(&policy, &grantor_roles, &invited_roles)
            && !invited_roles.is_empty()
            && invited_roles.iter().all(|role| policy.role(role).is_some()),
    )
}
