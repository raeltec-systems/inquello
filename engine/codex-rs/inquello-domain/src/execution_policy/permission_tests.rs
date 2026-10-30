//! The Story 1.20 I/O matrix at the domain level: command rules and their
//! validation, the decision of one command, a person's own rules, permission
//! requests and decisions, and the automatic permission reviewer, against an
//! in-memory port with the same atomic contract as SQLite.

use super::*;
use crate::Clock;
use crate::DomainError;
use crate::OperationId;
use crate::Revision;
use crate::StoreError;
use crate::Timestamp;
use crate::authorization::PolicyError;
use crate::authorization::WorkspacePolicy;
use crate::organise::Actor;
use crate::organise::PermissionRequestId;
use crate::organise::PrincipalId;
use crate::organise::TaskId;
use crate::organise::WorkspaceId;
use pretty_assertions::assert_eq;
use serde_json::Value;
use serde_json::json;
use std::collections::HashMap;
use std::pin::pin;
use std::sync::Mutex;
use std::sync::atomic::AtomicI64;
use std::sync::atomic::Ordering;
use std::task::Context;
use std::task::Poll;
use std::task::Waker;

const WORKSPACE: &str = "5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e";

fn block_on<F: std::future::Future>(future: F) -> F::Output {
    let mut future = pin!(future);
    let mut context = Context::from_waker(Waker::noop());
    loop {
        if let Poll::Ready(output) = future.as_mut().poll(&mut context) {
            return output;
        }
    }
}

fn ok<T, E: std::fmt::Display>(result: Result<T, E>) -> T {
    result.unwrap_or_else(|error| panic!("{error}"))
}

fn workspace_id() -> WorkspaceId {
    ok(WorkspaceId::parse(WORKSPACE))
}

fn policy_with(execution: Value) -> Result<WorkspacePolicy, PolicyError> {
    WorkspacePolicy::from_value(&json!({
        "policy_version": 1,
        "roles": [{ "id": "lead", "kind": "audit_team", "label": "Lead", "actions": ["read", "manage_membership"] }],
        "execution": execution,
    }))
}

fn effective(execution: Value) -> EffectivePolicy {
    let execution = ok(ExecutionPolicy::from_value(&execution));
    effective_policy(
        &WorkspaceLayer {
            workspace_id: workspace_id(),
            policy_revision: Revision::new(6),
            authorization_epoch: Revision::new(2),
            execution: Some(execution),
        },
        &DeviceRequirements::default(),
        &UserConfig::default(),
    )
}

fn words(command: &[&str]) -> Vec<String> {
    command.iter().map(|word| (*word).to_string()).collect()
}

fn rule(prefix: &[&str], decision: RuleDecision) -> CommandRule {
    ok(CommandRule::new(words(prefix), decision, None))
}

/// The prefix test the runtime's exec-policy applies to literal tokens
/// (the app-server runs the runtime's own matcher; see its tests).
fn literal_matches(command: &[String], rules: &[SourcedRule]) -> Vec<bool> {
    rules
        .iter()
        .map(|rule| {
            command.len() >= rule.rule.prefix.len()
                && command[..rule.rule.prefix.len()] == rule.rule.prefix[..]
        })
        .collect()
}

fn evaluate(
    policy: &EffectivePolicy,
    user: &[CommandRule],
    command: &[&str],
    status: BroadModeStatus,
) -> CommandEvaluation {
    let rules = effective_rules(policy, user, Revision::new(3));
    let command = words(command);
    let matched = literal_matches(&command, &rules);
    evaluate_command(&command, &rules, &matched, policy, status)
}

// ---- Workspace rules: validation --------------------------------------------------

#[test]
fn workspace_command_rules_validate_and_round_trip() {
    let section = json!({
        "command_rules": [
            { "prefix": ["git", "push"], "decision": "prompt", "note": "Pushes leave this device" },
            { "prefix": ["rm"], "decision": "forbid" },
            { "prefix": ["ls"], "decision": "allow" },
        ],
        "automatic_permission_review": false,
    });
    let policy = ok(ExecutionPolicy::from_value(&section));
    assert_eq!(policy.command_rules().len(), 3);
    assert_eq!(
        policy.command_rules()[0].note.as_deref(),
        Some("Pushes leave this device")
    );
    assert_eq!(policy.automatic_permission_review, Some(false));
    assert_eq!(policy.to_value(), section);
    assert!(policy_with(section).is_ok());
}

#[test]
fn invalid_workspace_command_rules_are_refused() {
    for (rules, why) in [
        (
            json!({ "prefix": [], "decision": "prompt" }),
            "at least one token",
        ),
        (
            json!({ "prefix": [""], "decision": "prompt" }),
            "must not be empty",
        ),
        (
            json!({ "prefix": ["git push"], "decision": "prompt" }),
            "one command word",
        ),
        (
            json!({ "prefix": ["rm", "*"], "decision": "forbid" }),
            "never shell or glob patterns",
        ),
        (
            json!({ "prefix": ["echo", "$HOME"], "decision": "forbid" }),
            "never shell or glob patterns",
        ),
        (
            json!({ "prefix": ["a;b"], "decision": "forbid" }),
            "never shell or glob patterns",
        ),
        (
            json!({ "prefix": ["git"], "decision": "maybe" }),
            "\"allow\", \"prompt\" or \"forbid\"",
        ),
        (
            json!({ "prefix": ["git"], "decision": "allow", "pattern": "x" }),
            "unknown field",
        ),
        (
            json!({ "prefix": "git", "decision": "allow" }),
            "array of command words",
        ),
        (
            json!({ "prefix": [1], "decision": "allow" }),
            "must be a string",
        ),
    ] {
        let section = json!({ "command_rules": [rules] });
        match ExecutionPolicy::from_value(&section) {
            Err(PolicyError::InvalidExecution(message)) => {
                assert!(message.contains(why), "{message} / {why}")
            }
            other => panic!("{section} was not refused: {other:?}"),
        }
    }
    let duplicate = json!({ "command_rules": [
        { "prefix": ["git"], "decision": "allow" },
        { "prefix": ["git"], "decision": "forbid" },
    ] });
    assert!(
        matches!(ExecutionPolicy::from_value(&duplicate), Err(PolicyError::InvalidExecution(m)) if m.contains("more than once"))
    );
    let review = json!({ "automatic_permission_review": "yes" });
    assert!(matches!(
        ExecutionPolicy::from_value(&review),
        Err(PolicyError::InvalidExecution(_))
    ));
    let too_many: Vec<Value> = (0..=MAX_COMMAND_RULES)
        .map(|i| json!({ "prefix": [format!("tool{i}")], "decision": "prompt" }))
        .collect();
    assert!(ExecutionPolicy::from_value(&json!({ "command_rules": too_many })).is_err());
}

// ---- the decision of one command ---------------------------------------------------

#[test]
fn a_workspace_prompt_rule_asks_and_names_the_rule_destination_and_consequences() {
    let policy = effective(
        json!({ "command_rules": [{ "prefix": ["git", "push"], "decision": "prompt" }] }),
    );
    let evaluation = evaluate(
        &policy,
        &[],
        &["git", "push", "origin", "main"],
        BroadModeStatus::Standard,
    );
    assert_eq!(evaluation.decision, RuleDecision::Prompt);
    assert_eq!(
        evaluation.controlling_rule,
        Some(rule(&["git", "push"], RuleDecision::Prompt))
    );
    assert_eq!(
        evaluation.source,
        RuleSource::WorkspacePolicy {
            revision: Revision::new(6)
        }
    );
    assert_eq!(evaluation.command_text(), "git push origin main");
    assert_eq!(
        evaluation.analysis,
        "Runs `git push origin main` in this Task's working folder, with no network access."
    );
    assert_eq!(
        evaluation.destination,
        "This Task's working folder and Output folder; no network destination"
    );
    assert!(evaluation.consequence.contains("cannot undo"));
    assert!(evaluation.consequence.contains("adds no rule"));
    assert_eq!(
        evaluation.rule_text(),
        "`git push` (prompt), from Workspace policy, revision 6"
    );
    assert!(!evaluation.cannot_ask);
}

#[test]
fn forbid_wins_over_prompt_and_prompt_over_allow() {
    let policy = effective(json!({ "command_rules": [
        { "prefix": ["git"], "decision": "allow" },
        { "prefix": ["git", "push"], "decision": "prompt" },
        { "prefix": ["git", "push", "--force"], "decision": "forbid" },
    ] }));
    assert_eq!(
        evaluate(&policy, &[], &["git", "status"], BroadModeStatus::Standard).decision,
        RuleDecision::Allow
    );
    assert_eq!(
        evaluate(&policy, &[], &["git", "push"], BroadModeStatus::Standard).decision,
        RuleDecision::Prompt
    );
    let forced = evaluate(
        &policy,
        &[],
        &["git", "push", "--force", "origin"],
        BroadModeStatus::Standard,
    );
    assert_eq!(forced.decision, RuleDecision::Forbid);
    assert_eq!(
        forced.controlling_rule.map(|rule| rule.prefix),
        Some(words(&["git", "push", "--force"]))
    );
}

#[test]
fn a_workspace_allow_and_a_user_forbid_on_the_same_prefix_forbid_from_your_rule() {
    let policy =
        effective(json!({ "command_rules": [{ "prefix": ["curl"], "decision": "allow" }] }));
    let user = [rule(&["curl"], RuleDecision::Forbid)];
    let evaluation = evaluate(
        &policy,
        &user,
        &["curl", "https://example.com/"],
        BroadModeStatus::Standard,
    );
    assert_eq!(evaluation.decision, RuleDecision::Forbid);
    assert_eq!(
        evaluation.source,
        RuleSource::UserRule {
            version: Revision::new(3)
        }
    );
    assert_eq!(evaluation.source.to_string(), "your rule");
}

#[test]
fn with_no_match_the_asking_behaviour_decides() {
    let standard = effective(json!({}));
    let allowed = evaluate(&standard, &[], &["ls"], BroadModeStatus::Standard);
    assert_eq!(allowed.decision, RuleDecision::Allow);
    assert_eq!(allowed.controlling_rule, None);
    assert_eq!(
        allowed.source,
        RuleSource::ApprovalBehaviour {
            behaviour: ApprovalBehaviour::OnRequest
        }
    );
    let untrusted = effective(json!({ "approvals": ["untrusted"] }));
    let asked = evaluate(&untrusted, &[], &["ls"], BroadModeStatus::Standard);
    assert_eq!(asked.decision, RuleDecision::Prompt);
    assert_eq!(
        asked.source,
        RuleSource::ApprovalBehaviour {
            behaviour: ApprovalBehaviour::Untrusted
        }
    );
    assert!(asked.rule_text().starts_with("No command rule matches"));
}

#[test]
fn a_prompt_under_a_mode_that_never_asks_is_refused() {
    let policy = effective(json!({
        "approvals": ["on_request", "never"],
        "allow_no_prompt": true,
        "command_rules": [{ "prefix": ["git", "push"], "decision": "prompt" }],
    }));
    let evaluation = evaluate(
        &policy,
        &[],
        &["git", "push"],
        BroadModeStatus::Active(BroadMode::NoPrompt),
    );
    assert_eq!(evaluation.decision, RuleDecision::Forbid);
    assert!(evaluation.cannot_ask);
}

#[test]
fn analysis_names_listed_and_unlisted_hosts() {
    let policy = effective(json!({ "network": "allowed", "allowed_domains": ["api.example.com"] }));
    let listed = evaluate(
        &policy,
        &[],
        &["curl", "https://api.example.com/v1"],
        BroadModeStatus::Standard,
    );
    assert_eq!(
        listed.analysis,
        "Runs `curl https://api.example.com/v1` in this Task's working folder, which contacts api.example.com."
    );
    assert_eq!(
        listed.destination,
        "This Task's working folder and Output folder; network: only api.example.com"
    );
    let unlisted = evaluate(
        &policy,
        &[],
        &["curl", "http://user@other.example:8080/x"],
        BroadModeStatus::Standard,
    );
    assert!(
        unlisted
            .analysis
            .contains("names other.example, which is not on this Workspace's allowed list"),
        "{}",
        unlisted.analysis
    );
    assert_eq!(
        named_hosts(&words(&[
            "git",
            "clone",
            "https://[::1]:9/r",
            "ssh://git@github.com/o/r"
        ])),
        vec!["::1", "github.com"]
    );
    assert!(host_listed("a.example.com", &["*.example.com".to_string()]));
    assert!(!host_listed("example.com", &["*.example.com".to_string()]));
    assert!(host_listed("example.com", &["**.example.com".to_string()]));
    assert_eq!(
        display_command(&words(&["sh", "-c", "echo 'hi there'"])),
        "sh -c 'echo '\\''hi there'\\'''"
    );
}

#[test]
fn the_evaluation_round_trips_its_stored_form() {
    let policy = effective(
        json!({ "command_rules": [{ "prefix": ["git", "push"], "decision": "prompt", "note": "Leaves the device" }] }),
    );
    for evaluation in [
        evaluate(&policy, &[], &["git", "push"], BroadModeStatus::Standard),
        evaluate(
            &policy,
            &[rule(&["make"], RuleDecision::Prompt)],
            &["make", "all"],
            BroadModeStatus::Standard,
        ),
        evaluate(&policy, &[], &["ls", "-la"], BroadModeStatus::Standard),
    ] {
        assert_eq!(
            ok(CommandEvaluation::from_value(&evaluation.to_value())),
            evaluation
        );
    }
}

// ---- the automatic permission reviewer ---------------------------------------------

#[test]
fn the_reviewer_is_off_by_default_and_not_available_without_a_route() {
    let default = effective(json!({}));
    assert_eq!(permission_reviewer(&default, false), ReviewerState::Off);
    assert_eq!(permission_reviewer(&default, true), ReviewerState::Off);
    assert_eq!(ReviewerState::Off.runtime_setting(), "user");
    let on = effective(json!({ "automatic_permission_review": true }));
    assert_eq!(on.automatic_permission_review.value, true);
    let state = permission_reviewer(&on, false);
    assert_eq!(state, ReviewerState::NotAvailable);
    assert_eq!(
        state.label(),
        "Automated permission review: not available (no processing route)"
    );
    assert_eq!(state.runtime_setting(), "user");
    assert_eq!(
        permission_reviewer(&on, true).runtime_setting(),
        "user"
    );
}

#[test]
fn a_reviewer_verdict_cannot_override_forbid_or_a_mode_that_never_asks() {
    let policy = effective(json!({
        "approvals": ["on_request", "never"],
        "allow_no_prompt": true,
        "command_rules": [
            { "prefix": ["rm"], "decision": "forbid" },
            { "prefix": ["git", "push"], "decision": "prompt" },
        ],
    }));
    let forbid = evaluate(&policy, &[], &["rm", "-rf", "x"], BroadModeStatus::Standard);
    assert_eq!(
        bounded_reviewer_verdict(&forbid, ReviewerVerdict::Allow),
        ReviewerVerdict::Deny
    );
    let prompt = evaluate(&policy, &[], &["git", "push"], BroadModeStatus::Standard);
    assert_eq!(
        bounded_reviewer_verdict(&prompt, ReviewerVerdict::Allow),
        ReviewerVerdict::Allow
    );
    assert_eq!(
        bounded_reviewer_verdict(&prompt, ReviewerVerdict::Deny),
        ReviewerVerdict::Deny
    );
    let never = evaluate(
        &policy,
        &[],
        &["git", "push"],
        BroadModeStatus::Active(BroadMode::NoPrompt),
    );
    assert_eq!(
        bounded_reviewer_verdict(&never, ReviewerVerdict::Allow),
        ReviewerVerdict::Deny
    );
    assert_eq!(
        AUTOMATED_DECISION_LABEL,
        "Automated permission review — not analytical review or Professional Approval"
    );
}

// ---- the in-memory port -------------------------------------------------------------

#[derive(Default)]
struct FakeState {
    tasks: HashMap<TaskId, BroadModeTask>,
    rule_records: Vec<UserRulesRecord>,
    rule_receipts: HashMap<OperationId, UserRulesReceipt>,
    requests: HashMap<PermissionRequestId, PermissionRequest>,
    receipts: HashMap<OperationId, PermissionReceipt>,
}

#[derive(Default)]
struct FakeStore {
    state: Mutex<FakeState>,
}

impl FakeStore {
    fn with<T>(&self, f: impl FnOnce(&mut FakeState) -> T) -> T {
        f(&mut self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner))
    }

    fn add_task(&self, creator: Actor) -> TaskId {
        let task_id = TaskId::new_random();
        self.with(|s| {
            s.tasks.insert(
                task_id,
                BroadModeTask {
                    creator: creator.principal_id,
                    workspace_id: workspace_id(),
                },
            )
        });
        task_id
    }
}

impl UserRuleStore for FakeStore {
    async fn find_user_rules_receipt(
        &self,
        operation_id: &OperationId,
    ) -> Result<Option<UserRulesReceipt>, StoreError> {
        Ok(self.with(|s| s.rule_receipts.get(operation_id).cloned()))
    }

    async fn load_user_rules(
        &self,
        principal_id: PrincipalId,
    ) -> Result<Option<UserRulesRecord>, StoreError> {
        Ok(self.with(|s| {
            s.rule_records
                .iter()
                .filter(|r| r.principal_id == principal_id)
                .max_by_key(|r| r.revision.get())
                .cloned()
        }))
    }

    async fn load_user_rules_record(
        &self,
        principal_id: PrincipalId,
        revision: Revision,
    ) -> Result<Option<UserRulesRecord>, StoreError> {
        Ok(self.with(|s| {
            s.rule_records
                .iter()
                .find(|r| r.principal_id == principal_id && r.revision == revision)
                .cloned()
        }))
    }

    async fn commit_user_rules(&self, change: UserRulesChange) -> Result<(), StoreError> {
        self.with(|s| {
            if s.rule_receipts.contains_key(&change.receipt.operation_id) {
                return Err(StoreError::DuplicateOperation {
                    operation_id: change.receipt.operation_id,
                });
            }
            let actual = s
                .rule_records
                .iter()
                .filter(|r| r.principal_id == change.record.principal_id)
                .map(|r| r.revision)
                .max_by_key(|r| r.get())
                .unwrap_or(Revision::ZERO);
            if actual != change.expected_revision {
                return Err(StoreError::RevisionConflict {
                    expected: change.expected_revision,
                    actual,
                });
            }
            s.rule_records.push(change.record);
            s.rule_receipts
                .insert(change.receipt.operation_id.clone(), change.receipt);
            Ok(())
        })
    }
}

impl PermissionStore for FakeStore {
    async fn find_permission_receipt(
        &self,
        operation_id: &OperationId,
    ) -> Result<Option<PermissionReceipt>, StoreError> {
        Ok(self.with(|s| s.receipts.get(operation_id).cloned()))
    }

    async fn load_permission_task(
        &self,
        task_id: TaskId,
    ) -> Result<Option<BroadModeTask>, StoreError> {
        Ok(self.with(|s| s.tasks.get(&task_id).copied()))
    }

    async fn load_permission_request(
        &self,
        request_id: PermissionRequestId,
    ) -> Result<Option<PermissionRequest>, StoreError> {
        Ok(self.with(|s| s.requests.get(&request_id).cloned()))
    }

    async fn list_undecided_requests(
        &self,
        principal_id: PrincipalId,
        task_id: Option<TaskId>,
    ) -> Result<Vec<PermissionRequest>, StoreError> {
        Ok(self.with(|s| {
            let mut out: Vec<PermissionRequest> = s
                .requests
                .values()
                .filter(|r| {
                    r.principal_id == principal_id
                        && r.decision.is_none()
                        && task_id.is_none_or(|task| r.task_id == task)
                })
                .cloned()
                .collect();
            out.sort_by_key(|r| r.created_at.unix_millis());
            out
        }))
    }

    async fn commit_permission_request(
        &self,
        change: NewPermissionRequest,
    ) -> Result<(), StoreError> {
        self.with(|s| {
            if s.receipts.contains_key(&change.receipt.operation_id) {
                return Err(StoreError::DuplicateOperation {
                    operation_id: change.receipt.operation_id,
                });
            }
            if s.requests.contains_key(&change.request.request_id) {
                return Err(StoreError::RevisionConflict {
                    expected: Revision::ZERO,
                    actual: Revision::new(1),
                });
            }
            s.requests.insert(change.request.request_id, change.request);
            s.receipts
                .insert(change.receipt.operation_id.clone(), change.receipt);
            Ok(())
        })
    }

    async fn commit_permission_decision(
        &self,
        change: PermissionDecisionChange,
    ) -> Result<(), StoreError> {
        self.with(|s| {
            if s.receipts.contains_key(&change.receipt.operation_id) {
                return Err(StoreError::DuplicateOperation {
                    operation_id: change.receipt.operation_id,
                });
            }
            let Some(request) = s.requests.get_mut(&change.request_id) else {
                return Err(StoreError::Backend("no such request".to_string()));
            };
            if request.decision.is_some() {
                return Err(StoreError::RevisionConflict {
                    expected: Revision::new(1),
                    actual: Revision::new(2),
                });
            }
            request.decision = Some(change.decision);
            s.receipts
                .insert(change.receipt.operation_id.clone(), change.receipt);
            Ok(())
        })
    }

    async fn mark_permission_used(
        &self,
        request_id: PermissionRequestId,
        at: Timestamp,
    ) -> Result<bool, StoreError> {
        Ok(self.with(|s| match s.requests.get_mut(&request_id) {
            Some(request)
                if request.used_at.is_none()
                    && request
                        .decision
                        .as_ref()
                        .is_some_and(|d| d.outcome == PermissionOutcome::Allowed) =>
            {
                request.used_at = Some(at);
                true
            }
            _ => false,
        }))
    }
}

/// A clock the tests move forward.
struct TestClock(AtomicI64);

impl TestClock {
    fn new() -> Self {
        Self(AtomicI64::new(1_000))
    }

    fn advance(&self, millis: i64) {
        self.0.fetch_add(millis, Ordering::SeqCst);
    }
}

impl crate::Clock for TestClock {
    fn now(&self) -> Timestamp {
        Timestamp::from_unix_millis(self.0.load(Ordering::SeqCst))
    }
}

fn actor() -> Actor {
    Actor {
        principal_id: PrincipalId::new_random(),
    }
}

fn prompt_evaluation(command: &[&str]) -> CommandEvaluation {
    let policy =
        effective(json!({ "command_rules": [{ "prefix": [command[0]], "decision": "prompt" }] }));
    evaluate(&policy, &[], command, BroadModeStatus::Standard)
}

fn ask(
    store: &FakeStore,
    clock: &TestClock,
    me: Actor,
    task: TaskId,
    command: &[&str],
    operation: &str,
) -> Result<PermissionRequestOutcome, DomainError> {
    block_on(request_permission(
        store,
        clock,
        me,
        RequestPermission {
            operation_id: operation.to_string(),
            request_id: PermissionRequestId::new_random().to_string(),
            task_id: task.to_string(),
            origin: "tools_exec".to_string(),
            evaluation: prompt_evaluation(command),
            ttl_ms: 60_000,
        },
    ))
}

fn decide(
    store: &FakeStore,
    clock: &TestClock,
    me: Actor,
    request: PermissionRequestId,
    outcome: &str,
    decider: Decider,
    operation: &str,
) -> Result<PermissionRequestOutcome, DomainError> {
    block_on(decide_permission(
        store,
        clock,
        me,
        DecidePermission {
            operation_id: operation.to_string(),
            expected_revision: Revision::new(1),
            request_id: request.to_string(),
            outcome: outcome.to_string(),
            decider,
        },
    ))
}

// ---- permission requests and decisions ----------------------------------------------

#[test]
fn an_allowed_request_authorizes_that_exact_command_once() {
    let (store, clock, me) = (FakeStore::default(), TestClock::new(), actor());
    let task = store.add_task(me);
    let asked = ok(ask(
        &store,
        &clock,
        me,
        task,
        &["git", "push", "origin", "main"],
        "op-ask",
    ));
    assert_eq!(asked.request.status(clock.now()), RequestStatus::Pending);
    assert_eq!(asked.request.revision(), Revision::new(1));
    assert_eq!(asked.receipt.command, REQUEST_PERMISSION_COMMAND);
    let id = asked.request.request_id;
    let pending = ok(block_on(pending_requests(
        &store,
        me,
        Some(&task.to_string()),
        clock.now(),
    )));
    assert_eq!(pending.len(), 1);
    let allowed = ok(decide(
        &store,
        &clock,
        me,
        id,
        "allowed",
        Decider::Human,
        "op-allow",
    ));
    let decision = allowed
        .request
        .decision
        .clone()
        .unwrap_or_else(|| panic!("no decision"));
    assert_eq!(
        (decision.outcome, decision.actor_kind),
        (PermissionOutcome::Allowed, DeciderKind::Human)
    );
    assert_eq!(decision.actor_ref, me.principal_id.to_string());
    assert_eq!(allowed.receipt.resulting_revision, Revision::new(2));
    // A different command, or another Task, is not covered.
    assert_eq!(
        block_on(use_permission(
            &store,
            &clock,
            me,
            &id.to_string(),
            task,
            &words(&["git", "push", "origin", "other"])
        )),
        Err(DomainError::PermissionNotGranted)
    );
    assert_eq!(
        block_on(use_permission(
            &store,
            &clock,
            me,
            &id.to_string(),
            TaskId::new_random(),
            &words(&["git", "push", "origin", "main"])
        )),
        Err(DomainError::PermissionNotGranted)
    );
    let used = ok(block_on(use_permission(
        &store,
        &clock,
        me,
        &id.to_string(),
        task,
        &words(&["git", "push", "origin", "main"]),
    )));
    assert!(used.used_at.is_some());
    // Once only.
    assert_eq!(
        block_on(use_permission(
            &store,
            &clock,
            me,
            &id.to_string(),
            task,
            &words(&["git", "push", "origin", "main"])
        )),
        Err(DomainError::PermissionNotGranted)
    );
}

#[test]
fn a_denial_performs_nothing_and_leaves_other_pending_requests_intact() {
    let (store, clock, me) = (FakeStore::default(), TestClock::new(), actor());
    let task = store.add_task(me);
    let first = ok(ask(&store, &clock, me, task, &["git", "push"], "op-1"))
        .request
        .request_id;
    let second = ok(ask(&store, &clock, me, task, &["make", "deploy"], "op-2"))
        .request
        .request_id;
    let denied = ok(decide(
        &store,
        &clock,
        me,
        first,
        "denied",
        Decider::Human,
        "op-deny",
    ));
    assert_eq!(denied.request.status(clock.now()), RequestStatus::Denied);
    assert_eq!(
        block_on(use_permission(
            &store,
            &clock,
            me,
            &first.to_string(),
            task,
            &words(&["git", "push"])
        )),
        Err(DomainError::PermissionNotGranted)
    );
    let pending = ok(block_on(pending_requests(&store, me, None, clock.now())));
    assert_eq!(
        pending.iter().map(|r| r.request_id).collect::<Vec<_>>(),
        vec![second]
    );
}

#[test]
fn a_stale_or_expired_request_cannot_be_confirmed() {
    let (store, clock, me) = (FakeStore::default(), TestClock::new(), actor());
    let task = store.add_task(me);
    let id = ok(ask(&store, &clock, me, task, &["git", "push"], "op-1"))
        .request
        .request_id;
    ok(decide(
        &store,
        &clock,
        me,
        id,
        "denied",
        Decider::Human,
        "op-deny",
    ));
    assert_eq!(
        decide(&store, &clock, me, id, "allowed", Decider::Human, "op-late"),
        Err(DomainError::RequestNotPending)
    );
    let expiring = ok(ask(&store, &clock, me, task, &["git", "push"], "op-2"))
        .request
        .request_id;
    clock.advance(60_000);
    assert_eq!(
        decide(
            &store,
            &clock,
            me,
            expiring,
            "allowed",
            Decider::Human,
            "op-after-expiry"
        ),
        Err(DomainError::RequestNotPending)
    );
    assert!(ok(block_on(pending_requests(&store, me, None, clock.now()))).is_empty());
    // The host records the expiry; it never allows.
    let expired = ok(decide(
        &store,
        &clock,
        me,
        expiring,
        "expired",
        Decider::System {
            reference: "inquello-desktop".to_string(),
        },
        "op-expire",
    ));
    assert_eq!(expired.request.status(clock.now()), RequestStatus::Expired);
    let third = ok(ask(&store, &clock, me, task, &["git", "push"], "op-3"))
        .request
        .request_id;
    assert_eq!(
        decide(
            &store,
            &clock,
            me,
            third,
            "allowed",
            Decider::System {
                reference: "inquello-desktop".to_string()
            },
            "op-sys"
        ),
        Err(DomainError::HumanActorRequired)
    );
    assert!(matches!(
        decide(
            &store,
            &clock,
            me,
            third,
            "expired",
            Decider::Human,
            "op-human-expiry"
        ),
        Err(DomainError::InvalidCommand(_))
    ));
}

#[test]
fn a_decision_replays_from_its_receipt_and_refuses_a_reused_operation() {
    let (store, clock, me) = (FakeStore::default(), TestClock::new(), actor());
    let task = store.add_task(me);
    let id = ok(ask(&store, &clock, me, task, &["git", "push"], "op-1"))
        .request
        .request_id;
    let first = ok(decide(
        &store,
        &clock,
        me,
        id,
        "denied",
        Decider::Human,
        "op-deny",
    ));
    let again = ok(decide(
        &store,
        &clock,
        me,
        id,
        "denied",
        Decider::Human,
        "op-deny",
    ));
    assert!(again.replayed);
    assert_eq!(again.request.decision, first.request.decision);
    let other = ok(ask(&store, &clock, me, task, &["git", "push"], "op-2"))
        .request
        .request_id;
    assert!(matches!(
        decide(
            &store,
            &clock,
            me,
            other,
            "denied",
            Decider::Human,
            "op-deny"
        ),
        Err(DomainError::OperationConflict { .. })
    ));
}

#[test]
fn another_principal_cannot_read_or_decide_a_request() {
    let (store, clock, me, other) = (FakeStore::default(), TestClock::new(), actor(), actor());
    let task = store.add_task(me);
    let id = ok(ask(&store, &clock, me, task, &["git", "push"], "op-1"))
        .request
        .request_id;
    assert_eq!(
        block_on(permission_request(&store, other, &id.to_string())),
        Err(DomainError::NotFound)
    );
    assert_eq!(
        decide(
            &store,
            &clock,
            other,
            id,
            "allowed",
            Decider::Human,
            "op-other"
        ),
        Err(DomainError::NotFound)
    );
    assert_eq!(
        block_on(pending_requests(
            &store,
            other,
            Some(&task.to_string()),
            clock.now()
        )),
        Err(DomainError::NotFound)
    );
    assert!(ok(block_on(pending_requests(&store, other, None, clock.now()))).is_empty());
    assert_eq!(
        ask(&store, &clock, other, task, &["git", "push"], "op-2"),
        Err(DomainError::NotFound)
    );
    assert_eq!(
        block_on(use_permission(
            &store,
            &clock,
            other,
            &id.to_string(),
            task,
            &words(&["git", "push"])
        )),
        Err(DomainError::PermissionNotGranted)
    );
}

#[test]
fn a_forbidden_command_is_never_requested() {
    let (store, clock, me) = (FakeStore::default(), TestClock::new(), actor());
    let task = store.add_task(me);
    let policy =
        effective(json!({ "command_rules": [{ "prefix": ["rm"], "decision": "forbid" }] }));
    let evaluation = evaluate(&policy, &[], &["rm", "x"], BroadModeStatus::Standard);
    let result = block_on(request_permission(
        &store,
        &clock,
        me,
        RequestPermission {
            operation_id: "op".to_string(),
            request_id: PermissionRequestId::new_random().to_string(),
            task_id: task.to_string(),
            origin: "tools_exec".to_string(),
            evaluation,
            ttl_ms: 60_000,
        },
    ));
    assert!(matches!(result, Err(DomainError::InvalidCommand(_))));
    assert!(store.with(|s| s.requests.is_empty()));
}

#[test]
fn an_automated_reviewer_decision_is_labelled_and_bounded() {
    let (store, clock, me) = (FakeStore::default(), TestClock::new(), actor());
    let task = store.add_task(me);
    let id = ok(ask(&store, &clock, me, task, &["git", "push"], "op-1"))
        .request
        .request_id;
    let decided = ok(decide(
        &store,
        &clock,
        me,
        id,
        "allowed",
        Decider::AutomatedReviewer {
            reference: "auto-review".to_string(),
        },
        "op-auto",
    ));
    let decision = decided
        .request
        .decision
        .unwrap_or_else(|| panic!("no decision"));
    assert_eq!(
        (decision.outcome, decision.actor_kind),
        (PermissionOutcome::Allowed, DeciderKind::AutomatedReviewer)
    );
    assert_eq!(
        DeciderKind::AutomatedReviewer.as_str(),
        "automated_reviewer"
    );
}

// ---- a person's own rules ------------------------------------------------------------

fn input(prefix: &[&str], decision: &str) -> UserRuleInput {
    UserRuleInput {
        prefix: words(prefix),
        decision: decision.to_string(),
        note: None,
    }
}

fn set_rules(
    store: &FakeStore,
    me: Actor,
    revision: u64,
    rules: Vec<UserRuleInput>,
    operation: &str,
) -> Result<UserRulesOutcome, DomainError> {
    block_on(set_user_rules(
        store,
        &TestClock::new(),
        me,
        SetUserRules {
            operation_id: operation.to_string(),
            expected_revision: Revision::new(revision),
            rules,
        },
    ))
}

#[test]
fn a_user_allow_rule_is_refused() {
    let (store, me) = (FakeStore::default(), actor());
    assert_eq!(
        set_rules(&store, me, 0, vec![input(&["curl"], "allow")], "op"),
        Err(DomainError::UserRuleCannotAllow)
    );
    assert!(store.with(|s| s.rule_records.is_empty()));
    assert!(matches!(
        set_rules(&store, me, 0, vec![input(&["rm", "*"], "forbid")], "op"),
        Err(DomainError::InvalidCommand(_))
    ));
    assert!(matches!(
        set_rules(
            &store,
            me,
            0,
            vec![input(&["rm"], "forbid"), input(&["rm"], "prompt")],
            "op"
        ),
        Err(DomainError::InvalidCommand(_))
    ));
}

#[test]
fn deny_and_forbid_this_prefix_records_a_versioned_user_rule_with_a_receipt() {
    let (store, me) = (FakeStore::default(), actor());
    assert_eq!(
        block_on(user_rules(&store, me)),
        Ok(UserRules {
            revision: Revision::ZERO,
            rules: Vec::new()
        })
    );
    let outcome = ok(set_rules(
        &store,
        me,
        0,
        vec![input(&["git", "push"], "forbid")],
        "op-forbid",
    ));
    assert_eq!(outcome.receipt.resulting_revision, Revision::new(1));
    assert_eq!(
        outcome.record.rules,
        vec![rule(&["git", "push"], RuleDecision::Forbid)]
    );
    let replayed = ok(set_rules(
        &store,
        me,
        0,
        vec![input(&["git", "push"], "forbid")],
        "op-forbid",
    ));
    assert!(replayed.replayed);
    assert!(matches!(
        set_rules(&store, me, 0, vec![input(&["make"], "prompt")], "op-stale"),
        Err(DomainError::RevisionConflict { .. })
    ));
    let current = ok(block_on(user_rules(&store, me)));
    let policy =
        effective(json!({ "command_rules": [{ "prefix": ["git"], "decision": "allow" }] }));
    let rules = effective_rules(&policy, &current.rules, current.revision);
    let command = words(&["git", "push"]);
    let evaluation = evaluate_command(
        &command,
        &rules,
        &literal_matches(&command, &rules),
        &policy,
        BroadModeStatus::Standard,
    );
    assert_eq!(evaluation.decision, RuleDecision::Forbid);
    assert_eq!(
        evaluation.source,
        RuleSource::UserRule {
            version: Revision::new(1)
        }
    );
    // Another person's rules are their own.
    assert_eq!(
        ok(block_on(user_rules(&store, actor()))).revision,
        Revision::ZERO
    );
}
