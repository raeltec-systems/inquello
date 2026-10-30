//! Task-scoped settings and trusted native accounting. No event-ingest RPC.
use super::*;
use codex_app_server_protocol::*;
use inquello_domain::usage::{self, UsageStore, Choices, AttemptSnapshot, OperationKind, AttemptStatus, FinishAttempt};
use inquello_domain::routes;

#[derive(Clone)]
pub(super) struct Capabilities { pub reasoning: Vec<String>, pub speeds: Vec<String>, pub defaults: Choices }
impl InquelloRequestProcessor {
    pub(super) fn usage_fixture_for_task(&self, state:&reviewer::ReviewState, task:&str)->bool {
        #[cfg(all(feature = "inference-fixtures", debug_assertions))]
        {return state.usage_fixture.as_ref().is_some_and(|f|f.task==task);}
        #[cfg(not(all(feature = "inference-fixtures", debug_assertions)))]
        {let _=(state,task);false}
    }
    pub(crate) fn with_usage_sources(mut self, account: std::sync::Arc<super::super::AccountRequestProcessor>, catalog: super::super::CatalogRequestProcessor) -> Self {
        self.usage_sources = Some((account, catalog)); self
    }
    pub(super) async fn usage_capabilities(&self, route: &routes::TaskRoute) -> Result<Capabilities, JSONRPCErrorError> {
        #[cfg(test)]
        {
            let (failure,pause)={let state=self.routes.state.lock().await;(state.fixture_capability_failure,state.fixture_caps_pause.clone())};
            if let Some((started,release))=pause {started.notify_one();release.notified().await;}
            if failure {return Err(refusal("capabilities_unavailable","Synthetic capability read unavailable"));}
        }
        let selected = route.current.as_ref().filter(|_| !route.stale_configuration)
            .ok_or_else(|| refusal("settings_unavailable", "Select a current route and explicitly save its settings"))?;
        if selected.configuration.route_id() == routes::RouteId::ClaudeApiKey {
            return Ok(Capabilities { reasoning: vec!["default".into()], speeds: vec!["default".into()], defaults: Choices::default() });
        }
        #[cfg(test)]
        if self.fixture_enabled(&self.routes.state.lock().await) {
            return Ok(Capabilities {reasoning:vec!["default".into(),"low".into(),"high".into()],speeds:vec!["default".into(),"priority".into()],defaults:Choices {reasoning:"low".into(),speed:"default".into()}});
        }
        #[cfg(all(feature = "inference-fixtures", debug_assertions))]
        if self.usage_fixture_for_task(&self.routes.state.lock().await,&route.task_id.to_string()) {
            return Ok(Capabilities {reasoning:vec!["default".into()],speeds:vec!["default".into()],defaults:Choices::default()});
        }
        let (_, catalog) = self.usage_sources.as_ref().ok_or_else(|| refusal("capabilities_unavailable", "Authoritative model capabilities unavailable"))?;
        let model = catalog.inquello_usage_model(selected.configuration.model()).await?;
        let mut reasoning = vec!["default".into()];
        for option in model.supported_reasoning_efforts {
            if let Some(value) = serde_json::to_value(option.reasoning_effort).ok().and_then(|v| v.as_str().map(str::to_owned)) { reasoning.push(value); }
        }
        let mut speeds = vec!["default".into()]; speeds.extend(model.service_tiers.into_iter().map(|tier| tier.id));
        let default_reasoning = serde_json::to_value(model.default_reasoning_effort).ok().and_then(|v| v.as_str().map(str::to_owned))
            .ok_or_else(|| refusal("capabilities_unavailable", "Model default reasoning unavailable"))?;
        Ok(Capabilities {reasoning, speeds, defaults: Choices {reasoning:default_reasoning,speed:model.default_service_tier.unwrap_or_else(|| "default".into())}})
    }
    async fn usage_account_limits(&self) -> Result<GetAccountRateLimitsResponse, JSONRPCErrorError> {
        let (account, _) = self.usage_sources.as_ref().ok_or_else(|| refusal("limit_unknown", "Current-account Codex quota check unavailable; use permitted human handling"))?;
        tokio::time::timeout(std::time::Duration::from_secs(10), account.get_account_rate_limits_response(GetAccountRateLimitsParams {supports_luna_reserve:false, exclude_reset_credit_details:true})).await
            .map_err(|_| refusal("limit_unknown","Current-account Codex quota check timed out; use permitted human handling"))?
            .map_err(|_| refusal("limit_unknown","Current-account Codex quota check unavailable; use permitted human handling"))
    }
    /// Return the validated account binding, not a boolean detached from identity.
    /// Null, sparse updates, reset times and failed reads never grant dispatch.
    pub(super) async fn usage_limit_check(&self, route: &str, task: &str) -> Result<Option<reviewer::InheritedAuthBinding>, JSONRPCErrorError> {
        #[cfg(all(feature = "inference-fixtures", debug_assertions))]
        if self.usage_fixture_for_task(&self.routes.state.lock().await,task) { return checked_account(fixture_quota()).map(|_|None); }
        let _=task;
        if route != "codex-responses" { return Ok(None); }
        let inherited=self.routes.responses.as_ref().ok_or_else(||refusal("limit_unknown","Inherited authentication unavailable"))?;
        let binding=inherited.auth_binding().map_err(|_|refusal("limit_unknown","Current inherited authentication binding unavailable"))?;
        if binding.mode.uses_codex_backend() {
            let account=checked_account(self.usage_account_limits().await?)?;
            if account!=binding.account_id {return Err(refusal("limit_unknown","Quota observation belongs to another account; model dispatch refused"));}
        } else if binding.mode!=codex_protocol::auth::AuthMode::ApiKey {
            return Err(refusal("limit_unknown","Unsupported inherited authentication mode"));
        }
        // API-key provider quotas have no supported endpoint; that is not an
        // exhausted ChatGPT plan. Never query ChatGPT or invent an API-key grant.
        if !inherited.binding_current(&binding) {return Err(refusal("limit_unknown","Inherited authentication changed during quota check"));}
        Ok(Some(binding))
    }
    async fn usage_limits_view(&self, source:&str, task:&str) -> serde_json::Value {
        #[cfg(all(feature = "inference-fixtures", debug_assertions))]
        if self.usage_fixture_for_task(&self.routes.state.lock().await,task) {return json!({"source":"Codex plan/Workspace — synthetic fixture","status":"exhausted","reason":limit_reason(&fixture_quota()),"nextAction":"Use permitted human handling; recheck current-account usage. No provider dispatch or reset-credit spending."});}
        let _=task;
        if source!="codex-responses" {return json!({"source":source,"status":"unsupported","reason":"No supported provider quota endpoint. Unknown is not unlimited; provider refusal stops the attempt","nextAction":"Inspect provider account usage or use permitted human handling. No automatic fallback, upgrade or credit spend."});}
        let inherited=match self.routes.responses.as_ref() {Some(inherited)=>inherited,None=>return json!({"source":"Inherited OpenAI route","status":"unknown","reason":"Current authentication unavailable; model dispatch is refused","nextAction":"Refresh inherited provider authentication."})};
        let binding=match inherited.auth_binding() {Ok(binding)=>binding,Err(_)=>return json!({"source":"Inherited OpenAI route","status":"unknown","reason":"Current authentication binding unavailable; model dispatch is refused","nextAction":"Refresh inherited provider authentication."})};
        if binding.mode==codex_protocol::auth::AuthMode::ApiKey {
            return json!({"source":"Inherited OpenAI API key","status":"unsupported","reason":"No supported API-key quota endpoint. Unknown is not unlimited; provider refusal stops the attempt. ChatGPT plan quota does not apply to this authentication mode","nextAction":"Inspect provider API account usage or use permitted human handling. No fallback or automatic credit spend."});
        }
        match self.usage_account_limits().await {
            Ok(response) if inherited.binding_current(&binding) && response.account_id==binding.account_id =>json!({"source":"Codex plan/Workspace","status":match response.ordinary_usage_allowed {Some(true) if response.account_id.is_some()=>"available",Some(false)=>"exhausted",_=>"unknown"},"reason":limit_reason(&response),"nextAction":"Refresh current-account usage or use permitted human handling. Reset timestamps never prove recovery. No reserve fallback, automatic upgrade or credit spend."}),
            _=>json!({"source":"Codex plan/Workspace","status":"unknown","reason":"Required current-account quota check unavailable; affected model dispatch is refused","nextAction":"Refresh account usage or use permitted human handling. Local tools are not blocked by model quotas."}),
        }
    }
    pub(crate) async fn usage_read(&self, connection: ConnectionId, params: InquelloUsageReadParams) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection).await?;
        let route = routes::task_route(&store, actor, &params.task_id).await.map_err(domain_error)?;
        let caps = self.usage_capabilities(&route).await;
        let current = routes::task_route(&store, self.actor(connection)?, &params.task_id).await.map_err(domain_error)?;
        if self.actor(connection)? != actor || route.revision != current.revision || route.stale_configuration != current.stale_configuration { return Err(refusal("stale", "Private Task or route changed; refresh")); }
        let mut history = usage::task_usage(&store, actor, &params.task_id).await.map_err(domain_error)?;
        // Raw delivery receipts are durable internally, not a multi-megabyte UI payload.
        for attempt in &mut history.attempts {
            attempt.events.clear();
            // Running is a durable unfinished marker, not evidence that a process
            // survived. Another incarnation may be concurrent or crashed. Do not
            // terminally rewrite it; its real owner can still deliver late events.
            if attempt.status == AttemptStatus::Running && attempt.snapshot.runtime_id != self.runtime_id {
                attempt.status = AttemptStatus::Uncertain;
            }
        }
        let capabilities = match caps {
            Ok(c) => json!({"reasoning":c.reasoning,"speeds":c.speeds,"routeRevision":route.revision.get(),"available":true,"reason":if route.current.as_ref().is_some_and(|r|r.configuration.route_id()==routes::RouteId::ClaudeApiKey) {"Initial Messages adapter supports default reasoning and speed only; non-default alternatives are unavailable. These choices are not evidence quality or Professional Approval"} else {"Alternatives come from this selected model's authoritative catalog and affect future work, not evidence quality or Professional Approval"}}),
            Err(_) => json!({"reasoning":[],"speeds":[],"routeRevision":route.revision.get(),"available":false,"reason":"Current authoritative route/model capabilities unavailable; refresh and explicitly correct settings"}),
        };
        let source = route.current.as_ref().map(|s| s.configuration.route_id().as_str()).unwrap_or("none");
        let limits=self.usage_limits_view(source,&params.task_id).await;
        let latest=routes::task_route(&store,self.actor(connection)?,&params.task_id).await.map_err(domain_error)?;
        if self.actor(connection)?!=actor || latest.revision!=route.revision || latest.stale_configuration!=route.stale_configuration {return Err(refusal("stale","Private Task or route changed during usage inspection"));}
        Ok(Some(InquelloUsageResponse {task_id:params.task_id,usage:serde_json::to_value(history).map_err(|_| failure("usage_unavailable","Usage unavailable"))?,capabilities,limits}.into()))
    }
    pub(crate) async fn usage_set(&self, connection: ConnectionId, params: InquelloUsageSetParams) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection).await?;
        let route = routes::task_route(&store, actor, &params.task_id).await.map_err(domain_error)?;
        let caps = self.usage_capabilities(&route).await?;
        let lifecycle = self.routes.state.lock().await;
        if self.actor(connection)? != actor { return Err(refusal("stale","Private session changed")); }
        let current=routes::task_route(&store,actor,&params.task_id).await.map_err(domain_error)?;
        if params.route_revision!=route.revision.get() || current.revision!=route.revision
            || current.current!=route.current || current.stale_configuration || route.stale_configuration {
            return Err(refusal("revision_conflict","Route changed during capability lookup; refresh and explicitly correct settings"));
        }
        usage::set_task_usage_settings(&store, actor, usage::SetUsageSettings {operation_id:params.operation_id,task_id:params.task_id.clone(),expected_revision:params.expected_revision,route_revision:params.route_revision,choices:Choices {reasoning:params.reasoning,speed:params.speed}}, &caps.reasoning,&caps.speeds).await.map_err(domain_error)?;
        // Settings govern the next attempt. Already dispatched work keeps its
        // immutable choices; changing settings does not rewrite or cancel it.
        drop(lifecycle);
        self.usage_read(connection,InquelloUsageReadParams {task_id:params.task_id}).await
    }
    pub(crate) fn usage_actor(&self, connection: ConnectionId) -> Result<Actor, JSONRPCErrorError> { self.actor(connection) }
    pub(crate) async fn tool_usage_begin(self: &std::sync::Arc<Self>, connection: ConnectionId, expected: Actor, task: &str) -> Result<ToolUsage, JSONRPCErrorError> {
        let (store,actor)=self.context(connection).await?;
        if actor != expected { return Err(refusal("stale","Session changed before tool dispatch")); }
        let id=uuid::Uuid::new_v4().to_string();
        let route=routes::task_route(&store,actor,task).await.map_err(domain_error)?;
        let settings=usage::task_usage(&store,actor,task).await.map_err(domain_error)?.settings;
        let choices=settings.as_ref().map(|s|s.choices.clone()).unwrap_or_default();
        store.begin_usage_attempt(AttemptSnapshot {attempt_id:id.clone(),task_id:task.into(),principal_id:actor.principal_id.to_string(),run_id:uuid::Uuid::new_v4().to_string(),runtime_id:self.runtime_id.clone(),operation_kind:OperationKind::LocalTool,
            route_id:route.current.as_ref().map(|r|r.configuration.route_id().as_str().into()),model:route.current.as_ref().map(|r|r.configuration.model().into()),api_version:route.current.as_ref().map(|r|r.configuration.api_version().into()),configuration_revision:route.current.as_ref().map_or(0,|r|r.configuration_revision.get()),route_revision:route.revision.get(),settings_revision:settings.map_or(0,|s|s.revision),requested:choices.clone(),effective:choices,started_at_ms:SystemClock.now().unix_millis()}).await.map_err(domain_error)?;
        Ok(ToolUsage {store,actor,task:TaskId::parse(task).map_err(domain_error)?,id,began:std::time::Instant::now(),processor:self.clone(),connection,finished:false})
    }
}
/// Native execution observer. Completion persistence precedes the original RPC
/// response, so the desktop's settled-work notification cannot race the ledger.
pub(crate) struct ToolUsage {
    store: SqliteWorkingStore, actor:Actor, task:TaskId, id:String, began:std::time::Instant,
    processor:std::sync::Arc<InquelloRequestProcessor>, connection:ConnectionId, finished:bool,
}
impl ToolUsage {
    pub(crate) async fn recheck(&self) -> Result<(),JSONRPCErrorError> {
        if self.processor.actor(self.connection)? != self.actor { return Err(refusal("stale","Private identity changed before tool dispatch")); }
        self.store.read_usage(self.actor.principal_id,self.task).await.map_err(domain_error)?;
        if self.processor.actor(self.connection)? != self.actor { return Err(refusal("stale","Private identity changed before tool dispatch")); }
        Ok(())
    }
    pub(crate) async fn finish(mut self,status:AttemptStatus) {
        self.finished=self.store.finish_usage_attempt(self.actor.principal_id,self.task,&self.id,FinishAttempt {status,ended_at_ms:SystemClock.now().unix_millis(),elapsed_ms:self.began.elapsed().as_millis().try_into().unwrap_or(u64::MAX),output_ref:None}).await.is_ok();
        if !self.finished { tracing::warn!("native usage completion unavailable; unfinished record remains uncertain"); }
    }
}
impl Drop for ToolUsage {
    fn drop(&mut self) {
        if self.finished {return;}
        let store=self.store.clone(); let actor=self.actor; let task=self.task; let id=self.id.clone();
        let elapsed_ms=self.began.elapsed().as_millis().try_into().unwrap_or(u64::MAX);
        if let Ok(runtime)=tokio::runtime::Handle::try_current() {
            runtime.spawn(async move { let _=store.finish_usage_attempt(actor.principal_id,task,&id,FinishAttempt {status:AttemptStatus::Uncertain,ended_at_ms:SystemClock.now().unix_millis(),elapsed_ms,output_ref:None}).await; });
        }
        // On process loss the unfinished durable snapshot projects as uncertain
        // in another boot; no recovery path replays the tool.
    }
}

fn limit_reason(response:&GetAccountRateLimitsResponse)->String {
    let state=match response.ordinary_usage_allowed {Some(true) if response.account_id.is_some()=>"Current account permits ordinary usage; this is not a future reservation or billing reconciliation",Some(false)=>"Codex plan/Workspace blocks ordinary usage",_=>"Current-account ordinary usage permission is unknown; model dispatch is refused"};
    let primary=response.rate_limits.primary.as_ref().and_then(|w|w.resets_at);
    let secondary=response.rate_limits.secondary.as_ref().and_then(|w|w.resets_at);
    let individual=response.rate_limits.individual_limit.as_ref().map(|w|w.resets_at);
    let source=response.rate_limits.rate_limit_reached_type.as_ref().and_then(|v|serde_json::to_value(v).ok()).and_then(|v|v.as_str().map(str::to_owned)).unwrap_or_else(||"source detail unknown".into());
    format!("{state} ({source}). Provider-reported reset timestamps (Unix seconds): primary {}, secondary {}, individual {}. Recheck authoritative permission; elapsed resets do not prove recovery.",primary.map_or_else(||"unknown".into(),|v|v.to_string()),secondary.map_or_else(||"unknown".into(),|v|v.to_string()),individual.map_or_else(||"unknown".into(),|v|v.to_string()))
}

fn checked_account(response:GetAccountRateLimitsResponse)->Result<Option<String>,JSONRPCErrorError> {
    if response.ordinary_usage_allowed==Some(true) && response.account_id.is_some() {return Ok(response.account_id);}
    Err(refusal(if response.ordinary_usage_allowed==Some(false) {"inherited_limit"} else {"limit_unknown"}, &limit_reason(&response)))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn account_bound_explicit_permission_only_no_reset_recovery() {
        for allowed in [serde_json::Value::Null,json!(false),json!(true)] {
            for account in [serde_json::Value::Null,json!("fixture-account")] {
                let response:GetAccountRateLimitsResponse=serde_json::from_value(json!({"ordinaryUsageAllowed":allowed,"accountId":account,"rateLimits":{"primary":{"usedPercent":0,"windowDurationMins":60,"resetsAt":1}}})).unwrap();
                let grant=allowed==json!(true)&&account!=serde_json::Value::Null;
                assert_eq!(checked_account(response).is_ok(),grant);
            }
        }
    }
}

#[cfg(all(feature = "inference-fixtures", debug_assertions))]
pub(super) struct UsageLimitFixture {pub(super) task:String,pub(super) principal:PrincipalId,pub(super) route_revision:u64,pub(super) provider_calls:usize}
#[cfg(all(feature = "inference-fixtures", debug_assertions))]
fn fixture_quota()->GetAccountRateLimitsResponse {
    // Fixed source-owned observation. Not credentials, renderer usage or a quota endpoint.
    serde_json::from_value(json!({"ordinaryUsageAllowed":false,"accountId":"synthetic-fixture-account","rateLimits":{"primary":{"usedPercent":100,"windowDurationMins":60,"resetsAt":1}}})).expect("fixed synthetic quota contract")
}
#[cfg(all(feature = "inference-fixtures", debug_assertions))]
impl InquelloRequestProcessor {
    pub(crate) async fn fixture_usage_limit(&self, connection:ConnectionId, task:&str, phase:&str, mut policy:InquelloWorkspaceExecutionPolicy, device:DeviceRequirements, user:UserConfig)->Result<serde_json::Value,JSONRPCErrorError> {
        let (store,actor)=self.context(connection).await?;
        let route=routes::task_route(&store,actor,task).await.map_err(domain_error)?;
        let invalid=||refusal("fixture_unavailable","Isolated native usage-limit fixture unavailable");
        if phase=="clear" {
            let mut state=self.routes.state.lock().await;
            if state.usage_fixture.as_ref().is_some_and(|f|f.task==task&&f.principal==actor.principal_id) {
                self.routes.cancel_task(&mut state,actor.principal_id,task);
                state.credentials.remove(&(actor.principal_id,routes::RouteId::CodexResponses));
                state.usage_fixture=None;
            }
            return Ok(json!({"accepted":true,"providerCalls":0}));
        }
        let selected=route.current.as_ref().filter(|_|!route.stale_configuration).ok_or_else(invalid)?;
        if selected.configuration.route_id()!=routes::RouteId::CodexResponses || selected.configuration.model()!="fixture-model-20261030" || policy.workspace_id!=route.workspace_id.to_string() {return Err(invalid());}
        if phase=="prepare" {
            // Refuse rather than coexisting with any real Codex authentication.
            if self.routes.responses.as_ref().and_then(|r|r.provider.auth_manager()).and_then(|a|a.auth_cached()).is_some() {return Err(invalid());}
            let mut state=self.routes.state.lock().await;
            if state.usage_fixture.is_some() || state.credentials.contains_key(&(actor.principal_id,routes::RouteId::CodexResponses)) {return Err(invalid());}
            state.credentials.insert((actor.principal_id,routes::RouteId::CodexResponses),(selected.configuration.account_ref().into(),1));
            state.usage_fixture=Some(UsageLimitFixture {task:task.into(),principal:actor.principal_id,route_revision:route.revision.get(),provider_calls:0});
            return Ok(json!({"accepted":true,"providerCalls":0}));
        }
        if phase!="refuse" {return Err(invalid());}
        {
            let state=self.routes.state.lock().await;
            if !state.usage_fixture.as_ref().is_some_and(|f|f.task==task&&f.principal==actor.principal_id&&f.route_revision==route.revision.get()) {return Err(invalid());}
        }
        let before=usage::task_usage(&store,actor,task).await.map_err(domain_error)?;
        // Fixed permission-only action. This fixture never runs it or applies a verdict.
        policy.execution=Some(json!({"automatic_permission_review":true,"command_rules":[{"prefix":["/usr/bin/true"],"decision":"prompt"}]}));
        let request_id=uuid::Uuid::new_v4().to_string();
        self.permissions_request(connection,InquelloPermissionsRequestParams {operation_id:uuid::Uuid::new_v4().to_string(),request_id:request_id.clone(),workspace_policy:policy.clone(),task_id:task.into(),command:vec!["/usr/bin/true".into()],origin:"runtime".into(),ttl_ms:60_000},device.clone(),user.clone()).await?;
        let result=self.permissions_review(connection,InquelloPermissionsReviewParams {request_id,authority_epoch:policy.authorization_epoch,workspace_policy:policy,data_tier:"synthetic".into()},device,user).await?;
        let result:InquelloPermissionsReviewResponse=serde_json::from_value(serde_json::to_value(result.ok_or_else(invalid)?).map_err(|_|invalid())?).map_err(|_|invalid())?;
        let after=usage::task_usage(&store,actor,task).await.map_err(domain_error)?;
        let calls=self.routes.state.lock().await.usage_fixture.as_ref().map(|f|f.provider_calls).ok_or_else(invalid)?;
        if result.status!="human_required" || calls!=0 || after.attempts.len()!=before.attempts.len()+1
            || !after.attempts.iter().any(|a|a.status==AttemptStatus::Refused&&a.snapshot.operation_kind==OperationKind::AutomatedPermissionReview&&a.usage.input_tokens.is_none())
            || !before.attempts.iter().all(|old|after.attempts.iter().any(|a|a==old)) {return Err(invalid());}
        Ok(json!({"accepted":true,"providerCalls":calls,"retainedAttempts":before.attempts.len(),"refused":true}))
    }
}
