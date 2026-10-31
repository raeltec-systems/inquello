//! Native Start coordinator. Candidate reads have no Task/thread/model side effects.
//! The durable journal claims dispatch once; uncertain acknowledgements never retry.
use super::*;
use codex_app_server_protocol::*;
use inquello_domain::routes::{self, RouteStore};
use inquello_domain::tasks::{StartTaskIntent, TaskRunBinding, TaskRunStatus, TaskRunStore, TaskReservationError, TaskSetupFailure};
use inquello_domain::usage::{self, UsageStore};
use codex_core::inquello_inference::{AttemptContext, TaskAuthorization, TaskAuthorizationContext};
use codex_protocol::error::{CodexErr, Result as CoreResult};
use std::sync::Arc;
use std::result::Result;
use tokio_util::sync::CancellationToken;

#[derive(Clone)]
pub(super) struct SessionBinding {
    principal: PrincipalId, workspace: String, root: PathBuf, pub(super) cancellation: CancellationToken,
}
impl InquelloRequestProcessor {
    pub(crate) fn with_task_config(mut self,config:super::super::ConfigRequestProcessor)->Self {self.task_config=Some(config);self}
    async fn current_task_layers(&self)->Result<(DeviceRequirements,UserConfig),JSONRPCErrorError> {
        let source=self.task_config.as_ref().ok_or_else(||refusal("authority_unknown","Current native device/user policy unavailable"))?;
        let requirements=source.config_requirements_read().await?;
        let config=source.read(ConfigReadParams {include_layers:true,cwd:None}).await?;
        Ok((Self::device_requirements(&requirements),Self::user_config(&config)))
    }
    pub(crate) fn with_task_outgoing(mut self,outgoing:Arc<crate::outgoing_message::OutgoingMessageSender>)->Self {self.task_outgoing=Some(outgoing);self}
    async fn authorize_task_disclosure(&self,connection:ConnectionId,actor:Actor,workspace:&str)->Result<(),JSONRPCErrorError> {
        let session=self.task_session(connection,actor,workspace).await?;
        let outgoing=self.task_outgoing.as_ref().ok_or_else(||refusal("authority_unknown","Current service authority unavailable"))?;
        let policy=current_service_policy(outgoing,connection,workspace,&session.cancellation).await?;
        let (device,user)=self.current_task_layers().await?;
        self.observe_review_authority(connection,&policy,&device,&user).await?;
        if !self.task_read_policy_current(actor.principal_id,&policy).await || self.actor(connection)?!=actor || session.cancellation.is_cancelled() {
            return Err(refusal("stale","Workspace authority changed before private disclosure"));
        }
        Ok(())
    }
    pub(crate) async fn tasks_bootstrap(&self, connection: ConnectionId, params: InquelloTasksBootstrapParams)
        -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        #[cfg(all(feature="inference-fixtures", debug_assertions))]
        {
            let actor = self.actor(connection)?;
            WorkspaceId::parse(&params.workspace_id).map_err(domain_error)?;
            let root = std::fs::canonicalize(&params.isolated_root).map_err(|_| refusal("classification_unknown", "Authorized isolated session root unavailable"))?;
            let marker = root.join(".inquello-fictional-audit-session");
            let metadata = std::fs::symlink_metadata(&marker).map_err(|_| refusal("classification_unknown", "Authorized isolated session marker unavailable"))?;
            let store_parent = self.store_path.as_ref().and_then(|p|p.parent()).and_then(|p|std::fs::canonicalize(p).ok());
            if !root.is_dir() || !metadata.is_file() || metadata.file_type().is_symlink() || !store_parent.is_some_and(|p|p.starts_with(&root)) {
                return Err(refusal("classification_unknown", "Private store and authorized isolated session root do not match"));
            }
            let mut sessions = self.task_sessions.lock().await;
            if sessions.get(&connection).is_some_and(|old|old.principal==actor.principal_id && old.workspace==params.workspace_id && old.root==root && !old.cancellation.is_cancelled()) {return Ok(Some(InquelloRoutePrivateAuthResponse {accepted:true}.into()));}
            if let Some(old) = sessions.remove(&connection) { old.cancellation.cancel(); }
            if self.actor(connection)? != actor { return Err(refusal("stale", "Identity changed during session setup")); }
            sessions.insert(connection, SessionBinding { principal:actor.principal_id, workspace:params.workspace_id, root, cancellation:CancellationToken::new() });
            return Ok(Some(InquelloRoutePrivateAuthResponse {accepted:true}.into()));
        }
        #[cfg(not(all(feature="inference-fixtures", debug_assertions)))]
        { let _=(connection,params); Err(refusal("classification_unknown", "Authorized private data environment is not configured")) }
    }
    async fn task_session(&self, connection:ConnectionId, actor:Actor, workspace:&str)->Result<SessionBinding,JSONRPCErrorError> {
        self.task_sessions.lock().await.get(&connection)
            .filter(|s|s.principal==actor.principal_id && s.workspace==workspace && !s.cancellation.is_cancelled()).cloned()
            .ok_or_else(||refusal("classification_unknown","Current private data environment is not authorized; draft retained"))
    }
    async fn candidate_capabilities(&self, configuration:&routes::RouteConfiguration,check_quota:bool)->Result<usage_bridge::Capabilities,JSONRPCErrorError> {
        if configuration.route_id()==routes::RouteId::ClaudeApiKey {return Ok(usage_bridge::Capabilities {reasoning:vec!["default".into()],speeds:vec!["default".into()],defaults:usage::Choices::default()});}
        let (_,catalog)=self.usage_sources.as_ref().ok_or_else(||refusal("capabilities_unavailable","Authoritative model settings unavailable"))?;
        let model=if check_quota {catalog.inquello_usage_model(configuration.model()).await?}else{catalog.inquello_cached_usage_model(configuration.model()).await?};
        let mut reasoning=vec!["default".into()];
        reasoning.extend(model.supported_reasoning_efforts.into_iter().filter_map(|r|serde_json::to_value(r.reasoning_effort).ok()?.as_str().map(str::to_string)));
        let mut speeds=vec!["default".into()];speeds.extend(model.service_tiers.into_iter().map(|s|s.id));
        let default=serde_json::to_value(model.default_reasoning_effort).ok().and_then(|v|v.as_str().map(str::to_string)).ok_or_else(||refusal("capabilities_unavailable","Provider default reasoning unavailable"))?;
        Ok(usage_bridge::Capabilities {reasoning,speeds,defaults:usage::Choices {reasoning:default,speed:model.default_service_tier.unwrap_or_else(||"default".into())}})
    }
    async fn checked_candidate(&self,connection:ConnectionId,params:&InquelloTasksPreflightParams,device:&DeviceRequirements,user:&UserConfig,check_quota:bool)
        ->Result<(SqliteWorkingStore,Actor,routes::RouteConfiguration,u64,usage_bridge::Capabilities,SessionBinding),JSONRPCErrorError> {
        let (store,actor)=self.context(connection).await?;
        if params.workspace_id!=params.workspace_policy.workspace_id || params.workspace_policy.authorization_epoch==0 {
            return Err(refusal("authority_unknown","Current Workspace membership and policy authority required"));
        }
        workspace_layer(&params.workspace_policy)?;
        self.observe_review_authority(connection,&params.workspace_policy,device,user).await?;
        let session=self.task_session(connection,actor,&params.workspace_id).await?;
        let id=routes::RouteId::parse(&params.route_id).ok_or_else(||refusal("invalid","Explicit configured route required"))?;
        let (_,candidate)=store.load_candidate_route(actor.principal_id,id).await.map_err(|e|domain_error(DomainError::Store(e)))?;
        let candidate=candidate.filter(|c|c.revision.get()==params.configuration_revision).ok_or_else(||refusal("revision_conflict","Route configuration changed; select and confirm current settings"))?;
        let generation=self.routes.state.lock().await.credential(actor.principal_id,&candidate.configuration);
        let eligibility=routes::route_eligibility(Some(&candidate.configuration),generation.is_some(),true,routes::DataTier::Synthetic);
        if !eligibility.enabled && !self.task_fixture_matches(connection,actor,&params.workspace_id,&candidate.configuration,params.configuration_revision).await {return Err(refusal("route_unavailable",eligibility.gate.unwrap_or("Selected route lacks current authorization evidence")));}
        let generation=generation.ok_or_else(||refusal("credential_unavailable","Selected route credential unavailable"))?;
        if id==routes::RouteId::CodexResponses {self.routes.responses.as_ref().ok_or_else(||refusal("route_unavailable","Inherited provider unavailable"))?.check_configuration(&candidate.configuration).map_err(|_|refusal("route_unavailable","Selected endpoint differs from inherited runtime provider"))?;}
        let caps=self.candidate_capabilities(&candidate.configuration,check_quota).await?;
        let inherited=if check_quota {self.usage_limit_check(&params.route_id,"").await?}else{None};
        let state=self.routes.state.lock().await;
        let (_,latest)=store.load_candidate_route(actor.principal_id,id).await.map_err(|e|domain_error(DomainError::Store(e)))?;
        if self.actor(connection)?!=actor || session.cancellation.is_cancelled() || latest.as_ref()!=Some(&candidate) || state.credential(actor.principal_id,&candidate.configuration)!=Some(generation)
            || inherited.as_ref().is_some_and(|b|!self.routes.responses.as_ref().is_some_and(|r|r.binding_current(b))) {
            return Err(refusal("stale","Identity, route, credentials or quota changed during preflight"));
        }
        Ok((store,actor,candidate.configuration,generation,caps,session))
    }
    pub(crate) async fn tasks_preflight(&self,connection:ConnectionId,params:InquelloTasksPreflightParams,device:DeviceRequirements,user:UserConfig)
        ->Result<Option<ClientResponsePayload>,JSONRPCErrorError> {
        let (_,_,configuration,_,caps,_)=self.checked_candidate(connection,&params,&device,&user,false).await?;
        Ok(Some(InquelloTasksPreflightResponse {route_id:params.route_id,configuration_revision:params.configuration_revision,
            reasoning:caps.reasoning,speeds:caps.speeds,available:true,
            reason:"Only these explicitly confirmed settings apply. Background compaction, memory summarization and model warmup are unavailable for private Tasks.".into(),
            execution_flow:"Tools execute locally under the private Task sandbox and permission policy".into(),
            inference_flow:format!("Inference uses only {} at {}; connectivity is required",configuration.model(),configuration.endpoint())}.into()))
    }
    async fn run_response(&self,connection:ConnectionId,actor:Actor,store:&SqliteWorkingStore,run:TaskRunBinding)->Result<Option<ClientResponsePayload>,JSONRPCErrorError> {
        self.authorize_task_disclosure(connection,actor,&run.workspace_id).await?;
        let request=store.task_run_request(actor.principal_id,&run.operation_id).await.map_err(domain_error)?;
        // Reading private history may wait; refresh disclosure authority again afterward.
        self.authorize_task_disclosure(connection,actor,&run.workspace_id).await?;
        let status=if run.runtime_id!=self.runtime_id && matches!(run.status,TaskRunStatus::Reserved|TaskRunStatus::Bound|TaskRunStatus::Dispatching|TaskRunStatus::Running) {TaskRunStatus::Uncertain} else {run.status};
        Ok(Some(InquelloTasksStartResponse {operation_id:run.operation_id,task_id:run.task_id,run_id:run.run_id,thread_id:run.thread_id.clone(),
            status:status_name(status).into(),request,accepted:run.thread_id.is_some() && run.turn_id.is_some(),reason:if status==TaskRunStatus::SetupFailed {Some(match run.setup_failure {
                Some(TaskSetupFailure::AuthorityUnavailable)=>"Current authority unavailable before first-turn submission. Private Task retained; draft preserved. Nothing will be retried automatically.",
                Some(TaskSetupFailure::TurnNotIdle)=>"First turn was not accepted because the retained thread was not idle. Private Task and draft retained; no steering or retry.",
                _=>"Private thread setup failed before first-turn submission. Private Task and draft retained; no automatic retry.",
            }.into())} else if matches!(status,TaskRunStatus::Uncertain|TaskRunStatus::Failed) {Some("Execution could not be confirmed; retained work will not be automatically retried".into())} else {None}}.into()))
    }
    pub(crate) async fn tasks_reconcile(&self,connection:ConnectionId,params:InquelloTasksReconcileParams)->Result<Option<ClientResponsePayload>,JSONRPCErrorError> {
        let (store,actor)=self.context(connection).await?;
        let run=store.find_task_run(actor.principal_id,&params.operation_id).await.map_err(domain_error)?.ok_or_else(||refusal("not_found","No private operation receipt found"))?;
        self.run_response(connection,actor,&store,run).await
    }
    pub(crate) async fn tasks_for_thread(&self,connection:ConnectionId,params:InquelloTasksForThreadParams)->Result<Option<ClientResponsePayload>,JSONRPCErrorError> {
        let (store,actor)=self.context(connection).await?;
        let run=store.find_thread_run(actor.principal_id,&self.runtime_id,&params.thread_id).await.map_err(domain_error)?.ok_or_else(||refusal("not_found","Current private Task/thread ownership is unknown"))?;
        self.authorize_task_disclosure(connection,actor,&run.workspace_id).await?;
        if self.actor(connection)?!=actor {return Err(refusal("stale","Private identity changed"));}
        Ok(Some(InquelloTasksForThreadResponse {task_id:run.task_id,run_id:run.run_id,thread_id:params.thread_id,status:status_name(run.status).into()}.into()))
    }
    /// A connection subscription is not authority. Generic retained APIs are
    /// unavailable for private-store hosts until exact current ownership is proven.
    pub(crate) async fn require_task_thread(&self,connection:ConnectionId,thread:&str)->Result<(),JSONRPCErrorError> {
        if self.store_path.is_none() {return Ok(());}
        self.tasks_for_thread(connection,InquelloTasksForThreadParams {thread_id:thread.into()}).await.map(|_|())
    }
}
fn status_name(status:TaskRunStatus)->&'static str {match status {TaskRunStatus::Reserved=>"reserved",TaskRunStatus::Bound=>"bound",TaskRunStatus::Dispatching=>"dispatching",TaskRunStatus::Running=>"running",TaskRunStatus::Completed=>"completed",TaskRunStatus::Failed=>"failed",TaskRunStatus::Cancelled=>"cancelled",TaskRunStatus::Uncertain=>"uncertain",TaskRunStatus::SetupFailed=>"setup-failed"}}

impl InquelloRequestProcessor {
    pub(crate) async fn tasks_start(self:&Arc<Self>, connection:ConnectionId, params:InquelloTasksStartParams,
        device:DeviceRequirements,user:UserConfig,threads:&super::super::ThreadRequestProcessor)
        ->Result<Option<ClientResponsePayload>,JSONRPCErrorError> {
        let _start=self.task_start_lock.lock().await;
        let intent=StartTaskIntent {operation_id:params.operation_id.clone(),workspace_id:params.workspace_id.clone(),engagement_id:params.engagement_id,folder_id:params.folder_id,
            request:params.request,route_id:params.route_id.clone(),configuration_revision:params.configuration_revision,choices:usage::Choices {reasoning:params.reasoning,speed:params.speed}};
        intent.validate().map_err(domain_error).map_err(before_effect)?;
        let (store,actor)=self.context(connection).await.map_err(before_effect)?;
        if store.find_task_run(actor.principal_id,&intent.operation_id).await.map_err(domain_error)?.is_some() {
            // reserve validates the entire canonical intent against immutable private request history;
            // duplicate state is never used as a new dispatch permit.
            let existing=store.reserve_task_run(actor.principal_id,intent,&self.runtime_id,SystemClock.now().unix_millis()).await.map_err(domain_error)?;
            return self.run_response(connection,actor,&store,existing).await;
        }
        let preflight=InquelloTasksPreflightParams {workspace_id:params.workspace_id,route_id:params.route_id,configuration_revision:params.configuration_revision,workspace_policy:params.workspace_policy.clone()};
        let (store,actor,configuration,generation,caps,session)=self.checked_candidate(connection,&preflight,&device,&user,true).await.map_err(before_effect)?;
        if !caps.reasoning.contains(&intent.choices.reasoning)||!caps.speeds.contains(&intent.choices.speed) {return Err(before_effect(refusal("unsupported_settings","Explicitly confirm supported reasoning and speed for this configuration")));}
        if !self.task_authority_current(actor.principal_id,&params.workspace_policy,&device,&user).await || session.cancellation.is_cancelled() {return Err(before_effect(refusal("stale","Workspace authority changed before private Task creation")));}
        let fresh=current_service_policy(&threads.inquello_permission_sender(),connection,&intent.workspace_id,&session.cancellation).await.map_err(before_effect)?;
        self.observe_review_authority(connection,&fresh,&device,&user).await.map_err(before_effect)?;
        if fresh!=params.workspace_policy || self.actor(connection).map_err(before_effect)?!=actor || session.cancellation.is_cancelled() {return Err(before_effect(refusal("stale","Workspace authority changed before Task creation")));}
        let (current_device,current_user)=self.current_task_layers().await.map_err(before_effect)?;
        if current_device!=device || current_user!=user {return Err(before_effect(refusal("stale","Native policy changed before Task creation")));}
        // The adapter invokes this bounded native fence after acquiring its writer
        // and again immediately before commit. It does not import main authority.
        let validate=|| async {
            let checked:Result<(),JSONRPCErrorError>=async {
                self.usage_limit_check(&intent.route_id,"").await?;
                let fresh=current_service_policy(&threads.inquello_permission_sender(),connection,&intent.workspace_id,&session.cancellation).await?;
                let (current_device,current_user)=self.current_task_layers().await?;
                if fresh!=params.workspace_policy || current_device!=device || current_user!=user
                    || self.actor(connection)?!=actor || session.cancellation.is_cancelled()
                    || !self.task_authority_current(actor.principal_id,&fresh,&device,&user).await {
                    return Err(refusal("stale","Authority changed while reserving private work"));
                }
                self.task_session(connection,actor,&intent.workspace_id).await?;
                let state=self.routes.state.lock().await;
                if state.credential(actor.principal_id,&configuration)!=Some(generation)
                    || self.actor(connection)?!=actor || session.cancellation.is_cancelled() {
                    return Err(refusal("stale","Identity or credentials changed before reservation commit"));
                }
                Ok(())
            }.await;
            checked.map_err(|_|DomainError::InvalidCommand("Current authority, policy, credentials or quota unavailable before private Task reservation".into()))
        };
        let run=store.reserve_task_run_fenced(actor.principal_id,intent.clone(),&self.runtime_id,SystemClock.now().unix_millis(),validate).await.map_err(|e|match e {
            TaskReservationError::PreEffect(error)=>before_effect(domain_error(error)),
            TaskReservationError::Ambiguous(error)=>domain_error(error),
        })?;
        let cancellation=session.cancellation.child_token();
        self.register_task_cancellation(actor.principal_id,&run.task_id,cancellation.clone()).await;
        #[cfg(all(feature="inference-fixtures",debug_assertions))]
        let fixture=self.task_fixtures.lock().await.get(&connection).cloned();
        let authorization=Arc::new(TaskGuard {
            #[cfg(all(feature="inference-fixtures",debug_assertions))]
            fixture,processor:self.clone(),connection,actor,run:run.clone(),configuration,generation,policy:params.workspace_policy,device,user,cancellation,tools:tokio::sync::Mutex::new(HashMap::new()),outgoing:threads.inquello_permission_sender(),defaults:caps.defaults});
        let mut submission_started=false;
        let mut setup_failure=TaskSetupFailure::AuthorityUnavailable;
        let result=async {
            authorization.recheck().await?;
            let thread_id=threads.inquello_reserve_thread_id();
            // Durable association precedes startup, listeners, model or tool work.
            store.bind_task_thread(actor.principal_id,&run.operation_id,&self.runtime_id,&thread_id.to_string()).await.map_err(domain_error)?;
            let folder=session.root.join("tasks").join(&run.task_id);
            authorization.recheck().await?;
            create_private_task_folder(&session.root,&run.task_id)?;
            let folder=task_folder(&folder.to_string_lossy(),TaskId::parse(&run.task_id).map_err(domain_error)?)?;
            let policy=execution_policy::effective_policy(&workspace_layer(&authorization.policy)?,&authorization.device,&authorization.user);
            let profile=execution_policy::tool_profile(&policy,BroadModeStatus::Standard,folder);
            let runtime=runtime_profile(&profile);
            authorization.recheck().await?;
            let effective_choices=usage::Choices {reasoning:if intent.choices.reasoning=="default" {authorization.defaults.reasoning.clone()}else{intent.choices.reasoning.clone()},speed:if intent.choices.speed=="default" {authorization.defaults.speed.clone()}else{intent.choices.speed.clone()}};
            setup_failure=TaskSetupFailure::ThreadSetupFailed;
            let thread=threads.inquello_start_private_thread(connection,thread_id,&authorization.configuration,&effective_choices,&runtime,TaskAuthorizationContext(authorization.clone())).await?;
            setup_failure=TaskSetupFailure::AuthorityUnavailable;
            authorization.recheck().await?;
            store.claim_task_dispatch(actor.principal_id,&run.operation_id,&self.runtime_id).await.map_err(domain_error)?;
            authorization.recheck().await?;
            submission_started=true; // Any error after entering submission is ambiguous.
            let submission=threads.inquello_start_private_turn(&thread,intent.request,TaskAuthorizationContext(authorization.clone())).await?;
            match submission {
                codex_core::StartIfIdleSubmission::Started {turn_id,..}=>{
                    let latest=store.find_task_run(actor.principal_id,&run.operation_id).await.map_err(domain_error)?.ok_or_else(||refusal("not_found","Private operation disappeared"))?;
                    if matches!(latest.status,TaskRunStatus::Dispatching|TaskRunStatus::Running) {store.mark_task_run(actor.principal_id,&run.operation_id,TaskRunStatus::Running,Some(&turn_id)).await.map_err(domain_error)?;}
                    Ok(())
                },
                codex_core::StartIfIdleSubmission::NotSubmitted {..}=>{submission_started=false;setup_failure=TaskSetupFailure::TurnNotIdle;Err(refusal("turn_not_idle","First turn was not accepted; no steering or retry performed"))},
            }
        }.await;
        if result.is_err() {
            authorization.cancellation.cancel();
            if submission_started {let _=store.mark_task_run(actor.principal_id,&run.operation_id,TaskRunStatus::Uncertain,None).await;}
            else if store.fail_task_setup(actor.principal_id,&run.operation_id,setup_failure).await.is_err() {
                // A storage error is not proof of a durable non-dispatch receipt.
                let _=store.mark_task_run(actor.principal_id,&run.operation_id,TaskRunStatus::Uncertain,None).await;
            }
        }
        let current=store.find_task_run(actor.principal_id,&run.operation_id).await.map_err(domain_error)?.ok_or_else(||failure("uncertain","Private operation receipt unavailable; reconcile the same operation"))?;
        self.run_response(connection,actor,&store,current).await
    }
}
struct TaskGuard {
    #[cfg(all(feature="inference-fixtures",debug_assertions))]
    fixture:Option<TaskFixture>,
    processor:Arc<InquelloRequestProcessor>,connection:ConnectionId,actor:Actor,run:TaskRunBinding,
    configuration:routes::RouteConfiguration,generation:u64,policy:InquelloWorkspaceExecutionPolicy,
    device:DeviceRequirements,user:UserConfig,cancellation:CancellationToken,defaults:usage::Choices,
    outgoing:Arc<crate::outgoing_message::OutgoingMessageSender>,
    tools:tokio::sync::Mutex<HashMap<String,(String,std::time::Instant)>>,
}
impl TaskGuard {
    async fn recheck(&self)->Result<(),JSONRPCErrorError> {
        if self.cancellation.is_cancelled() || self.processor.actor(self.connection)?!=self.actor {return Err(refusal("stale","Private Task authorization was revoked"));}
        self.processor.task_session(self.connection,self.actor,&self.run.workspace_id).await?;
        let fresh=current_service_policy(&self.outgoing,self.connection,&self.run.workspace_id,&self.cancellation).await?;
        let (device,user)=self.processor.current_task_layers().await?;
        if device!=self.device || user!=self.user {self.cancellation.cancel();return Err(refusal("stale","Native device or user policy changed before effect"));}
        self.processor.observe_review_authority(self.connection,&fresh,&self.device,&self.user).await?;
        if self.cancellation.is_cancelled() || fresh!=self.policy || self.processor.actor(self.connection)?!=self.actor {return Err(refusal("stale","Service membership or policy changed before effect"));}
        if !self.processor.task_authority_current(self.actor.principal_id,&self.policy,&self.device,&self.user).await {return Err(refusal("stale","Workspace policy changed"));}
        let store=self.processor.store().await?;
        let route=routes::task_route(&store,self.actor,&self.run.task_id).await.map_err(domain_error)?;
        let state=self.processor.routes.state.lock().await;
        if self.configuration.route_id()==routes::RouteId::CodexResponses {self.processor.routes.responses.as_ref().ok_or_else(||refusal("route_unavailable","Inherited provider unavailable"))?.check_configuration(&self.configuration).map_err(|_|refusal("route_unavailable","Selected endpoint or authentication changed"))?;}
        let selected=route.current.as_ref().ok_or_else(||refusal("route_unavailable","Task route unavailable"))?;
        if route.stale_configuration || route.revision.get()!=1 || selected.configuration!=self.configuration || selected.configuration_revision.get()!=self.run.configuration_revision
            || state.credential(self.actor.principal_id,&self.configuration)!=Some(self.generation) {return Err(refusal("stale","Task route or provider credentials changed"));}
        let run=store.find_task_run(self.actor.principal_id,&self.run.operation_id).await.map_err(domain_error)?.ok_or_else(||refusal("not_found","Task binding unavailable"))?;
        if run.runtime_id!=self.processor.runtime_id || matches!(run.status,TaskRunStatus::Failed|TaskRunStatus::Cancelled|TaskRunStatus::Uncertain|TaskRunStatus::Completed|TaskRunStatus::SetupFailed) {return Err(refusal("stale","Task binding is no longer active"));}
        let settings=usage::task_usage(&store,self.actor,&self.run.task_id).await.map_err(domain_error)?.settings.ok_or_else(||refusal("settings_unavailable","Task settings unavailable"))?;
        if settings.revision!=1 || settings.choices!=self.run.choices {return Err(refusal("stale","Task settings changed"));}
        if self.cancellation.is_cancelled() || self.processor.actor(self.connection)?!=self.actor {return Err(refusal("stale","Private Task authorization changed"));}
        Ok(())
    }
}
fn core_refusal(_:JSONRPCErrorError)->CodexErr {CodexErr::Fatal("Current private Task authority unavailable; no model/tool dispatch or retry".into())}
impl TaskAuthorization for TaskGuard {
    fn before_tool_effect<'a>(&'a self)->std::pin::Pin<Box<dyn std::future::Future<Output=CoreResult<()>>+Send+'a>> {Box::pin(async move {
        self.recheck().await.map_err(core_refusal)?;
        self.processor.usage_limit_check(self.configuration.route_id().as_str(),&self.run.task_id).await.map_err(core_refusal)?;
        self.recheck().await.map_err(core_refusal)
    })}
    fn turn_terminal<'a>(&'a self,turn_id:&'a str,outcome:codex_core::inquello_inference::TaskTurnOutcome)->std::pin::Pin<Box<dyn std::future::Future<Output=()>+Send+'a>> {Box::pin(async move {
        // Terminal accounting is allowed after revocation: it discloses nothing
        // and performs no model/tool effect. Storage rejects terminal rewrites.
        use codex_core::inquello_inference::TaskTurnOutcome;
        let status=match outcome {TaskTurnOutcome::Completed=>TaskRunStatus::Completed,TaskTurnOutcome::Failed=>TaskRunStatus::Failed,TaskTurnOutcome::Cancelled=>TaskRunStatus::Cancelled};
        let Ok(store)=self.processor.store().await else {self.cancellation.cancel();return;};
        let Ok(Some(bound))=store.find_task_run(self.actor.principal_id,&self.run.operation_id).await else {self.cancellation.cancel();return;};
        let Some(thread)=bound.thread_id.as_deref() else {self.cancellation.cancel();return;};
        if store.observe_task_terminal(self.actor.principal_id,&self.run.operation_id,&self.processor.runtime_id,thread,turn_id,status).await.is_err(){self.cancellation.cancel();}
    })}
    fn cancellation(&self)->CancellationToken {self.cancellation.clone()}
    fn before_attempt<'a>(&'a self,turn_id:&'a str)->std::pin::Pin<Box<dyn std::future::Future<Output=CoreResult<AttemptContext>>+Send+'a>> {Box::pin(async move {
        #[cfg(all(feature="inference-fixtures",debug_assertions))]
        if self.fixture.as_ref().is_some_and(|f|f.fail_before_sampling) {return Err(CodexErr::Fatal("Injected retained pre-sampling fixture failure".into()));}
        self.recheck().await.map_err(core_refusal)?;
        self.processor.usage_limit_check(self.configuration.route_id().as_str(),&self.run.task_id).await.map_err(core_refusal)?;
        self.recheck().await.map_err(core_refusal)?;
        let store=self.processor.store().await.map_err(core_refusal)?;
        store.mark_task_run(self.actor.principal_id,&self.run.operation_id,TaskRunStatus::Running,Some(turn_id)).await.map_err(|_|CodexErr::Fatal("Private turn attribution could not be retained".into()))?;
        let attempt_id=uuid::Uuid::new_v4().to_string();
        let binding=inquello_protocol::inference::Binding {schema_version:1,principal_id:self.actor.principal_id.to_string(),task_id:self.run.task_id.clone(),run_id:self.run.run_id.clone(),turn_id:turn_id.into(),attempt_id:attempt_id.clone(),
            route_id:self.configuration.route_id().as_str().into(),model:self.configuration.model().into(),api_version:self.configuration.api_version().into(),account_ref:self.configuration.account_ref().into(),
            authority_basis:self.run.operation_id.clone(),authority_epoch:self.policy.authorization_epoch,policy_revision:self.policy.policy_revision,route_revision:1,credential_generation:self.generation};
        let effective=usage::Choices {reasoning:if self.run.choices.reasoning=="default" {self.defaults.reasoning.clone()}else{self.run.choices.reasoning.clone()},speed:if self.run.choices.speed=="default" {self.defaults.speed.clone()}else{self.run.choices.speed.clone()}};
        store.begin_usage_attempt(usage::AttemptSnapshot {attempt_id:attempt_id.clone(),task_id:self.run.task_id.clone(),principal_id:self.actor.principal_id.to_string(),run_id:self.run.run_id.clone(),runtime_id:self.processor.runtime_id.clone(),operation_kind:usage::OperationKind::HumanRequestedModel,
            route_id:Some(binding.route_id.clone()),model:Some(binding.model.clone()),api_version:Some(binding.api_version.clone()),configuration_revision:self.run.configuration_revision,route_revision:1,settings_revision:1,
            requested:self.run.choices.clone(),effective,started_at_ms:SystemClock.now().unix_millis()}).await.map_err(|_|CodexErr::Fatal("Private inference accounting unavailable".into()))?;
        let setup:CoreResult<()>=async {
            self.recheck().await.map_err(core_refusal)?;
            #[cfg(all(feature="inference-fixtures",debug_assertions))]
            if let Some(fixture)=&self.fixture {
                if !self.processor.task_fixture_matches(self.connection,self.actor,&self.run.workspace_id,&self.configuration,self.run.configuration_revision).await {return Err(CodexErr::Fatal("Retained Task fixture scope changed; no provider dispatch".into()));}
                codex_core::inquello_inference::fixtures::bind_task_transport(&binding,&fixture.endpoint,&fixture.certificate)?;
            }
            Ok(())
        }.await;
        if let Err(error)=setup {
            finish_undispatched_attempt(&store,self.actor,&self.run.task_id,&attempt_id,&self.cancellation).await;
            return Err(error);
        }
        let (events,receiver)=tokio::sync::mpsc::channel(32);
        tokio::spawn(record_attempt(store,self.actor,self.run.clone(),binding.clone(),receiver,self.cancellation.clone()));
        Ok(AttemptContext {binding,auth:Some(self.processor.routes.auth.clone()),max_output_tokens:4096,completed_tool_call_ids:Vec::new(),events,cancellation:self.cancellation.clone()})
    })}
    fn before_tool<'a>(&'a self,name:&'a str,arguments:&'a str,call_id:&'a str)->std::pin::Pin<Box<dyn std::future::Future<Output=CoreResult<()>>+Send+'a>> {Box::pin(async move {
        self.recheck().await.map_err(core_refusal)?;
        if name!="exec_command" {return Err(CodexErr::Fatal("This tool has no exact bounded private Task mapping".into()));}
        let _=(arguments,call_id); // Native handler validates schema and resolves argv.
        Ok(())
    })}
    fn before_command<'a>(&'a self,command:&'a [String],cwd:&'a std::path::Path,call_id:&'a str)->std::pin::Pin<Box<dyn std::future::Future<Output=CoreResult<()>>+Send+'a>> {Box::pin(async move {
        self.recheck().await.map_err(core_refusal)?;
        let session=self.processor.task_session(self.connection,self.actor,&self.run.workspace_id).await.map_err(core_refusal)?;
        let root=session.root.join("tasks").join(&self.run.task_id);
        if cwd!=root || command.is_empty() || command.iter().any(|arg|arg.contains('\0')) {return Err(CodexErr::Fatal("Exact native command and Task root required".into()));}
        // Refuse an already attempted call before any new permission wait.
        if self.tools.lock().await.contains_key(call_id) {return Err(CodexErr::Fatal("Private command attempt already consumed".into()));}
        let store=self.processor.store().await.map_err(core_refusal)?;
        let evaluated=evaluate_task_command(&store,self.actor,&workspace_layer(&self.policy).map_err(core_refusal)?,&self.device,&self.user,&self.run.task_id,&command).await.map_err(core_refusal)?;
        if evaluated.evaluation.decision==RuleDecision::Forbid || evaluated.evaluation.cannot_ask {return Err(CodexErr::Fatal("Current private Task command rule forbids this action".into()));}
        if evaluated.evaluation.decision==RuleDecision::Prompt {
            let run=store.find_task_run(self.actor.principal_id,&self.run.operation_id).await.map_err(|_|CodexErr::Fatal("Task binding unavailable".into()))?
                .ok_or_else(||CodexErr::Fatal("Task binding unavailable".into()))?;
            let thread_id=run.thread_id.as_ref().and_then(|id|codex_protocol::ThreadId::from_string(id).ok()).ok_or_else(||CodexErr::Fatal("Real private thread ownership required".into()))?;
            let session=self.processor.task_session(self.connection,self.actor,&self.run.workspace_id).await.map_err(core_refusal)?;
            let payload=ServerRequestPayload::ExecCommandApproval(ExecCommandApprovalParams {conversation_id:thread_id,call_id:uuid::Uuid::new_v4().to_string(),approval_id:None,
                command:command.to_vec(),cwd:session.root.join("tasks").join(&self.run.task_id),reason:Some("Private Task permission to act — not analytical review or Professional Approval".into()),parsed_cmd:Vec::new()});
            let (id,response)=self.outgoing.send_request_to_connections(Some(&[self.connection]),payload,Some(thread_id)).await;
            let response=tokio::select! {biased;_=self.cancellation.cancelled()=>None,result=tokio::time::timeout(std::time::Duration::from_secs(120),response)=>result.ok().and_then(|r|r.ok()).and_then(|r|r.ok())};
            self.outgoing.cancel_request(&id).await;
            if response.as_ref().and_then(|r|r.get("decision")).and_then(|v|v.as_str())!=Some("approved") {return Err(CodexErr::Fatal("Private Task action denied or expired; nothing executed".into()));}
        }
        self.recheck().await.map_err(core_refusal)?;
        let mut tools=self.tools.lock().await;
        if tools.contains_key(call_id) {return Err(CodexErr::Fatal("Private tool call has already been dispatched; no retry".into()));}
        let attempt_id=uuid::Uuid::new_v4().to_string();
        store.begin_usage_attempt(usage::AttemptSnapshot {attempt_id:attempt_id.clone(),task_id:self.run.task_id.clone(),principal_id:self.actor.principal_id.to_string(),run_id:self.run.run_id.clone(),runtime_id:self.processor.runtime_id.clone(),operation_kind:usage::OperationKind::LocalTool,
            route_id:Some(self.run.route_id.clone()),model:Some(self.configuration.model().into()),api_version:Some(self.configuration.api_version().into()),configuration_revision:self.run.configuration_revision,route_revision:1,settings_revision:1,
            requested:self.run.choices.clone(),effective:self.run.choices.clone(),started_at_ms:SystemClock.now().unix_millis()}).await.map_err(|_|CodexErr::Fatal("Private tool accounting unavailable".into()))?;
        tools.insert(call_id.into(),(attempt_id.clone(),std::time::Instant::now()));
        if let Err(error)=self.recheck().await {
            // Registry awaits this handler and finalizes the inserted attempt once.
            return Err(core_refusal(error));
        }
        Ok(())
    })}
    fn after_tool<'a>(&'a self,call_id:&'a str,success:bool)->std::pin::Pin<Box<dyn std::future::Future<Output=()>+Send+'a>> {Box::pin(async move {
        let tools=self.tools.lock().await;
        let Some((id,began))=tools.get(call_id) else {return;}; // Shape/permission refusal never created accounting.
        let Ok(store)=self.processor.store().await else {self.cancellation.cancel();return;};
        let Ok(task)=TaskId::parse(&self.run.task_id) else {self.cancellation.cancel();return;};
        let status=if self.cancellation.is_cancelled(){usage::AttemptStatus::Uncertain}else if success {usage::AttemptStatus::Completed}else{usage::AttemptStatus::Failed};
        if store.finish_usage_attempt(self.actor.principal_id,task,id,usage::FinishAttempt {status,ended_at_ms:SystemClock.now().unix_millis(),elapsed_ms:began.elapsed().as_millis().try_into().unwrap_or(u64::MAX),output_ref:None}).await.is_err(){self.cancellation.cancel();}
    })}
}

/// No provider or tool effect occurred: close the persisted accounting entry
/// even if authorization or fixture setup failed after the insert.
async fn finish_undispatched_attempt(store:&SqliteWorkingStore,actor:Actor,task_id:&str,attempt_id:&str,cancellation:&CancellationToken) {
    let Ok(task)=TaskId::parse(task_id) else {cancellation.cancel();return;};
    if store.finish_usage_attempt(actor.principal_id,task,attempt_id,usage::FinishAttempt {status:usage::AttemptStatus::Failed,ended_at_ms:SystemClock.now().unix_millis(),elapsed_ms:0,output_ref:None}).await.is_err(){cancellation.cancel();}
}

async fn record_attempt(store:SqliteWorkingStore,actor:Actor,run:TaskRunBinding,binding:inquello_protocol::inference::Binding,
    mut receiver:tokio::sync::mpsc::Receiver<inquello_protocol::inference::Event>,cancellation:CancellationToken) {
    use inquello_protocol::inference::{EventGuard,EventKind};
    let Ok(task)=TaskId::parse(&run.task_id) else {cancellation.cancel();return;};
    let began=std::time::Instant::now();
    let mut guard=EventGuard::new(binding.clone());let mut status=usage::AttemptStatus::Uncertain;let mut output_ref=None;
    loop {
        // Close on cancellation, then drain all already accepted events. In
        // particular a queued completion or usage update beats cancellation.
        if cancellation.is_cancelled() { receiver.close(); }
        let event=tokio::select! {
            biased;
            event=receiver.recv()=>match event {Some(event)=>event,None=>{if cancellation.is_cancelled(){status=usage::AttemptStatus::Cancelled;}break;}},
            _=cancellation.cancelled()=>{receiver.close();continue;},
        };
        if guard.accept(&event).is_err(){cancellation.cancel();break;}
        if event.provider_message_id.is_some(){output_ref=event.provider_message_id.clone();}
        match event.event {
            EventKind::UsageUpdate {usage:native}=>{
                let result=store.record_usage_event(actor.principal_id,task,&binding.attempt_id,usage::UsageEvent {event_id:format!("native-{}",event.sequence),sequence:event.sequence,kind:usage::UsageEventKind::Cumulative,
                    usage:usage::Consumption {input_tokens:native.input_tokens,output_tokens:native.output_tokens,cache_read_tokens:native.cache_read_tokens,cache_write_tokens:native.cache_write_tokens,
                        cost:native.cost_microunits.map(|v|format!("{}.{:06}",v/1_000_000,v%1_000_000)),currency:native.currency,provenance:native.origin}}).await;
                if result.is_err(){cancellation.cancel();break;}
            },
            EventKind::Completed {..}=>{status=usage::AttemptStatus::Completed;break;},
            EventKind::Failed {completion_uncertain,..}=>{status=if completion_uncertain {usage::AttemptStatus::Uncertain}else{usage::AttemptStatus::Failed};break;},
            _=>{},
        }
    }
    if store.finish_usage_attempt(actor.principal_id,task,&binding.attempt_id,usage::FinishAttempt {status,ended_at_ms:SystemClock.now().unix_millis(),elapsed_ms:began.elapsed().as_millis().try_into().unwrap_or(u64::MAX),output_ref}).await.is_err(){cancellation.cancel();}
    // Usage termination is deliberately independent of retained turn termination.
}

impl InquelloRequestProcessor {
    pub(crate) async fn guard_retained_request(&self,connection:ConnectionId,request:&ClientRequest)->Result<Option<String>,JSONRPCErrorError> {
        if self.store_path.is_none(){return Ok(None);}
        let method=request.method_name();
        if !(method.starts_with("thread/") || method.starts_with("turn/") || matches!(method,"getConversationSummary"|"resumeConversation"|"sendUserTurn"|"sendUserMessage"|"interruptConversation"|"getConversationSnapshot")) {return Ok(None);}
        // Lists, search, arbitrary cold resumes/forks and new generic turns do
        // not have a private authorization context. They must not disclose or
        // create orphan runtime history through a mere connection subscription.
        if !matches!(method,"thread/read"|"thread/turns/list"|"thread/items/list"|"thread/items/read"|"thread/timeline/list"|"thread/unsubscribe"|"turn/interrupt") {
            return Err(refusal("private_thread_operation_unavailable","Use the bound private Task operation; generic retained history and turn mutations are unavailable"));
        }
        let value=serde_json::to_value(request).map_err(|_|refusal("invalid","Private runtime request unavailable"))?;
        let thread=value.get("params").and_then(|v|v.get("threadId")).and_then(|v|v.as_str()).ok_or_else(||refusal("not_found","Private Task/thread ownership required"))?;
        self.require_task_thread(connection,thread).await?;
        if method=="turn/interrupt" {
            let (store,actor)=self.context(connection).await?;
            let run=store.find_thread_run(actor.principal_id,&self.runtime_id,thread).await.map_err(domain_error)?.ok_or_else(||refusal("not_found","Private Task binding unavailable"))?;
            self.routes.cancel_task(&mut self.routes.state.lock().await,actor.principal_id,&run.task_id);
        }
        Ok(Some(thread.into()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    const PRINCIPAL:&str="11111111-1111-4111-8111-111111111111";
    const WORKSPACE:&str="5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e";
    const CONNECTION:ConnectionId=ConnectionId(81);
    fn policy()->InquelloWorkspaceExecutionPolicy {InquelloWorkspaceExecutionPolicy {workspace_id:WORKSPACE.into(),policy_revision:1,authorization_epoch:1,execution:None}}
    async fn signed_in(path:PathBuf)->InquelloRequestProcessor {
        let processor=InquelloRequestProcessor::with_store_path(Some(path),Vec::new());
        processor.set_principal(CONNECTION,InquelloSetPrincipalParams {principal_id:Some(PRINCIPAL.into())}).await.expect("bind actor");
        processor
    }
    #[test]
    fn start_wire_rejects_renderer_thread_and_classification_and_redacts_debug() {
        let base=json!({"operationId":uuid::Uuid::new_v4().to_string(),"workspaceId":WORKSPACE,"engagementId":null,"folderId":null,
            "request":"R01 vendor V1 invoice INV-100 amount 12500","routeId":"claude-api-key","configurationRevision":1,
            "reasoning":"default","speed":"default","workspacePolicy":policy()});
        let params:InquelloTasksStartParams=serde_json::from_value(base.clone()).expect("valid native request");
        assert!(!format!("{params:?}").contains("INV-100"));
        for field in ["threadId","principalId","dataTier","syntheticApproved"] {
            let mut invalid=base.clone();invalid[field]=json!("untrusted");
            assert!(serde_json::from_value::<InquelloTasksStartParams>(invalid).is_err());
        }
    }
    #[tokio::test]
    async fn classification_refusal_creates_no_private_task() {
        let dir=tempfile::tempdir().expect("isolated root");
        let processor=signed_in(dir.path().join("working.sqlite")).await;
        let result=processor.tasks_preflight(CONNECTION,InquelloTasksPreflightParams {workspace_id:WORKSPACE.into(),route_id:"claude-api-key".into(),configuration_revision:1,workspace_policy:policy()},DeviceRequirements::default(),UserConfig::default()).await;
        assert_eq!(result.expect_err("unknown classification refuses").data.expect("kind")["inquello"]["kind"],"classification_unknown");
        let (store,actor)=processor.context(CONNECTION).await.expect("private store");
        let tree=organise::workspace_tree(&store,actor,WORKSPACE).await.expect("private tree");
        assert!(tree.tasks.is_empty());
    }
    #[tokio::test]
    async fn identity_reset_revokes_same_principal_session_and_unknown_threads() {
        let dir=tempfile::tempdir().expect("isolated root");let processor=signed_in(dir.path().join("working.sqlite")).await;
        let actor=processor.actor(CONNECTION).expect("actor");let cancellation=CancellationToken::new();
        processor.task_sessions.lock().await.insert(CONNECTION,SessionBinding {principal:actor.principal_id,workspace:WORKSPACE.into(),root:dir.path().into(),cancellation:cancellation.clone()});
        assert!(processor.task_session(CONNECTION,actor,WORKSPACE).await.is_ok());
        assert!(processor.require_task_thread(CONNECTION,&uuid::Uuid::new_v4().to_string()).await.is_err());
        processor.set_principal(CONNECTION,InquelloSetPrincipalParams {principal_id:Some(PRINCIPAL.into())}).await.expect("refresh identity");
        assert!(cancellation.is_cancelled());
        assert!(processor.task_session(CONNECTION,actor,WORKSPACE).await.is_err());
    }
    #[tokio::test]
    async fn generic_private_history_list_and_turn_start_cannot_bypass_binding() {
        let dir=tempfile::tempdir().expect("isolated root");let processor=signed_in(dir.path().join("working.sqlite")).await;
        let request:ClientRequest=serde_json::from_value(json!({"id":1,"method":"thread/list","params":{}})).expect("native list request");
        assert!(processor.guard_retained_request(CONNECTION,&request).await.is_err());
    }
}

/// The service is owned by main. Native obtains a fresh observation after waits;
/// neither cached Workspace membership nor a renderer assertion can grant effects.
async fn current_service_policy(outgoing:&crate::outgoing_message::OutgoingMessageSender,connection:ConnectionId,workspace:&str,cancellation:&CancellationToken)
    ->Result<InquelloWorkspaceExecutionPolicy,JSONRPCErrorError> {
    let (id,response)=outgoing.send_request_to_connections(Some(&[connection]),ServerRequestPayload::InquelloTaskAuthority(InquelloTaskAuthorityParams {workspace_id:workspace.into()}),None).await;
    let result=tokio::select! {biased;_=cancellation.cancelled()=>None,result=tokio::time::timeout(std::time::Duration::from_secs(15),response)=>result.ok().and_then(|r|r.ok()).and_then(|r|r.ok())};
    outgoing.cancel_request(&id).await;
    let result:InquelloTaskAuthorityResponse=result.and_then(|r|serde_json::from_value(r).ok()).ok_or_else(||refusal("authority_unknown","Current Workspace membership/policy refresh unavailable"))?;
    result.workspace_policy.filter(|p|p.workspace_id==workspace&&p.authorization_epoch>0).ok_or_else(||refusal("authority_unknown","Current Workspace access is not authorized"))
}
impl InquelloRequestProcessor {
    pub(crate) async fn tasks_consume_permission(&self,connection:ConnectionId,params:InquelloTasksConsumePermissionParams,device:DeviceRequirements,user:UserConfig)->Result<Option<ClientResponsePayload>,JSONRPCErrorError> {
        use inquello_domain::organise::OrganiseStore;
        let (store,actor)=self.context(connection).await?;
        let task_id=TaskId::parse(&params.task_id).map_err(domain_error)?;
        let task=store.load_task(task_id).await.map_err(|e|domain_error(DomainError::Store(e)))?
            .filter(|t|t.creator_principal_id==actor.principal_id).ok_or_else(||refusal("not_found","Private Task not found"))?;
        let thread=task.runtime_thread_id.as_ref().ok_or_else(||refusal("not_found","Private runtime thread unavailable"))?;
        self.require_task_thread(connection,thread).await?;
        let request=execution_policy::permission_request(&store,actor,&params.request_id).await.map_err(domain_error)?;
        if request.origin!=execution_policy::RequestOrigin::Runtime || request.task_id!=task_id {return Err(refusal("permission_required","This permission does not belong to the bound runtime Task"));}
        self.observe_review_authority(connection,&params.workspace_policy,&device,&user).await?;
        let evaluated=evaluate_task_command(&store,actor,&workspace_layer(&params.workspace_policy)?,&device,&user,&params.task_id,&params.command).await?;
        if evaluated.evaluation.decision==RuleDecision::Forbid || evaluated.evaluation.cannot_ask {return Err(refusal("command_forbidden","Current command policy denies this runtime action"));}
        if self.actor(connection)?!=actor {return Err(refusal("stale","Identity changed before permission consumption"));}
        execution_policy::use_permission(&store,&SystemClock,actor,&params.request_id,task_id,&params.command).await.map_err(domain_error)?;
        Ok(Some(InquelloRoutePrivateAuthResponse {accepted:true}.into()))
    }
}

/// Explicit phase evidence; clients must never infer this from an error kind.
fn before_effect(mut error:JSONRPCErrorError)->JSONRPCErrorError {
    let mut data=error.data.take().unwrap_or_else(||json!({"inquello":{}}));
    if let Some(inquello)=data.get_mut("inquello").and_then(|v|v.as_object_mut()) {inquello.insert("preEffect".into(),json!(true));}
    error.data=Some(data);error
}

fn create_private_task_folder(root:&std::path::Path,task:&str)->Result<(),JSONRPCErrorError> {
    TaskId::parse(task).map_err(domain_error)?;
    for directory in [root.join("tasks"),root.join("tasks").join(task),root.join("tasks").join(task).join("output")] {
        if let Ok(metadata)=std::fs::symlink_metadata(&directory) {
            if !metadata.is_dir()||metadata.file_type().is_symlink(){return Err(refusal("task_folder_missing","Private Task folder is not an isolated directory"));}
        }
        let mut builder=std::fs::DirBuilder::new();
        #[cfg(unix)] {use std::os::unix::fs::DirBuilderExt;builder.mode(0o700);}
        match builder.create(&directory) {Ok(())=>{},Err(error) if error.kind()==std::io::ErrorKind::AlreadyExists=>{},Err(_)=>return Err(failure("task_folder_missing","Private Task folder creation failed"))}
        let canonical=std::fs::canonicalize(&directory).map_err(|_|failure("task_folder_missing","Private Task folder unavailable"))?;
        if !canonical.starts_with(root){return Err(refusal("task_folder_missing","Private Task folder escaped the authorized isolated root"));}
        #[cfg(unix)] {use std::os::unix::fs::PermissionsExt;std::fs::set_permissions(&directory,std::fs::Permissions::from_mode(0o700)).map_err(|_|failure("task_folder_missing","Private Task folder permissions unavailable"))?;}
    }
    Ok(())
}

#[cfg(all(feature="inference-fixtures",debug_assertions))]
#[derive(Clone)]
pub(super) struct TaskFixture {fail_before_sampling:bool,principal:PrincipalId,workspace:String,revision:u64,endpoint:String,certificate:Vec<u8>}
impl InquelloRequestProcessor {
    async fn task_fixture_matches(&self,connection:ConnectionId,actor:Actor,workspace:&str,config:&routes::RouteConfiguration,revision:u64)->bool {
        #[cfg(all(feature="inference-fixtures",debug_assertions))]
        {return self.task_fixtures.lock().await.get(&connection).is_some_and(|f|f.principal==actor.principal_id&&f.workspace==workspace&&f.revision==revision&&config.route_id()==routes::RouteId::ClaudeApiKey&&config.account_ref()==actor.principal_id.to_string());}
        #[cfg(not(all(feature="inference-fixtures",debug_assertions)))]
        {let _=(connection,actor,workspace,config,revision);false}
    }
    /// Test transport configuration only. Never creates work or returns a response
    /// pretending to be a model; the normal tasks/start path runs the retained turn.
    #[cfg(all(feature="inference-fixtures",debug_assertions))]
    pub(crate) async fn prepare_task_fixture(&self,connection:ConnectionId,raw:Option<serde_json::Value>)->Result<serde_json::Value,JSONRPCErrorError> {
        #[derive(serde::Deserialize)]
        #[serde(rename_all="camelCase",deny_unknown_fields)]
        struct Input {workspace_id:String,configuration_revision:u64,endpoint:String,certificate:Vec<u8>,#[serde(default)] fail_before_sampling:bool}
        let input:Input=serde_json::from_value(raw.ok_or_else(||refusal("fixture_unavailable","Missing fixture parameters"))?).map_err(|_|refusal("fixture_unavailable","Invalid fixture parameters"))?;
        if input.endpoint.len()>512||input.certificate.len()>8192 {return Err(refusal("fixture_unavailable","Fixture parameters exceed bounds"));}
        inquello_adapters::anthropic::MessagesClient::fixture_from_der(&input.endpoint,&input.certificate).map_err(|_|refusal("fixture_unavailable","Only pinned loopback TLS fixture is allowed"))?;
        let (store,actor)=self.context(connection).await?;
        self.task_session(connection,actor,&input.workspace_id).await?;
        let (_,candidate)=store.load_candidate_route(actor.principal_id,routes::RouteId::ClaudeApiKey).await.map_err(|e|domain_error(DomainError::Store(e)))?;
        let candidate=candidate.filter(|c|c.revision.get()==input.configuration_revision&&c.configuration.account_ref()==actor.principal_id.to_string()).ok_or_else(||refusal("fixture_unavailable","Explicit current fixture route required"))?;
        let mut state=self.routes.state.lock().await;
        if state.credential(actor.principal_id,&candidate.configuration).is_some() || state.generations.contains_key(&(actor.principal_id,routes::RouteId::ClaudeApiKey)) || self.routes.responses.as_ref().and_then(|r|r.provider.auth_manager()).and_then(|a|a.auth_cached()).is_some() {return Err(refusal("fixture_unavailable","Fixture refuses coexistence with provider credentials"));}
        self.routes.auth.install(inquello_adapters::anthropic::AuthScope {principal_id:actor.principal_id.to_string(),route_id:"claude-api-key".into(),account_ref:actor.principal_id.to_string(),generation:1},"sk-ant-synthetic-fixture-only".into()).map_err(|_|refusal("fixture_unavailable","Fixture credential installation refused"))?;
        state.credentials.insert((actor.principal_id,routes::RouteId::ClaudeApiKey),(actor.principal_id.to_string(),1));
        state.generations.insert((actor.principal_id,routes::RouteId::ClaudeApiKey),1);
        self.task_fixtures.lock().await.insert(connection,TaskFixture {fail_before_sampling:input.fail_before_sampling,principal:actor.principal_id,workspace:input.workspace_id,revision:input.configuration_revision,endpoint:input.endpoint,certificate:input.certificate});
        Ok(json!({"accepted":true,"providerCalls":0}))
    }
}

#[cfg(test)]
mod accounting_lifecycle_tests {
    use super::*;
    use inquello_domain::Revision;
    use inquello_protocol::inference::{Binding,Event,EventKind,StopReason};
    #[tokio::test]
    async fn undispatched_attempts_close_and_provider_completion_never_finishes_the_turn() {
        let dir=tempfile::tempdir().unwrap();let store=SqliteWorkingStore::open(&dir.path().join("work.db"),&[]).await.unwrap();
        let actor=Actor {principal_id:PrincipalId::parse("11111111-1111-4111-8111-111111111111").unwrap()};
        routes::configure_route(&store,&SystemClock,actor,routes::ConfigureRoute {operation_id:uuid::Uuid::new_v4().to_string(),expected_revision:Revision::ZERO,configuration:routes::RouteConfigurationInput {route_id:"claude-api-key".into(),deployment:"anthropic-direct".into(),model:routes::CLAUDE_MODEL.into(),api_version:routes::CLAUDE_API_VERSION.into(),account_ref:actor.principal_id.to_string(),region:None}}).await.unwrap();
        let intent=StartTaskIntent {operation_id:uuid::Uuid::new_v4().to_string(),workspace_id:"5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e".into(),engagement_id:None,folder_id:None,request:"Review fictional R01.".into(),route_id:"claude-api-key".into(),configuration_revision:1,choices:usage::Choices::default()};
        let run=store.reserve_task_run(actor.principal_id,intent,"runtime",1).await.unwrap();
        store.bind_task_thread(actor.principal_id,&run.operation_id,"runtime",&uuid::Uuid::new_v4().to_string()).await.unwrap();
        store.claim_task_dispatch(actor.principal_id,&run.operation_id,"runtime").await.unwrap();
        let turn=uuid::Uuid::new_v4().to_string();
        store.mark_task_run(actor.principal_id,&run.operation_id,TaskRunStatus::Running,Some(&turn)).await.unwrap();
        for (index,kind) in [usage::OperationKind::HumanRequestedModel,usage::OperationKind::LocalTool,usage::OperationKind::HumanRequestedModel,usage::OperationKind::HumanRequestedModel,usage::OperationKind::HumanRequestedModel,usage::OperationKind::HumanRequestedModel].into_iter().enumerate() {
            let id=uuid::Uuid::new_v4().to_string();let token=CancellationToken::new();
            store.begin_usage_attempt(usage::AttemptSnapshot {attempt_id:id.clone(),task_id:run.task_id.clone(),principal_id:actor.principal_id.to_string(),run_id:run.run_id.clone(),runtime_id:"runtime".into(),operation_kind:kind,route_id:Some(run.route_id.clone()),model:Some(routes::CLAUDE_MODEL.into()),api_version:Some(routes::CLAUDE_API_VERSION.into()),configuration_revision:1,route_revision:1,settings_revision:1,requested:run.choices.clone(),effective:run.choices.clone(),started_at_ms:1}).await.unwrap();
            if index<2 {
                finish_undispatched_attempt(&store,actor,&run.task_id,&id,&token).await;
            } else {
                let binding=Binding {schema_version:1,principal_id:actor.principal_id.to_string(),task_id:run.task_id.clone(),run_id:run.run_id.clone(),turn_id:turn.clone(),attempt_id:id.clone(),route_id:run.route_id.clone(),model:routes::CLAUDE_MODEL.into(),api_version:routes::CLAUDE_API_VERSION.into(),account_ref:actor.principal_id.to_string(),authority_basis:run.operation_id.clone(),authority_epoch:1,policy_revision:1,route_revision:1,credential_generation:1};
                let (sender,receiver)=tokio::sync::mpsc::channel(4);
                if index==2 {
                    for (sequence,event) in [EventKind::Started,EventKind::Completed {reason:StopReason::EndTurn,provider_reason:None}].into_iter().enumerate() {
                        sender.send(Event {binding:binding.clone(),sequence:sequence as u64,provider_request_id:None,provider_message_id:None,event}).await.unwrap();
                    }
                }
                if index>=4 {
                    let mut events=vec![EventKind::Started,EventKind::UsageUpdate {usage:inquello_protocol::inference::Usage {
                        input_tokens:Some(17),output_tokens:Some(9),cache_read_tokens:None,cache_write_tokens:None,
                        cost_microunits:None,currency:None,origin:Some("provider".into()),
                    }}];
                    if index==4 {events.push(EventKind::Completed {reason:StopReason::EndTurn,provider_reason:None});}
                    for (sequence,event) in events.into_iter().enumerate() {
                        sender.send(Event {binding:binding.clone(),sequence:sequence as u64,provider_request_id:None,provider_message_id:None,event}).await.unwrap();
                    }
                    token.cancel(); // All evidence was queued before revocation.
                }
                drop(sender); // No events must not be interpreted as a successful turn.
                record_attempt(store.clone(),actor,run.clone(),binding,receiver,token).await;
            }
            let usage=store.read_usage(actor.principal_id,TaskId::parse(&run.task_id).unwrap()).await.unwrap();
            let attempt=usage.attempts.iter().find(|a|a.snapshot.attempt_id==id).unwrap();
            assert_eq!(attempt.status,if index<2 {usage::AttemptStatus::Failed}else if index==2 || index==4 {usage::AttemptStatus::Completed}else if index==5 {usage::AttemptStatus::Cancelled}else{usage::AttemptStatus::Uncertain});
            assert!(attempt.ended_at_ms.is_some());
            if index>=4 {assert_eq!(attempt.usage.input_tokens,Some(17));assert_eq!(attempt.usage.output_tokens,Some(9));}
            assert_eq!(store.find_task_run(actor.principal_id,&run.operation_id).await.unwrap().unwrap().status,TaskRunStatus::Running);
        }
    }
}


