//! A trusted runtime review is separate from the externally supplied actor kind.
//! This port writes an attributed verdict and receipt atomically while rechecking
//! creator, pending request, expiry, selected candidate and local-rule revisions.
use super::*;
use crate::organise::{Actor, PermissionRequestId};
use crate::{Clock, DomainError, OperationId, ReceiptStatus, Revision, StoreError};
use std::future::Future;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ReviewAttribution {
    pub invocation_id: String,
    pub attempt_id: String,
    pub action_digest: String,
    pub route_id: String,
    pub model: String,
    pub policy_revision: u64,
    pub authority_epoch: u64,
    pub credential_generation: u64,
    pub route_revision: Revision,
    pub configuration_revision: Revision,
    pub user_rules_revision: Revision,
    pub broad_mode_revision: Revision,
}
impl ReviewAttribution {
    pub fn to_value(&self) -> serde_json::Value {
        serde_json::json!({"invocation_id":self.invocation_id,"attempt_id":self.attempt_id,
            "action_digest":self.action_digest,"route_id":self.route_id,"model":self.model,
            "policy_revision":self.policy_revision,"authority_epoch":self.authority_epoch,
            "credential_generation":self.credential_generation,"route_revision":self.route_revision.get(),
            "configuration_revision":self.configuration_revision.get(),"user_rules_revision":self.user_rules_revision.get(),
            "broad_mode_revision":self.broad_mode_revision.get()})
    }
}
#[derive(Clone, Debug)]
pub struct AutomatedReviewChange {
    pub request: PermissionRequest,
    pub decision: PermissionDecision,
    pub receipt: PermissionReceipt,
    pub attribution: ReviewAttribution,
}
pub trait AutomatedReviewStore: PermissionStore {
    fn commit_automated_review(&self, change: AutomatedReviewChange)
        -> impl Future<Output = Result<(), StoreError>> + Send;
}
/// Runtime-only command: caller owns unforgeable invocation and holds its
/// authority/cancellation guard through this atomic store commit. No RPC maps
/// actor_ref or a supplied verdict to this entry point.
pub async fn apply_automated_review<S: AutomatedReviewStore, C: Clock>(store: &S, clock: &C,
    actor: Actor, request_id: PermissionRequestId, current: &CommandEvaluation,
    verdict: ReviewerVerdict, attribution: ReviewAttribution) -> Result<PermissionRequestOutcome, DomainError> {
    let request = permission_request(store, actor, &request_id.to_string()).await?;
    let now = clock.now();
    if request.status(now) != RequestStatus::Pending || request.evaluation.command != current.command
        || request.evaluation.destination != current.destination { return Err(DomainError::RequestNotPending); }
    if uuid::Uuid::parse_str(&attribution.invocation_id).is_err() || uuid::Uuid::parse_str(&attribution.attempt_id).is_err()
        || attribution.action_digest.len() != 64 { return Err(DomainError::InvalidCommand("invalid review attribution".into())); }
    let outcome = match bounded_reviewer_verdict(current, verdict) { ReviewerVerdict::Allow => PermissionOutcome::Allowed, ReviewerVerdict::Deny => PermissionOutcome::Denied };
    let decision = PermissionDecision { outcome, actor_kind: DeciderKind::AutomatedReviewer,
        actor_ref: attribution.invocation_id.clone(), decided_at: now };
    let receipt = PermissionReceipt { operation_id: OperationId::parse(&format!("review-{}", attribution.invocation_id))?,
        principal_id: actor.principal_id, command: DECIDE_PERMISSION_COMMAND.into(), request_id,
        expected_revision: Revision::new(1), resulting_revision: Revision::new(2),
        request: serde_json::json!({"request_id":request_id.to_string(),"outcome":outcome.as_str(),
            "actor_kind":"automated_reviewer","actor_ref":attribution.invocation_id,"review":attribution.to_value()}).to_string(),
        status: ReceiptStatus::Applied, recorded_at: now };
    store.commit_automated_review(AutomatedReviewChange { request: request.clone(), decision: decision.clone(), receipt: receipt.clone(), attribution }).await
        .map_err(|error| match error { StoreError::RevisionConflict { .. } | StoreError::DuplicateOperation { .. } => DomainError::RequestNotPending,
            error => DomainError::Store(error) })?;
    Ok(PermissionRequestOutcome { receipt, request: PermissionRequest { decision: Some(decision), ..request }, replayed: false })
}
