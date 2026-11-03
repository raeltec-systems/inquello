//! Durable human consent and automatic current exact-software authority.
//! A stored revoke/material mismatch never falls through to legacy approval.
use crate::{
    commands::current_epoch,
    digest::request_digest,
    error::ApiError,
    server::AppState,
    sessions::{self, Authenticated, LockMode},
    workspace_commands::increment_epoch,
    workspaces::{self, WorkspaceAuthority},
};
use chrono::{DateTime, Utc};
use inquello_domain::{
    capability::CapabilityRegister,
    routes::{
        OPENAI_PROVIDER, OrganizationRouteApproval, ProcessingContract, RouteEvidenceIdentity,
        RouteId, compiled_route_evidence, processing_contract_for_entry,
    },
};
use inquello_protocol::{
    SCHEMA_VERSION,
    command::{CommandResponse, CommandStatus},
    provider_consent::{
        ProviderConsentAction, ProviderConsentCommand, ProviderConsentState, ProviderConsentView,
    },
};
use sqlx::{PgConnection, Row, types::Json};
use uuid::Uuid;

fn unavailable() -> ApiError {
    ApiError::denied("provider processing is not available")
}

fn contract(provider: &str) -> Result<ProcessingContract, ApiError> {
    if provider != OPENAI_PROVIDER {
        return Err(unavailable());
    }
    let register = CapabilityRegister::load_embedded().map_err(|_| unavailable())?;
    register
        .entry(RouteId::CodexResponses.capability_id())
        .and_then(processing_contract_for_entry)
        .ok_or_else(unavailable)
}

struct Consent {
    revision: i64,
    digest: String,
    state: String,
    decided_at: DateTime<Utc>,
}

async fn stored(
    conn: &mut PgConnection,
    workspace: Uuid,
    provider: &str,
) -> Result<Option<Consent>, ApiError> {
    let row = sqlx::query("SELECT revision,contract_digest,state,decided_at FROM provider_consents WHERE workspace_id=$1 AND provider=$2")
        .bind(workspace).bind(provider).fetch_optional(conn).await?;
    row.map(|r| {
        Ok(Consent {
            revision: r.try_get("revision")?,
            digest: r.try_get("contract_digest")?,
            state: r.try_get("state")?,
            decided_at: r.try_get("decided_at")?,
        })
    })
    .transpose()
}

async fn session_bounds(
    conn: &mut PgConnection,
    auth: &Authenticated,
) -> Result<(DateTime<Utc>, DateTime<Utc>), ApiError> {
    Ok(
        sqlx::query_as("SELECT created_at,expires_at FROM sessions WHERE session_id=$1")
            .bind(auth.session_id)
            .fetch_one(conn)
            .await?,
    )
}

pub(crate) async fn view(
    state: &AppState,
    access: &str,
    workspace: Uuid,
    provider: &str,
) -> Result<ProviderConsentView, ApiError> {
    let mut tx = state.pool.begin().await?;
    let auth = sessions::authenticate(
        &mut tx,
        access,
        state.clock.as_ref(),
        LockMode::Share,
        LockMode::Share,
    )
    .await?;
    let authority = workspaces::resolve(&mut tx, &auth, workspace, LockMode::Share).await?;
    authority.require_member()?;
    let contract = contract(provider)?;
    let digest = contract.digest();
    let current = stored(&mut tx, workspace, provider).await?;
    let status = match current.as_ref() {
        None => ProviderConsentState::NotAllowed,
        Some(c) if c.state == "revoked" => ProviderConsentState::Revoked,
        Some(c) if c.digest != digest => ProviderConsentState::Changed,
        Some(_) => ProviderConsentState::Allowed,
    };
    if session_bounds(&mut tx, &auth).await?.1 <= state.clock.now() {
        return Err(unavailable());
    }
    let response = ProviderConsentView {
        workspace_id: workspace,
        workspace_name: authority.workspace.name.clone(),
        provider: provider.into(),
        contract_id: contract.id.clone(),
        contract_version: contract.schema_version,
        contract_digest: digest,
        consent_text: contract.consent_text(),
        revision: workspaces::revision(current.map_or(0, |c| c.revision))?,
        state: status,
        can_manage: authority.require_owner().is_ok(),
        authorization_epoch: authority.epoch()?,
        policy_revision: workspaces::revision(authority.workspace.policy_revision)?,
    };
    tx.commit().await?;
    Ok(response)
}

pub(crate) async fn command(
    state: &AppState,
    access: &str,
    workspace: Uuid,
    provider: &str,
    request: ProviderConsentCommand,
) -> Result<CommandResponse, ApiError> {
    if request.workspace_id != workspace || request.schema_version != SCHEMA_VERSION {
        return Err(ApiError::unsupported_contract(
            "invalid consent command scope",
        ));
    }
    let mut tx = state.pool.begin().await?;
    let auth = sessions::authenticate(
        &mut tx,
        access,
        state.clock.as_ref(),
        LockMode::Update,
        LockMode::Share,
    )
    .await?;
    if request.command_epoch != current_epoch(&mut tx, true).await? {
        return Err(ApiError::unsupported_contract(
            "command epoch is not current",
        ));
    }
    let authority = workspaces::resolve(&mut tx, &auth, workspace, LockMode::Update).await?;
    authority.require_owner()?;
    let contract = contract(provider)?;
    let digest = request_digest(&serde_json::json!({"provider":provider,"request":request}));
    let existing = sqlx::query("SELECT principal_id,request_digest,response FROM provider_consent_receipts WHERE workspace_id=$1 AND operation_id=$2")
        .bind(workspace).bind(request.operation_id).fetch_optional(&mut *tx).await?;
    if let Some(row) = existing {
        if row.try_get::<Uuid, _>("principal_id")? != auth.principal_id
            || row.try_get::<String, _>("request_digest")? != digest
        {
            return Err(ApiError::version_conflict("consent operation ID reused"));
        }
        if session_bounds(&mut tx, &auth).await?.1 <= state.clock.now() {
            return Err(unavailable());
        }
        let Json(response): Json<CommandResponse> = row.try_get("response")?;
        tx.commit().await?;
        return Ok(response);
    }
    if request.expected_contract_version != contract.schema_version
        || request.expected_contract_digest != contract.digest()
    {
        return Err(ApiError::version_conflict(
            "processing terms changed; read them again",
        ));
    }
    let previous = stored(&mut tx, workspace, provider).await?;
    let previous_revision = previous.map_or(0, |c| c.revision);
    if workspaces::revision(previous_revision)? != request.expected_revision {
        return Err(ApiError::version_conflict("provider consent changed"));
    }
    let next = previous_revision.checked_add(1).ok_or_else(unavailable)?;
    let now = state.clock.now();
    let status = match request.action {
        ProviderConsentAction::Allow => "allowed",
        ProviderConsentAction::Revoke => "revoked",
    };
    let contract_digest = contract.digest();
    sqlx::query("INSERT INTO provider_consents(workspace_id,provider,revision,contract_digest,contract,state,decided_by,decided_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(workspace_id,provider) DO UPDATE SET revision=EXCLUDED.revision,contract_digest=EXCLUDED.contract_digest,contract=EXCLUDED.contract,state=EXCLUDED.state,decided_by=EXCLUDED.decided_by,decided_at=EXCLUDED.decided_at")
        .bind(workspace).bind(provider).bind(next).bind(&contract_digest).bind(Json(&contract))
        .bind(status).bind(auth.principal_id).bind(now).execute(&mut *tx).await?;
    let epoch = increment_epoch(
        &mut tx,
        workspace,
        "provider_consent_changed",
        Some(auth.principal_id),
        now,
    )
    .await?;
    let response = CommandResponse {
        operation_id: request.operation_id.to_string(),
        resource_id: workspace,
        revision: workspaces::revision(next)?,
        authorization_epoch: Some(workspaces::revision(epoch)?),
        status: CommandStatus::Applied,
        receipt_id: Uuid::new_v4(),
    };
    sqlx::query("INSERT INTO provider_consent_receipts(workspace_id,operation_id,principal_id,request_digest,receipt_id,response,recorded_at) VALUES($1,$2,$3,$4,$5,$6,$7)")
        .bind(workspace).bind(request.operation_id).bind(auth.principal_id).bind(digest).bind(response.receipt_id)
        .bind(Json(&response)).bind(now).execute(&mut *tx).await?;
    sqlx::query("INSERT INTO provider_consent_history(workspace_id,provider,revision,contract_digest,contract,state,decided_by,decided_at,receipt_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)")
        .bind(workspace).bind(provider).bind(next).bind(contract_digest).bind(Json(&contract)).bind(status)
        .bind(auth.principal_id).bind(now).bind(response.receipt_id).execute(&mut *tx).await?;
    if session_bounds(&mut tx, &auth).await?.1 <= state.clock.now() {
        return Err(unavailable());
    }
    tx.commit().await.map_err(|e| ApiError::uncertain(&e))?;
    Ok(response)
}

/// Outer None means no durable decision: legacy remains eligible for its
/// existing checks. Some(None) is an authoritative refusal, including tombstones.
pub(crate) async fn project(
    conn: &mut PgConnection,
    auth: &Authenticated,
    authority: &WorkspaceAuthority,
    route: &str,
    now: DateTime<Utc>,
) -> Result<Option<Option<(i64, RouteEvidenceIdentity, OrganizationRouteApproval)>>, ApiError> {
    let Some(route_id) = RouteId::parse(route) else {
        return Err(unavailable());
    };
    // This existing route has one explicitly supported provider deployment.
    // Other routes do not inherit its consent.
    if route_id != RouteId::CodexResponses {
        return Ok(None);
    }
    let Some(consent) = stored(conn, authority.workspace.workspace_id, OPENAI_PROVIDER).await?
    else {
        return Ok(None);
    };
    let register = CapabilityRegister::load_embedded().map_err(|_| unavailable())?;
    let Some(entry) = register.entry(route_id.capability_id()) else {
        return Ok(Some(None));
    };
    let Some(contract) = processing_contract_for_entry(entry) else {
        return Ok(Some(None));
    };
    if consent.state != "allowed" || consent.digest != contract.digest() {
        return Ok(Some(None));
    }
    let Some(proof) = entry.negative_authorization.as_ref() else {
        return Ok(Some(None));
    };
    if compiled_route_evidence(&proof.identity, &proof.report_digest).is_none() {
        return Ok(Some(None));
    }
    let (created, expires) = session_bounds(conn, auth).await?;
    if expires <= now {
        return Ok(Some(None));
    }
    let revision = authority.workspace.authorization_epoch;
    let approval = OrganizationRouteApproval {
        workspace_id: authority.workspace.workspace_id.to_string(),
        route_id: route.into(),
        evidence_digest: proof.report_digest.clone(),
        processing_scope: proof.processing_scope.clone(),
        data_policy_digest: proof.data_policy_digest.clone(),
        issuer: "inquello-workspace-owner-consent-v1".into(),
        operator_reference: format!("provider-consent:{}:{}", OPENAI_PROVIDER, consent.revision),
        valid_from: created.max(consent.decided_at).timestamp(),
        review_at: expires.timestamp(),
        expires_at: expires.timestamp(),
        revision: u64::try_from(revision).map_err(|_| unavailable())?,
        policy_revision: u64::try_from(authority.workspace.policy_revision)
            .map_err(|_| unavailable())?,
        revoked: false,
    };
    Ok(Some(Some((revision, proof.identity.clone(), approval))))
}

/// Receipts reconcile a lost acknowledgement; they never confer processing authority.
pub(crate) async fn receipt(
    state: &AppState,
    access: &str,
    workspace: Uuid,
    operation: Uuid,
) -> Result<Option<CommandResponse>, ApiError> {
    let mut tx = state.pool.begin().await?;
    let auth = sessions::authenticate(
        &mut tx,
        access,
        state.clock.as_ref(),
        LockMode::Share,
        LockMode::Share,
    )
    .await?;
    let authority = workspaces::resolve(&mut tx, &auth, workspace, LockMode::Share).await?;
    authority.require_owner()?;
    let response: Option<Json<CommandResponse>> = sqlx::query_scalar(
        "SELECT response FROM provider_consent_receipts WHERE workspace_id=$1 AND operation_id=$2 AND principal_id=$3")
        .bind(workspace).bind(operation).bind(auth.principal_id).fetch_optional(&mut *tx).await?;
    if session_bounds(&mut tx, &auth).await?.1 <= state.clock.now() {
        return Err(unavailable());
    }
    tx.commit().await?;
    Ok(response.map(|value| value.0))
}
