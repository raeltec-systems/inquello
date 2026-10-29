//! A person's own command rules (Story 1.20): a per-principal, versioned
//! record in the working store, written with an operation ID, an expected
//! revision and a receipt.
//!
//! A person's rules only make things stricter: each one prompts or forbids.
//! An `allow` rule is refused with [`DomainError::UserRuleCannotAllow`].
//! Each write replaces the whole list as a new immutable record, so every
//! decision can name the version of the rules that controlled it.

use crate::DomainError;
use crate::OperationId;
use crate::ReceiptStatus;
use crate::Revision;
use crate::StoreError;
use crate::Timestamp;
use crate::execution_policy::command_rules::CommandRule;
use crate::execution_policy::command_rules::MAX_COMMAND_RULES;
use crate::execution_policy::command_rules::RuleDecision;
use crate::organise::Actor;
use crate::organise::PrincipalId;
use crate::ports::Clock;
use serde_json::Value;
use serde_json::json;
use std::future::Future;

/// The command name a user-rules receipt records.
pub const SET_USER_RULES_COMMAND: &str = "set_user_rules";

/// One recorded version of a person's rules. Never changed.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct UserRulesRecord {
    pub principal_id: PrincipalId,
    /// The rules version this record created (1, 2, …).
    pub revision: Revision,
    pub rules: Vec<CommandRule>,
    pub recorded_at: Timestamp,
}

/// A person's current rules.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct UserRules {
    /// 0 before the first record.
    pub revision: Revision,
    pub rules: Vec<CommandRule>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct UserRulesReceipt {
    pub operation_id: OperationId,
    pub principal_id: PrincipalId,
    pub expected_revision: Revision,
    pub resulting_revision: Revision,
    /// Canonical JSON of the validated request.
    pub request: String,
    pub status: ReceiptStatus,
    pub recorded_at: Timestamp,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct UserRulesChange {
    pub expected_revision: Revision,
    pub record: UserRulesRecord,
    pub receipt: UserRulesReceipt,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct UserRulesOutcome {
    pub receipt: UserRulesReceipt,
    pub record: UserRulesRecord,
    pub replayed: bool,
}

/// Durable storage for a person's rules.
pub trait UserRuleStore: Send + Sync {
    fn find_user_rules_receipt(
        &self,
        operation_id: &OperationId,
    ) -> impl Future<Output = Result<Option<UserRulesReceipt>, StoreError>> + Send;

    /// The principal's latest record, if any.
    fn load_user_rules(
        &self,
        principal_id: PrincipalId,
    ) -> impl Future<Output = Result<Option<UserRulesRecord>, StoreError>> + Send;

    /// The record that created version `revision`.
    fn load_user_rules_record(
        &self,
        principal_id: PrincipalId,
        revision: Revision,
    ) -> impl Future<Output = Result<Option<UserRulesRecord>, StoreError>> + Send;

    /// Atomically applies `change`. Returns
    /// [`StoreError::DuplicateOperation`] when the operation ID already has a
    /// receipt (checked first, under the same write lock) and
    /// [`StoreError::RevisionConflict`] when the version differs.
    fn commit_user_rules(
        &self,
        change: UserRulesChange,
    ) -> impl Future<Output = Result<(), StoreError>> + Send;
}

/// One rule as a person enters it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct UserRuleInput {
    pub prefix: Vec<String>,
    /// `prompt` or `forbid`; `allow` is refused.
    pub decision: String,
    pub note: Option<String>,
}

/// Replaces the person's rules with `rules`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SetUserRules {
    pub operation_id: String,
    pub expected_revision: Revision,
    pub rules: Vec<UserRuleInput>,
}

/// Validates a person's rules: prompt or forbid only, at most
/// [`MAX_COMMAND_RULES`], no prefix listed twice.
pub fn validate_user_rules(rules: &[UserRuleInput]) -> Result<Vec<CommandRule>, DomainError> {
    if rules.len() > MAX_COMMAND_RULES {
        return Err(DomainError::InvalidCommand(format!(
            "at most {MAX_COMMAND_RULES} rules may be listed"
        )));
    }
    let mut out: Vec<CommandRule> = Vec::with_capacity(rules.len());
    for input in rules {
        let decision = RuleDecision::parse(&input.decision).ok_or_else(|| {
            DomainError::InvalidCommand("decision must be prompt or forbid".to_string())
        })?;
        if decision == RuleDecision::Allow {
            return Err(DomainError::UserRuleCannotAllow);
        }
        let rule = CommandRule::new(input.prefix.clone(), decision, input.note.clone())
            .map_err(DomainError::InvalidCommand)?;
        if out.iter().any(|known| known.prefix == rule.prefix) {
            return Err(DomainError::InvalidCommand(
                "a prefix is listed more than once".to_string(),
            ));
        }
        out.push(rule);
    }
    Ok(out)
}

/// The stored form of a rule list.
pub fn rules_to_value(rules: &[CommandRule]) -> Value {
    Value::Array(rules.iter().map(CommandRule::to_value).collect())
}

/// Reads a stored rule list back.
pub fn rules_from_value(value: &Value) -> Result<Vec<CommandRule>, String> {
    value
        .as_array()
        .ok_or_else(|| "the rules are not a list".to_string())?
        .iter()
        .map(CommandRule::from_value)
        .collect()
}

/// The person's current rules.
pub async fn user_rules<S>(store: &S, actor: Actor) -> Result<UserRules, DomainError>
where
    S: UserRuleStore,
{
    let record = store
        .load_user_rules(actor.principal_id)
        .await
        .map_err(DomainError::Store)?
        .filter(|record| record.principal_id == actor.principal_id);
    Ok(match record {
        Some(record) => UserRules {
            revision: record.revision,
            rules: record.rules,
        },
        None => UserRules {
            revision: Revision::ZERO,
            rules: Vec::new(),
        },
    })
}

/// Handles [`SetUserRules`] for the session's principal.
pub async fn set_user_rules<S, C>(
    store: &S,
    clock: &C,
    actor: Actor,
    command: SetUserRules,
) -> Result<UserRulesOutcome, DomainError>
where
    S: UserRuleStore,
    C: Clock,
{
    let rules = validate_user_rules(&command.rules)?;
    let operation_id = OperationId::parse(&command.operation_id)?;
    let expected = command.expected_revision;
    let request = json!({ "rules": rules_to_value(&rules) }).to_string();
    if let Some(outcome) = replay(store, actor, &operation_id, expected, &request).await? {
        return Ok(outcome);
    }
    let result = apply(
        store,
        clock,
        actor,
        &operation_id,
        expected,
        rules,
        &request,
    )
    .await;
    match result {
        // A concurrent request with the same operation ID may have committed
        // between the first lookup and this refusal: replay it (R10).
        Err(error) if crate::commands::may_follow_concurrent_apply(&error) => {
            match replay(store, actor, &operation_id, expected, &request).await? {
                Some(outcome) => Ok(outcome),
                None => Err(error),
            }
        }
        result => result,
    }
}

async fn apply<S, C>(
    store: &S,
    clock: &C,
    actor: Actor,
    operation_id: &OperationId,
    expected: Revision,
    rules: Vec<CommandRule>,
    request: &str,
) -> Result<UserRulesOutcome, DomainError>
where
    S: UserRuleStore,
    C: Clock,
{
    let current = user_rules(store, actor).await?;
    if current.revision != expected {
        return Err(DomainError::RevisionConflict {
            expected,
            actual: current.revision,
        });
    }
    let now = clock.now();
    let record = UserRulesRecord {
        principal_id: actor.principal_id,
        revision: expected.next()?,
        rules,
        recorded_at: now,
    };
    let receipt = UserRulesReceipt {
        operation_id: operation_id.clone(),
        principal_id: actor.principal_id,
        expected_revision: expected,
        resulting_revision: record.revision,
        request: request.to_string(),
        status: ReceiptStatus::Applied,
        recorded_at: now,
    };
    let change = UserRulesChange {
        expected_revision: expected,
        record: record.clone(),
        receipt: receipt.clone(),
    };
    match store.commit_user_rules(change).await {
        Ok(()) => Ok(UserRulesOutcome {
            receipt,
            record,
            replayed: false,
        }),
        Err(StoreError::RevisionConflict { expected, actual }) => {
            Err(DomainError::RevisionConflict { expected, actual })
        }
        Err(error @ StoreError::DuplicateOperation { .. }) => {
            match replay(store, actor, operation_id, expected, request).await? {
                Some(outcome) => Ok(outcome),
                None => Err(DomainError::Store(error)),
            }
        }
        Err(error) => Err(DomainError::Store(error)),
    }
}

async fn replay<S>(
    store: &S,
    actor: Actor,
    operation_id: &OperationId,
    expected: Revision,
    request: &str,
) -> Result<Option<UserRulesOutcome>, DomainError>
where
    S: UserRuleStore,
{
    let Some(receipt) = store
        .find_user_rules_receipt(operation_id)
        .await
        .map_err(DomainError::Store)?
    else {
        return Ok(None);
    };
    if receipt.principal_id != actor.principal_id
        || receipt.expected_revision != expected
        || receipt.request != request
    {
        return Err(DomainError::OperationConflict {
            operation_id: operation_id.clone(),
        });
    }
    let record = store
        .load_user_rules_record(receipt.principal_id, receipt.resulting_revision)
        .await
        .map_err(DomainError::Store)?
        .ok_or_else(|| {
            DomainError::Store(StoreError::Corrupt(
                "a set_user_rules receipt names a missing record".to_string(),
            ))
        })?;
    Ok(Some(UserRulesOutcome {
        receipt,
        record,
        replayed: true,
    }))
}
