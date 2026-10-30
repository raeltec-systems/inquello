//! Scoped-boundary fixture tests, not live-provider or packaged-runtime evidence.
use super::*;
use serde::de::DeserializeOwned;
use inquello_domain::organise::{CreateTask, OrganiseRecord};
use inquello_domain::routes::{ConfigureRoute, RouteConfigurationInput, SetTaskRoute};
use tempfile::TempDir;

const PRINCIPAL: &str = "11111111-1111-4111-8111-111111111111";
const WORKSPACE: &str = "22222222-2222-4222-8222-222222222222";
const CONNECTION: ConnectionId = ConnectionId(1);
fn ok<T, E: std::fmt::Debug>(value: Result<T, E>) -> T { value.unwrap_or_else(|e| panic!("{e:?}")) }
fn decode<T: DeserializeOwned>(value: Result<Option<ClientResponsePayload>, JSONRPCErrorError>) -> T {
    ok(serde_json::from_value(ok(serde_json::to_value(ok(value).unwrap_or_else(|| panic!("no payload"))))))
}
fn policy(on: bool) -> InquelloWorkspaceExecutionPolicy {
    InquelloWorkspaceExecutionPolicy { workspace_id: WORKSPACE.into(), policy_revision: 1, authorization_epoch: 1,
        execution: Some(serde_json::json!({"automatic_permission_review":on,"command_rules":[{"prefix":["/usr/bin/true"],"decision":"prompt"}]})) }
}
struct Fixture { _dir: TempDir, processor: std::sync::Arc<InquelloRequestProcessor>, task: String, request: String, route: RouteId }
impl Fixture {
    async fn new(route: RouteId, verified: bool) -> Self {
        let dir = ok(TempDir::new());
        let processor = std::sync::Arc::new(InquelloRequestProcessor::with_store_path(Some(dir.path().join("working.sqlite")), Vec::new()));
        let _: InquelloSetPrincipalResponse = decode(processor.set_principal(CONNECTION, InquelloSetPrincipalParams { principal_id: Some(PRINCIPAL.into()) }).await);
        let (store, actor) = ok(processor.context(CONNECTION).await);
        let created = ok(organise::create_task(&store, &SystemClock, actor, CreateTask { operation_id: "create-task".into(), expected_revision: Revision::ZERO,
            workspace_id: WORKSPACE.into(), engagement_id: None, folder_id: None, title: "Review fixture".into() }).await);
        let task = match created.record { OrganiseRecord::Task(task) => task.task_id.to_string(), _ => panic!("not Task") };
        let configuration = RouteConfigurationInput { route_id: route.as_str().into(), deployment: if route == RouteId::ClaudeApiKey { "anthropic-direct" } else { "openai-api" }.into(),
            model: if route == RouteId::ClaudeApiKey { "claude-sonnet-5-5" } else { "fixture-model-20261030" }.into(),
            api_version: if route == RouteId::ClaudeApiKey { "2026-10-21" } else { "responses-v1" }.into(), account_ref: PRINCIPAL.into(), region: None };
        ok(routes::configure_route(&store, &SystemClock, actor, ConfigureRoute { operation_id: "configure".into(), expected_revision: Revision::ZERO, configuration }).await);
        ok(routes::set_task_route(&store, &SystemClock, actor, SetTaskRoute { operation_id: "select".into(), expected_revision: Revision::ZERO,
            task_id: task.clone(), route_id: route.as_str().into(), configuration_revision: Revision::new(1) }).await);
        let evaluation = ok(evaluate_task_command(&store, actor, &ok(workspace_layer(&policy(true))), &DeviceRequirements::default(), &UserConfig::default(), &task, &["/usr/bin/true".into()]).await).evaluation;
        let request = uuid::Uuid::new_v4().to_string();
        ok(execution_policy::request_permission(&store, &SystemClock, actor, execution_policy::RequestPermission {
            operation_id: "request".into(), request_id: request.clone(), task_id: task.clone(), origin: "tools_exec".into(), evaluation, ttl_ms: 60_000 }).await);
        { let mut state = processor.routes.state.lock().await;
            state.credentials.insert((actor.principal_id, route), (PRINCIPAL.into(), 1));
            state.generations.insert((actor.principal_id, route), 1);
            if verified { state.fixture_response = Some("{\"verdict\":\"allow\"}".into()); }
        }
        Self { _dir: dir, processor, task, request, route }
    }
    fn params(&self) -> InquelloPermissionsReviewParams {
        InquelloPermissionsReviewParams { request_id: self.request.clone(), workspace_policy: policy(true), authority_epoch: 1, data_tier: "synthetic".into() }
    }
    async fn review(&self) -> InquelloPermissionsReviewResponse {
        decode(self.processor.permissions_review(CONNECTION, self.params(), DeviceRequirements::default(), UserConfig::default()).await)
    }
    async fn apply(&self) -> InquelloPermissionsReviewResponse {
        decode(self.processor.permissions_review_apply(CONNECTION, self.params(), DeviceRequirements::default(), UserConfig::default()).await)
    }
}

#[tokio::test]
async fn both_route_fixtures_require_runtime_provenance_and_apply_once_without_state_bleed() {
    for route in RouteId::ALL {
        let f = Fixture::new(route, true).await;
        assert_eq!(f.apply().await.status, "human_required"); // main cannot invent a verdict
        let ready = f.review().await;
        assert_eq!(ready.status, "ready"); assert!(ready.request.decision.is_none());
        assert_eq!(f.review().await.status, "human_required"); // no duplicate invocation
        let decided = f.apply().await;
        assert_eq!(decided.status, "decided");
        let decision = decided.request.decision.unwrap_or_else(|| panic!("no decision"));
        assert_eq!(decision.actor_kind, "automated_reviewer");
        assert_eq!(decided.label, LABEL);
        let (store, actor) = ok(f.processor.context(CONNECTION).await);
        assert!(ok(inquello_domain::state::task_states(&store, actor, &f.task).await).records.is_empty());
        // An already consumed ready value never returns another receipt.
        assert_eq!(f.apply().await.status, "human_required");
    }
}

#[tokio::test]
async fn credential_presence_unverified_route_and_disabled_switch_never_dispatch() {
    for route in RouteId::ALL {
        let f = Fixture::new(route, false).await;
        assert_eq!(f.review().await.status, "human_required");
        assert!(f.processor.routes.state.lock().await.pending.is_empty());
        let mut params = f.params(); params.workspace_policy = policy(false);
        let result: InquelloPermissionsReviewResponse = decode(f.processor.permissions_review(CONNECTION, params, DeviceRequirements::default(), UserConfig::default()).await);
        assert_eq!(result.status, "human_required");
    }
}

#[tokio::test]
async fn malformed_verdict_is_not_an_authorization_and_real_data_never_enabled() {
    for route in RouteId::ALL {
        for text in ["allow", "{\"verdict\":\"allow\",\"extra\":true}", "{\"verdict\":\"allow\"", "{\"verdict\":\"approve\"}"] {
            let f = Fixture::new(route, true).await;
            f.processor.routes.state.lock().await.fixture_response = Some(text.into());
            assert_eq!(f.review().await.status, "human_required");
        }
        let f = Fixture::new(route, true).await;
        let mut params = f.params(); params.data_tier = "real".into();
        let result: InquelloPermissionsReviewResponse = decode(f.processor.permissions_review(CONNECTION, params, DeviceRequirements::default(), UserConfig::default()).await);
        assert_eq!(result.status, "human_required");
    }
}

#[tokio::test]
async fn public_automated_actor_cannot_spoof_a_trusted_invocation() {
    let f = Fixture::new(RouteId::ClaudeApiKey, true).await;
    let result = f.processor.permissions_decide(CONNECTION, InquelloPermissionsDecideParams {
        operation_id: "forged".into(), expected_revision: 1, request_id: f.request,
        outcome: "allowed".into(), actor_kind: "automated_reviewer".into(), actor_ref: Some(uuid::Uuid::new_v4().to_string()),
    }).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn route_key_policy_and_logout_invalidate_staged_verdicts() {
    for route in RouteId::ALL {
        for change in ["key", "route", "policy", "logout", "expiry"] {
            let f = Fixture::new(route, true).await;
            assert_eq!(f.review().await.status, "ready");
            match change {
                "key" => { let _: InquelloRoutePrivateAuthResponse = decode(f.processor.routes_invalidate(CONNECTION,
                    InquelloRoutesInvalidateParams { route_id: Some(f.route.as_str().into()), generation: 2, task_id: None }).await); }
                "route" => { let _: InquelloTaskRouteResponse = decode(f.processor.task_route_set(CONNECTION,
                    InquelloTaskRouteSetParams { operation_id: "reselect".into(), expected_revision: 1, task_id: f.task.clone(), route_id: f.route.as_str().into(), configuration_revision: 1 }).await); }
                "policy" => { let mut params = f.params(); params.workspace_policy.policy_revision = 2;
                    params.workspace_policy.execution = Some(serde_json::json!({"automatic_permission_review":true,"command_rules":[{"prefix":["/usr/bin/true"],"decision":"forbid"}]}));
                    let result: InquelloPermissionsReviewResponse = decode(f.processor.permissions_review_apply(CONNECTION, params, DeviceRequirements::default(), UserConfig::default()).await);
                    assert_ne!(result.status, "decided"); continue; }
                "logout" => { let _: InquelloSetPrincipalResponse = decode(f.processor.set_principal(CONNECTION, InquelloSetPrincipalParams { principal_id: None }).await);
                    assert!(f.processor.permissions_review_apply(CONNECTION, f.params(), DeviceRequirements::default(), UserConfig::default()).await.is_err()); continue; }
                "expiry" => { let mut state = f.processor.routes.state.lock().await;
                    state.ready.get_mut(&f.request).unwrap_or_else(|| panic!("ready missing")).expires_at = 0; }
                _ => unreachable!(),
            }
            assert_eq!(f.apply().await.status, "human_required");
        }
    }
}

#[tokio::test]
async fn cross_principal_unknown_and_private_secret_never_in_view_or_debug() {
    let f = Fixture::new(RouteId::ClaudeApiKey, false).await;
    let sentinel = "sk-ant-fixture-only-NOT-A-REAL-KEY-122";
    let handoff = InquelloRoutePrivateAuthParams { route_id: "claude-api-key".into(), account_ref: PRINCIPAL.into(), generation: 2, api_key: Some(sentinel.into()) };
    assert!(!format!("{handoff:?}").contains(sentinel));
    let result = ok(f.processor.route_private_auth(CONNECTION, handoff).await);
    assert!(!ok(serde_json::to_string(&result)).contains(sentinel));
    let list = ok(f.processor.routes_list(CONNECTION, InquelloRoutesListParams {}).await);
    assert!(!ok(serde_json::to_string(&list)).contains(sentinel));
    let _: InquelloSetPrincipalResponse = decode(f.processor.set_principal(ConnectionId(2), InquelloSetPrincipalParams { principal_id: Some("33333333-3333-4333-8333-333333333333".into()) }).await);
    assert!(f.processor.task_route_read(ConnectionId(2), InquelloTaskRouteReadParams { task_id: f.task }).await.is_err());
}

#[test]
fn permission_verdict_schema_and_no_widening() {
    assert_eq!(parse_verdict("{\"verdict\":\"allow\"}"), Some(execution_policy::ReviewerVerdict::Allow));
    assert_eq!(parse_verdict("{\"verdict\":\"deny\"}"), Some(execution_policy::ReviewerVerdict::Deny));
    assert!(parse_verdict("{\"verdict\":\"allow\",\"verdict\":\"deny\"}").is_none());
}

#[tokio::test]
async fn inflight_cancellation_discards_late_fixture_verdict_for_both_routes() {
    for route in RouteId::ALL {
        let f = Fixture::new(route, true).await;
        let started = std::sync::Arc::new(tokio::sync::Notify::new());
        let release = std::sync::Arc::new(tokio::sync::Notify::new());
        f.processor.routes.state.lock().await.fixture_pause = Some((started.clone(), release.clone()));
        let processor = f.processor.clone(); let params = f.params();
        let review = tokio::spawn(async move { processor.permissions_review(CONNECTION, params, DeviceRequirements::default(), UserConfig::default()).await });
        started.notified().await;
        let _: InquelloRoutePrivateAuthResponse = decode(f.processor.routes_invalidate(CONNECTION,
            InquelloRoutesInvalidateParams { route_id: None, generation: 2, task_id: Some(f.task.clone()) }).await);
        release.notify_one();
        let result: InquelloPermissionsReviewResponse = decode(ok(review.await));
        assert_eq!(result.status, "human_required");
        assert!(result.request.decision.is_none());
        assert!(f.processor.routes.state.lock().await.ready.is_empty());
    }
}

#[tokio::test]
async fn atomic_store_checks_changed_local_rule_revision_before_verdict_commit() {
    let f = Fixture::new(RouteId::ClaudeApiKey, true).await;
    assert_eq!(f.review().await.status, "ready");
    let (store, actor) = ok(f.processor.context(CONNECTION).await);
    ok(execution_policy::set_user_rules(&store, &SystemClock, actor, execution_policy::SetUserRules {
        operation_id: "outside-runtime-write".into(), expected_revision: Revision::ZERO,
        rules: vec![execution_policy::UserRuleInput { prefix: vec!["unrelated".into()], decision: "prompt".into(), note: None }],
    }).await);
    assert_eq!(f.apply().await.status, "human_required");
    assert!(ok(execution_policy::permission_request(&store, actor, &f.request).await).decision.is_none());
}

#[tokio::test]
async fn fresh_unknown_real_or_policy_off_discards_staged_review_without_authorizing() {
    for route in RouteId::ALL {
        for tier in ["unknown", "real", "synthetic"] {
            let f = Fixture::new(route, true).await;
            assert_eq!(f.review().await.status, "ready");
            let mut params = f.params(); params.data_tier = tier.into();
            if tier == "synthetic" { params.workspace_policy = policy(false); }
            let result: InquelloPermissionsReviewResponse = decode(f.processor.permissions_review_apply(CONNECTION, params,
                DeviceRequirements::default(), UserConfig::default()).await);
            assert_eq!(result.status, "human_required"); assert!(result.request.decision.is_none());
            assert_eq!(f.apply().await.status, "human_required");
        }
    }
}

#[tokio::test]
async fn classification_loss_with_fresh_forbid_refuses_instead_of_asking() {
    let f = Fixture::new(RouteId::ClaudeApiKey, true).await;
    assert_eq!(f.review().await.status, "ready");
    let mut params = f.params(); params.data_tier = "unknown".into();
    params.workspace_policy.policy_revision += 1;
    params.workspace_policy.execution = Some(serde_json::json!({"automatic_permission_review":true,
        "command_rules":[{"prefix":["/usr/bin/true"],"decision":"forbid"}]}));
    let result: InquelloPermissionsReviewResponse = decode(f.processor.permissions_review_apply(CONNECTION, params,
        DeviceRequirements::default(), UserConfig::default()).await);
    assert_eq!(result.status, "refused"); assert!(result.request.decision.is_none());
}

#[tokio::test]
async fn selecting_another_task_does_not_cancel_staged_review_or_rebind_credentials() {
    let f = Fixture::new(RouteId::ClaudeApiKey, true).await;
    assert_eq!(f.review().await.status, "ready");
    let (store, actor) = ok(f.processor.context(CONNECTION).await);
    let created = ok(organise::create_task(&store, &SystemClock, actor, CreateTask { operation_id: "second-task".into(), expected_revision: Revision::ZERO,
        workspace_id: WORKSPACE.into(), engagement_id: None, folder_id: None, title: "Other Task".into() }).await);
    let second = match created.record { OrganiseRecord::Task(task) => task.task_id.to_string(), _ => panic!("not Task") };
    let _: InquelloTaskRouteResponse = decode(f.processor.task_route_set(CONNECTION, InquelloTaskRouteSetParams {
        operation_id: "select-second".into(), expected_revision: 0, task_id: second, route_id: f.route.as_str().into(), configuration_revision: 1,
    }).await);
    let state = f.processor.routes.state.lock().await;
    assert_eq!(state.credentials.get(&(actor.principal_id, f.route)), Some(&(PRINCIPAL.into(), 1)));
    assert!(state.ready.contains_key(&f.request)); drop(state);
    assert_eq!(f.apply().await.status, "decided");
}

#[tokio::test]
async fn bounded_reviewer_delivery_cancels_without_emitting_late_event() {
    let request: InferenceRequest = ok(serde_json::from_str(include_str!("../../../inquello-protocol/fixtures/inference/messages-request.json")));
    let (tx, mut rx) = tokio::sync::mpsc::channel(1); let cancellation = CancellationToken::new();
    let event = Event { binding: request.binding, sequence: 0, provider_request_id: None, provider_message_id: None, event: EventKind::Started };
    ok(tx.send(event.clone()).await); let token = cancellation.clone();
    let blocked = tokio::spawn(async move { review_send(&tx, &token, event).await });
    cancellation.cancel();
    assert!(!ok(tokio::time::timeout(std::time::Duration::from_secs(1), blocked).await).unwrap_or_else(|e| panic!("{e:?}")));
    assert!(rx.recv().await.is_some()); assert!(rx.recv().await.is_none());
}

#[tokio::test]
async fn both_routes_persist_valid_deny_as_automated_permission_decision() {
    for route in RouteId::ALL {
        let f = Fixture::new(route, true).await;
        f.processor.routes.state.lock().await.fixture_response = Some("{\"verdict\":\"deny\"}".into());
        assert_eq!(f.review().await.status, "ready");
        let response = f.apply().await;
        assert_eq!(response.status, "decided");
        let decision = response.request.decision.unwrap_or_else(|| panic!("missing denial"));
        assert_eq!(decision.outcome, "denied");
        assert_eq!(decision.actor_kind, "automated_reviewer");
        let (store, actor) = ok(f.processor.context(CONNECTION).await);
        let persisted = ok(execution_policy::permission_request(&store, actor, &f.request).await);
        let persisted = persisted.decision.unwrap_or_else(|| panic!("denial not persisted"));
        assert_eq!(persisted.outcome, execution_policy::PermissionOutcome::Denied);
        assert_eq!(persisted.actor_kind, execution_policy::DeciderKind::AutomatedReviewer);
        assert_eq!(persisted.actor_ref, decision.actor_ref);
    }
}

#[tokio::test]
async fn responses_review_outgoing_body_is_exact_bounded_and_has_no_tools() {
    let f = Fixture::new(RouteId::CodexResponses, true).await;
    let (store, actor) = ok(f.processor.context(CONNECTION).await);
    let pending = ok(execution_policy::permission_request(&store, actor, &f.request).await);
    let seed: InferenceRequest = ok(serde_json::from_str(include_str!("../../../inquello-protocol/fixtures/inference/messages-request.json")));
    let request = review_request(seed.binding, &pending.evaluation);
    let body = ok(responses_review_body(&request));
    assert_eq!(body, serde_json::json!({
        "model":request.binding.model,"stream":true,"max_output_tokens":512,
        "tools":[],"tool_choice":"none","parallel_tool_calls":false,"store":false,
        "input":request.messages.iter().map(|message| serde_json::json!({"type":"message",
            "role":if message.role == Role::System { "developer" } else { "user" },
            "content":message.blocks.iter().map(|block| match block {
                ContentBlock::Text { text } => serde_json::json!({"type":"input_text","text":text}),
                _ => panic!("unexpected reviewer block"),
            }).collect::<Vec<_>>()
        })).collect::<Vec<_>>()
    }));
}

/// Any accidental refresh call fails immediately instead of relying on a fast
/// fake network to conceal an await under the lifecycle mutex.
#[derive(Debug)]
struct NoRefreshProvider(codex_model_provider::SharedModelProvider);
impl codex_model_provider::ModelProvider for NoRefreshProvider {
    fn info(&self) -> &codex_model_provider_info::ModelProviderInfo { self.0.info() }
    fn auth_manager(&self) -> Option<std::sync::Arc<codex_login::AuthManager>> { self.0.auth_manager() }
    fn auth(&self) -> codex_model_provider::ModelProviderFuture<'_, Option<codex_login::CodexAuth>> {
        panic!("configuration freshness must not invoke async credential refresh")
    }
    fn api_provider(&self) -> codex_model_provider::ModelProviderFuture<'_, codex_protocol::error::Result<codex_api::Provider>> {
        panic!("configuration freshness must resolve cached endpoint synchronously")
    }
    fn account_state(&self) -> codex_model_provider::ProviderAccountResult { self.0.account_state() }
    fn models_manager(&self, home: std::path::PathBuf, catalog: Option<codex_protocol::openai_models::ModelsResponse>)
        -> codex_models_manager::manager::SharedModelsManager { self.0.models_manager(home, catalog) }
}
#[tokio::test]
async fn configuration_check_under_lifecycle_lock_never_refreshes_auth_or_blocks_revocation() {
    let f = Fixture::new(RouteId::CodexResponses, true).await;
    let provider = codex_model_provider::create_model_provider(
        codex_model_provider_info::ModelProviderInfo::create_openai_provider(None),
        Some(codex_login::AuthManager::from_auth_for_testing(codex_login::CodexAuth::from_api_key("synthetic-fixture-only"))),
    );
    let inherited = InheritedResponses { provider: std::sync::Arc::new(NoRefreshProvider(provider)),
        factory: codex_http_client::HttpClientFactory::new(codex_http_client::OutboundProxyPolicy::ReqwestDefault) };
    let (store, actor) = ok(f.processor.context(CONNECTION).await);
    let task = ok(routes::task_route(&store, actor, &f.task).await);
    let selected = task.current.unwrap_or_else(|| panic!("missing selection"));
    let mut state = f.processor.routes.state.lock().await;
    // This is intentionally synchronous and must never call either panic hook.
    ok(inherited.check_configuration(&selected.configuration));
    f.processor.routes.invalidate_principal(&mut state, actor.principal_id);
    assert!(state.credentials.is_empty());
}
