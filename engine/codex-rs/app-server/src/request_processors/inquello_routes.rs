//! Bound-principal route commands. Private auth has no durable representation.
use super::*;
use codex_app_server_protocol::*;
use inquello_domain::routes::{self, DataTier, RouteId, RouteStore};
use inquello_adapters::anthropic::AuthScope;

impl InquelloRequestProcessor {
    pub(crate) fn with_route_provider(mut self, info: codex_model_provider_info::ModelProviderInfo,
        auth: std::sync::Arc<codex_login::AuthManager>, factory: codex_http_client::HttpClientFactory) -> Self {
        self.routes.responses = Some(reviewer::InheritedResponses {
            provider: codex_model_provider::create_model_provider(info, Some(auth)), factory,
        });
        self
    }

    pub(crate) async fn routes_list(&self, connection: ConnectionId, _: InquelloRoutesListParams)
        -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let state = self.routes.state.lock().await;
        let (store, actor) = self.context(connection).await?;
        let candidates = routes::candidate_routes(&store, actor).await.map_err(domain_error)?;
        let mut views = Vec::new();
        for candidate in routes::route_catalog() {
            let configured = candidates.iter().find(|record| record.configuration.route_id().as_str() == candidate.id);
            let credential = configured.is_some_and(|record| state.credential(actor.principal_id, &record.configuration).is_some());
            views.push(route_view(&candidate, configured.map(|r| &r.configuration), configured.map_or(0, |r| r.revision.get()), credential));
        }
        Ok(Some(InquelloRoutesListResponse { routes: views }.into()))
    }

    pub(crate) async fn route_configure(&self, connection: ConnectionId, params: InquelloRouteConfigureParams)
        -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let mut state = self.routes.state.lock().await;
        let (store, actor) = self.context(connection).await?;
        let input = params.configuration;
        let outcome = routes::configure_route(&store, &SystemClock, actor, routes::ConfigureRoute {
            operation_id: params.operation_id, expected_revision: Revision::new(params.expected_revision),
            configuration: routes::RouteConfigurationInput { route_id: input.route_id, deployment: input.deployment,
                model: input.model, api_version: input.api_version, account_ref: input.account_ref, region: input.region },
        }).await.map_err(domain_error)?;
        // A candidate edit never upgrades Task selection; invalidate inference and continuation authority.
        if !outcome.replayed { self.routes.invalidate_principal(&mut state, actor.principal_id); }
        let candidate = routes::route_catalog().into_iter().find(|r| r.id == outcome.record.configuration.route_id().as_str())
            .ok_or_else(|| refusal("invalid", "Unknown processing route"))?;
        let view = route_view(&candidate, Some(&outcome.record.configuration), outcome.record.revision.get(),
            state.credential(actor.principal_id, &outcome.record.configuration).is_some());
        Ok(Some(InquelloRouteConfigureResponse { route: view, receipt: InquelloReceipt {
            operation_id: outcome.receipt.operation_id.to_string(), command: routes::CONFIGURE_ROUTE_COMMAND.into(),
            expected_revision: outcome.receipt.expected_revision.get(), resulting_revision: outcome.receipt.resulting_revision.get(), replayed: outcome.replayed,
        }}.into()))
    }

    pub(crate) async fn task_route_read(&self, connection: ConnectionId, params: InquelloTaskRouteReadParams)
        -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let state = self.routes.state.lock().await;
        let (store, actor) = self.context(connection).await?;
        let task = routes::task_route(&store, actor, &params.task_id).await.map_err(domain_error)?;
        Ok(Some(task_view(&task, &state, actor.principal_id, None).into()))
    }

    pub(crate) async fn task_route_set(&self, connection: ConnectionId, params: InquelloTaskRouteSetParams)
        -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let mut state = self.routes.state.lock().await;
        let (store, actor) = self.context(connection).await?;
        let outcome = routes::set_task_route(&store, &SystemClock, actor, routes::SetTaskRoute {
            operation_id: params.operation_id, expected_revision: Revision::new(params.expected_revision),
            task_id: params.task_id.clone(), route_id: params.route_id,
            configuration_revision: Revision::new(params.configuration_revision),
        }).await.map_err(domain_error)?;
        if !outcome.replayed { self.routes.cancel_task(&mut state, actor.principal_id, &params.task_id); }
        let task = routes::task_route(&store, actor, &params.task_id).await.map_err(domain_error)?;
        let receipt = InquelloReceipt { operation_id: outcome.receipt.operation_id.to_string(),
            command: routes::SET_TASK_ROUTE_COMMAND.into(), expected_revision: outcome.receipt.expected_revision.get(),
            resulting_revision: outcome.receipt.resulting_revision.get(), replayed: outcome.replayed };
        Ok(Some(task_view(&task, &state, actor.principal_id, Some(receipt)).into()))
    }

    pub(crate) async fn route_private_auth(&self, connection: ConnectionId, params: InquelloRoutePrivateAuthParams)
        -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let mut state = self.routes.state.lock().await;
        let (store, actor) = self.context(connection).await?;
        let invalid = || refusal("invalid", "Invalid private provider handoff");
        let id = RouteId::parse(&params.route_id).ok_or_else(invalid)?;
        let (_, candidate) = store.load_candidate_route(actor.principal_id, id).await.map_err(|e| domain_error(DomainError::Store(e)))?;
        let candidate = candidate.filter(|record| record.configuration.account_ref() == params.account_ref).ok_or_else(invalid)?;
        let key = (actor.principal_id, id);
        if params.generation == 0 || state.generations.get(&key).is_some_and(|old| *old >= params.generation) { return Err(invalid()); }
        if state.generations.len() >= 1024 && !state.generations.contains_key(&key) { return Err(invalid()); }
        match id {
            RouteId::ClaudeApiKey => self.routes.auth.install(AuthScope { principal_id: actor.principal_id.to_string(),
                route_id: params.route_id, account_ref: params.account_ref.clone(), generation: params.generation },
                params.api_key.ok_or_else(invalid)?).map_err(|_| invalid())?,
            RouteId::CodexResponses => {
                if params.api_key.is_some() { return Err(invalid()); }
                let provider = self.routes.responses.as_ref().ok_or_else(invalid)?;
                provider.check_configuration(&candidate.configuration).map_err(|_| invalid())?;
            }
        }
        self.routes.cancel_principal_reviews(&mut state, actor.principal_id);
        state.generations.insert(key, params.generation);
        state.credentials.insert(key, (params.account_ref, params.generation));
        Ok(Some(InquelloRoutePrivateAuthResponse { accepted: true }.into()))
    }

    pub(crate) async fn routes_invalidate(&self, connection: ConnectionId, params: InquelloRoutesInvalidateParams)
        -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let mut state = self.routes.state.lock().await;
        let (store, actor) = self.context(connection).await?;
        if params.task_id.is_some() && params.route_id.is_some() {
            return Err(refusal("invalid", "Invalidate one Task or one provider route, not both"));
        }
        if let Some(task) = params.task_id {
            routes::task_route(&store, actor, &task).await.map_err(domain_error)?;
            self.routes.cancel_task(&mut state, actor.principal_id, &task);
        } else if let Some(route) = params.route_id {
            let id = RouteId::parse(&route).ok_or_else(|| refusal("invalid", "Unknown processing route"))?;
            let key = (actor.principal_id, id);
            if state.generations.get(&key).is_some_and(|old| params.generation < *old) {
                return Err(refusal("invalid", "Stale provider generation"));
            }
            self.routes.auth.invalidate(&actor.principal_id.to_string(), &route, params.generation)
                .map_err(|_| refusal("invalid", "Provider invalidation unavailable"))?;
            state.credentials.remove(&key);
            state.generations.insert(key, params.generation);
            self.routes.cancel_principal_reviews(&mut state, actor.principal_id);
        } else {
            self.routes.invalidate_principal(&mut state, actor.principal_id);
        }
        Ok(Some(InquelloRoutePrivateAuthResponse { accepted: true }.into()))
    }
}

fn config_view(config: &routes::RouteConfiguration) -> InquelloRouteConfiguration {
    InquelloRouteConfiguration { route_id: config.route_id().as_str().into(), deployment: config.deployment().into(),
        model: config.model().into(), api_version: config.api_version().into(), account_ref: config.account_ref().into(), region: config.region().map(str::to_string) }
}
fn route_view(candidate: &routes::RouteCandidate, configuration: Option<&routes::RouteConfiguration>, revision: u64, credential: bool) -> InquelloRouteView {
    let adapter = candidate.configurable;
    let eligibility = routes::route_eligibility(configuration, credential, adapter, DataTier::Synthetic);
    InquelloRouteView { route_id: candidate.id.into(), provider: candidate.provider.into(), configurable: candidate.configurable,
        configuration: configuration.map(config_view), endpoint: configuration.map(|c| c.endpoint().into()), revision,
        credential_present: credential, adapter_supported: adapter, verification: match eligibility.verification {
            routes::RouteVerification::NotVerified => "not_verified", routes::RouteVerification::VerifiedForSynthetic => "verified_for_synthetic",
            routes::RouteVerification::VerifiedForRealData => "verified_for_real_data" }.into(),
        enabled: eligibility.enabled, gate: eligibility.gate.map(str::to_string), limits: vec![candidate.limit.into()], evidence: eligibility.evidence,
        execution_flow: "Task tools execute on this device under the existing sandbox and permission policy".into(),
        inference_flow: "Only this explicitly selected provider endpoint receives permitted inference content".into(),
        connector_flow: "Connector authentication and traffic are separate; selecting a route grants no connector authority".into() }
}
fn task_view(task: &routes::TaskRoute, state: &reviewer::ReviewState, principal: PrincipalId, receipt: Option<InquelloReceipt>) -> InquelloTaskRouteResponse {
    let selected = task.current.as_ref().and_then(|record| {
        routes::route_catalog().into_iter().find(|candidate| candidate.id == record.configuration.route_id().as_str()).map(|candidate| {
            let mut view = route_view(&candidate, Some(&record.configuration), record.configuration_revision.get(), state.credential(principal, &record.configuration).is_some());
            if task.stale_configuration { view.enabled = false; view.gate = Some("Route configuration changed; explicitly select the current candidate again".into()); }
            view
        })
    });
    InquelloTaskRouteResponse { task_id: task.task_id.to_string(), workspace_id: task.workspace_id.to_string(), revision: task.revision.get(),
        configuration_revision: task.current.as_ref().map(|r| r.configuration_revision.get()), stale_configuration: task.stale_configuration, selected, receipt }
}
