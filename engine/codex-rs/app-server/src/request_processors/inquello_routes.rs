//! Bound-principal route commands. Private auth has no durable representation.
use super::*;
use codex_app_server_protocol::*;
use inquello_adapters::anthropic::AuthScope;
use inquello_domain::routes::{self, DataTier, RouteId, RouteStore};
use sha2::{Digest, Sha256};
use std::result::Result;

fn model_choices(mut names: Vec<String>) -> (String, Vec<(String, RouteId, String)>) {
    names.sort();
    names.dedup();
    names.truncate(128);
    let choices = names
        .into_iter()
        .map(|name| (RouteId::CodexResponses, name))
        .chain(std::iter::once((
            RouteId::ClaudeApiKey,
            routes::CLAUDE_MODEL.into(),
        )))
        .map(|(route, name)| {
            let id = format!(
                "{:x}",
                Sha256::digest(format!("model-choice-v1|{}|{name}", route.as_str()))
            );
            (id, route, name)
        })
        .collect::<Vec<_>>();
    let version = format!(
        "{:x}",
        Sha256::digest(
            choices
                .iter()
                .map(|(id, _, _)| id.as_str())
                .collect::<Vec<_>>()
                .join("|")
        )
    );
    (version, choices)
}

fn binding_view(
    binding: &routes::ModelBinding,
    state: &reviewer::ReviewState,
    principal: PrincipalId,
) -> InquelloModelBindingView {
    let config = &binding.candidate.configuration;
    let credential = state.credential(principal, config).is_some();
    let eligibility =
        routes::route_eligibility(Some(config), credential, true, DataTier::Synthetic);
    let active = binding.state == routes::ModelBindingState::Active;
    InquelloModelBindingView {
        binding_id: binding.binding_id.clone(),
        provider: config.route_id().provider().into(),
        name: config.model().into(),
        route_id: config.route_id().as_str().into(),
        configuration_revision: binding.candidate.revision.get(),
        state: binding.state.as_str().into(),
        state_revision: binding.revision.get(),
        account_access: "unknown".into(),
        qualification: match eligibility.verification {
            routes::RouteVerification::NotVerified => "unqualified",
            routes::RouteVerification::VerifiedForSynthetic => "synthetic-only",
            routes::RouteVerification::VerifiedForRealData => "requires-fresh-policy",
        }
        .into(),
        available: active && eligibility.enabled,
        reason: match binding.state {
            routes::ModelBindingState::Revoked => Some("This saved model was revoked. Choose another model.".into()),
            routes::ModelBindingState::LegacySuperseded => Some("This saved model needs revalidation. Revalidate it in Settings before using it.".into()),
            routes::ModelBindingState::Active if eligibility.enabled => None,
            routes::ModelBindingState::Active if !credential => Some(format!("Connect {} to use this saved model.", config.route_id().provider())),
            routes::ModelBindingState::Active => Some("This saved model is not qualified for the current work. Review its availability in Settings.".into()),
        },
    }
}

impl InquelloRequestProcessor {
    pub(crate) fn scope_task_output_fence(
        &self,
        fence: codex_app_server_transport::PrivateOutputFence,
        principal: PrincipalId,
        task: &str,
    ) -> codex_app_server_transport::PrivateOutputFence {
        fence.with_token(self.routes.task_disclosure_token(principal, task))
    }
    #[expect(
        clippy::await_holding_invalid_type,
        reason = "Serialize the trusted cached state and local SQLite read/commit with invalidation; these guarded operations perform no provider or service network I/O."
    )]
    pub(crate) async fn models_catalog(
        &self,
        connection: ConnectionId,
        names: Vec<String>,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection).await?;
        let bindings = store
            .list_model_bindings(actor.principal_id)
            .await
            .map_err(|e| domain_error(DomainError::Store(e)))?;
        let (catalog_version, models) = model_choices(names);
        let state = self.routes.state.lock().await;
        let mut views = Vec::new();
        for binding in bindings.iter().take(1024) {
            let mut view = binding_view(binding, &state, actor.principal_id);
            if state
                .credential(actor.principal_id, &binding.candidate.configuration)
                .is_some()
                && self
                    .synthetic_binding_available(connection, actor, binding)
                    .await
            {
                view.available = true;
                view.reason = None;
                view.qualification = "synthetic-only".into();
                view.account_access = "fictional-fixture".into();
            }
            views.push(view);
        }
        Ok(Some(
            InquelloModelsCatalogResponse {
                catalog_version,
                choices: models
                    .into_iter()
                    .map(|(choice_id, route, name)| InquelloModelChoice {
                        choice_id,
                        provider: route.provider().into(),
                        name,
                        account_access: "unknown".into(),
                        qualification:
                            "Exact binding, current credentials and fresh policy required".into(),
                    })
                    .collect(),
                bindings: views,
            }
            .into(),
        ))
    }

    pub(crate) async fn model_resolve_replay(
        &self,
        connection: ConnectionId,
        params: &InquelloModelResolveParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection).await?;
        let operation_id =
            inquello_domain::OperationId::parse(&params.operation_id).map_err(domain_error)?;
        if let Some(receipt) = store
            .find_candidate_route_receipt(&operation_id)
            .await
            .map_err(|e| domain_error(DomainError::Store(e)))?
        {
            let request: serde_json::Value = serde_json::from_str(&receipt.request)
                .map_err(|_| refusal("invalid", "Recorded model operation unavailable"))?;
            if receipt.principal_id != actor.principal_id
                || receipt.command != routes::RESOLVE_MODEL_BINDING_COMMAND
                || request["catalog_version"].as_str() != Some(params.catalog_version.as_str())
                || request["choice_id"].as_str() != Some(params.choice_id.as_str())
            {
                return Err(domain_error(DomainError::OperationConflict {
                    operation_id,
                }));
            }
            let binding = store
                .load_configuration_binding(
                    actor.principal_id,
                    receipt.route_id,
                    receipt.resulting_revision,
                )
                .await
                .map_err(|e| domain_error(DomainError::Store(e)))?
                .ok_or_else(|| refusal("invalid", "Recorded model binding unavailable"))?;
            let state = self.routes.state.lock().await;
            return Ok(Some(
                InquelloModelBindingResponse {
                    affected_task_ids: Vec::new(),
                    binding: binding_view(&binding, &state, actor.principal_id),
                    receipt: InquelloReceipt {
                        operation_id: receipt.operation_id.to_string(),
                        command: receipt.command,
                        expected_revision: receipt.expected_revision.get(),
                        resulting_revision: receipt.resulting_revision.get(),
                        replayed: true,
                    },
                }
                .into(),
            ));
        }
        Ok(None)
    }

    #[expect(
        clippy::await_holding_invalid_type,
        reason = "Serialize the trusted cached state and local SQLite read/commit with invalidation; these guarded operations perform no provider or service network I/O."
    )]
    pub(crate) async fn model_resolve(
        &self,
        connection: ConnectionId,
        params: InquelloModelResolveParams,
        names: Vec<String>,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        if let Some(response) = self.model_resolve_replay(connection, &params).await? {
            return Ok(Some(response));
        }
        let (store, actor) = self.context(connection).await?;
        let (version, choices) = model_choices(names);
        if params.catalog_version.len() != 64
            || params.catalog_version != version
            || params.choice_id.len() != 64
        {
            return Err(refusal(
                "catalog_changed",
                "Cached model catalog changed; choose a supported model again",
            ));
        }
        let (_, route, model) = choices
            .into_iter()
            .find(|(id, _, _)| id == &params.choice_id)
            .ok_or_else(|| refusal("invalid", "Unknown supported model choice"))?;
        let state = self.routes.state.lock().await;
        let (account_ref, _) = state
            .credentials
            .get(&(actor.principal_id, route))
            .ok_or_else(|| {
                refusal(
                    "credential_unavailable",
                    "Connect this provider before choosing its model",
                )
            })?;
        let deployment = match route {
            RouteId::ClaudeApiKey => "anthropic-direct",
            RouteId::CodexResponses => {
                let inherited = self
                    .routes
                    .responses
                    .as_ref()
                    .ok_or_else(|| refusal("credential_unavailable", "Provider unavailable"))?;
                let auth = inherited
                    .auth_binding()
                    .map_err(|_| refusal("credential_unavailable", "Provider unavailable"))?;
                if auth.mode == codex_protocol::auth::AuthMode::ApiKey {
                    "openai-api"
                } else {
                    "chatgpt-codex"
                }
            }
        };
        let operation_id =
            inquello_domain::OperationId::parse(&params.operation_id).map_err(domain_error)?;
        let receipt = store
            .find_candidate_route_receipt(&operation_id)
            .await
            .map_err(|e| domain_error(DomainError::Store(e)))?;
        let expected_revision = if let Some(receipt) = receipt {
            receipt.expected_revision
        } else {
            store
                .load_candidate_route(actor.principal_id, route)
                .await
                .map_err(|e| domain_error(DomainError::Store(e)))?
                .0
        };
        let outcome = routes::resolve_model_binding(
            &store,
            &SystemClock,
            actor,
            routes::ConfigureRoute {
                operation_id: params.operation_id,
                expected_revision,
                configuration: routes::RouteConfigurationInput {
                    route_id: route.as_str().into(),
                    deployment: deployment.into(),
                    model,
                    api_version: if route == RouteId::ClaudeApiKey {
                        routes::CLAUDE_API_VERSION
                    } else {
                        "responses-v1"
                    }
                    .into(),
                    account_ref: account_ref.clone(),
                    region: None,
                },
            },
            &params.catalog_version,
            &params.choice_id,
        )
        .await
        .map_err(domain_error)?;
        let binding = store
            .load_configuration_binding(actor.principal_id, route, outcome.record.revision)
            .await
            .map_err(|e| domain_error(DomainError::Store(e)))?
            .ok_or_else(|| refusal("invalid", "Model binding unavailable"))?;
        Ok(Some(
            InquelloModelBindingResponse {
                affected_task_ids: Vec::new(),
                binding: binding_view(&binding, &state, actor.principal_id),
                receipt: InquelloReceipt {
                    operation_id: outcome.receipt.operation_id.to_string(),
                    command: routes::RESOLVE_MODEL_BINDING_COMMAND.into(),
                    expected_revision: outcome.receipt.expected_revision.get(),
                    resulting_revision: outcome.receipt.resulting_revision.get(),
                    replayed: outcome.replayed,
                },
            }
            .into(),
        ))
    }

    #[expect(
        clippy::await_holding_invalid_type,
        reason = "Serialize the trusted cached state and local SQLite read/commit with invalidation; these guarded operations perform no provider or service network I/O."
    )]
    pub(crate) async fn model_binding_state(
        &self,
        connection: ConnectionId,
        params: InquelloModelBindingStateParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection).await?;
        let mut state = self.routes.state.lock().await;
        let binding = store
            .load_model_binding(actor.principal_id, &params.binding_id)
            .await
            .map_err(|e| domain_error(DomainError::Store(e)))?
            .ok_or_else(|| refusal("not_found", "Model binding unavailable"))?;
        let command = match params.state.as_str() {
            "active" => routes::REVALIDATE_MODEL_BINDING_COMMAND,
            "revoked" => routes::REVOKE_MODEL_BINDING_COMMAND,
            _ => return Err(refusal("invalid", "Unsupported binding state")),
        };
        let operation_id =
            inquello_domain::OperationId::parse(&params.operation_id).map_err(domain_error)?;
        let recorded = store
            .find_model_binding_receipt(&operation_id, command)
            .await
            .map_err(|e| domain_error(DomainError::Store(e)))?
            .is_some();
        let target = match params.state.as_str() {
            "revoked" => routes::ModelBindingState::Revoked,
            "active" => {
                let config = &binding.candidate.configuration;
                if !recorded
                    && (state.credential(actor.principal_id, config).is_none()
                        || !routes::route_eligibility(
                            Some(config),
                            true,
                            true,
                            DataTier::Synthetic,
                        )
                        .enabled)
                {
                    return Err(refusal(
                        "route_unavailable",
                        "This exact saved model requires trusted credentials and passing qualification before revalidation",
                    ));
                }
                if !recorded && config.route_id() == RouteId::CodexResponses {
                    self.routes
                        .responses
                        .as_ref()
                        .ok_or_else(|| refusal("route_unavailable", "Provider unavailable"))?
                        .check_configuration(config)
                        .map_err(|_| {
                            refusal(
                                "route_unavailable",
                                "Saved model provider account or deployment changed",
                            )
                        })?;
                }
                routes::ModelBindingState::Active
            }
            _ => return Err(refusal("invalid", "Unsupported binding state")),
        };
        let outcome = routes::change_model_binding_state(
            &store,
            &SystemClock,
            actor,
            &params.operation_id,
            &params.binding_id,
            Revision::new(params.expected_revision),
            target,
        )
        .await
        .map_err(domain_error)?;
        let tasks = store
            .tasks_for_model_binding(
                actor.principal_id,
                binding.candidate.configuration.route_id(),
                binding.candidate.revision,
            )
            .await
            .map_err(|e| domain_error(DomainError::Store(e)))?;
        if !outcome.replayed && target == routes::ModelBindingState::Revoked {
            for task in &tasks {
                self.routes
                    .cancel_task(&mut state, actor.principal_id, &task.to_string());
            }
        }
        Ok(Some(
            InquelloModelBindingResponse {
                affected_task_ids: tasks.iter().take(1024).map(ToString::to_string).collect(),
                binding: binding_view(&outcome.binding, &state, actor.principal_id),
                receipt: InquelloReceipt {
                    operation_id: outcome.receipt.operation_id.to_string(),
                    command: outcome.receipt.command,
                    expected_revision: outcome.receipt.expected_revision.get(),
                    resulting_revision: outcome.receipt.resulting_revision.get(),
                    replayed: outcome.replayed,
                },
            }
            .into(),
        ))
    }

    pub(crate) async fn model_select(
        &self,
        connection: ConnectionId,
        params: InquelloModelSelectParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection).await?;
        routes::task_route(&store, actor, &params.task_id)
            .await
            .map_err(domain_error)?;
        let binding = store
            .load_model_binding(actor.principal_id, &params.binding_id)
            .await
            .map_err(|e| domain_error(DomainError::Store(e)))?
            .ok_or_else(|| refusal("not_found", "Saved model binding is unavailable"))?;
        self.task_route_set(
            connection,
            InquelloTaskRouteSetParams {
                operation_id: params.operation_id,
                task_id: params.task_id,
                expected_revision: params.expected_revision,
                route_id: binding.candidate.configuration.route_id().as_str().into(),
                configuration_revision: binding.candidate.revision.get(),
            },
        )
        .await
    }
    pub(crate) fn with_route_provider(
        mut self,
        info: codex_model_provider_info::ModelProviderInfo,
        auth: std::sync::Arc<codex_login::AuthManager>,
        factory: codex_http_client::HttpClientFactory,
    ) -> Self {
        self.routes.responses = Some(reviewer::InheritedResponses {
            provider: codex_model_provider::create_model_provider(info, Some(auth)),
            factory,
        });
        self
    }

    #[expect(
        clippy::await_holding_invalid_type,
        reason = "Serialize the trusted cached state and local SQLite read/commit with invalidation; these guarded operations perform no provider or service network I/O."
    )]
    pub(crate) async fn routes_list(
        &self,
        connection: ConnectionId,
        _: InquelloRoutesListParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let state = self.routes.state.lock().await;
        let (store, actor) = self.context(connection).await?;
        let candidates = routes::candidate_routes(&store, actor)
            .await
            .map_err(domain_error)?;
        let mut views = Vec::new();
        for candidate in routes::route_catalog() {
            let configured = candidates
                .iter()
                .find(|record| record.configuration.route_id().as_str() == candidate.id);
            let credential = configured.is_some_and(|record| {
                state
                    .credential(actor.principal_id, &record.configuration)
                    .is_some()
            });
            views.push(route_view(
                &candidate,
                configured.map(|r| &r.configuration),
                configured.map_or(0, |r| r.revision.get()),
                credential,
            ));
        }
        Ok(Some(InquelloRoutesListResponse { routes: views }.into()))
    }

    #[expect(
        clippy::await_holding_invalid_type,
        reason = "Serialize the trusted cached state and local SQLite read/commit with invalidation; these guarded operations perform no provider or service network I/O."
    )]
    pub(crate) async fn route_configure(
        &self,
        connection: ConnectionId,
        params: InquelloRouteConfigureParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let state = self.routes.state.lock().await;
        let (store, actor) = self.context(connection).await?;
        let input = params.configuration;
        let outcome = routes::configure_route(
            &store,
            &SystemClock,
            actor,
            routes::ConfigureRoute {
                operation_id: params.operation_id,
                expected_revision: Revision::new(params.expected_revision),
                configuration: routes::RouteConfigurationInput {
                    route_id: input.route_id,
                    deployment: input.deployment,
                    model: input.model,
                    api_version: input.api_version,
                    account_ref: input.account_ref,
                    region: input.region,
                },
            },
        )
        .await
        .map_err(domain_error)?;
        // Creating an immutable binding does not revoke other conversations.
        let candidate = routes::route_catalog()
            .into_iter()
            .find(|r| r.id == outcome.record.configuration.route_id().as_str())
            .ok_or_else(|| refusal("invalid", "Unknown processing route"))?;
        let view = route_view(
            &candidate,
            Some(&outcome.record.configuration),
            outcome.record.revision.get(),
            state
                .credential(actor.principal_id, &outcome.record.configuration)
                .is_some(),
        );
        Ok(Some(
            InquelloRouteConfigureResponse {
                route: view,
                receipt: InquelloReceipt {
                    operation_id: outcome.receipt.operation_id.to_string(),
                    command: routes::CONFIGURE_ROUTE_COMMAND.into(),
                    expected_revision: outcome.receipt.expected_revision.get(),
                    resulting_revision: outcome.receipt.resulting_revision.get(),
                    replayed: outcome.replayed,
                },
            }
            .into(),
        ))
    }

    #[expect(
        clippy::await_holding_invalid_type,
        reason = "Serialize the trusted cached state and local SQLite read/commit with invalidation; these guarded operations perform no provider or service network I/O."
    )]
    pub(crate) async fn task_route_read(
        &self,
        connection: ConnectionId,
        params: InquelloTaskRouteReadParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let state = self.routes.state.lock().await;
        let (store, actor) = self.context(connection).await?;
        let task = routes::task_route(&store, actor, &params.task_id)
            .await
            .map_err(domain_error)?;
        Ok(Some(
            task_view(
                &task,
                &state,
                actor.principal_id,
                None,
                task_disclosure_bindings(&store, actor, &task).await?,
            )
            .into(),
        ))
    }

    #[expect(
        clippy::await_holding_invalid_type,
        reason = "Serialize the trusted cached state and local SQLite read/commit with invalidation; these guarded operations perform no provider or service network I/O."
    )]
    pub(crate) async fn task_route_set(
        &self,
        connection: ConnectionId,
        params: InquelloTaskRouteSetParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let mut state = self.routes.state.lock().await;
        let (store, actor) = self.context(connection).await?;
        routes::task_route(&store, actor, &params.task_id)
            .await
            .map_err(domain_error)?;
        let operation_id =
            inquello_domain::OperationId::parse(&params.operation_id).map_err(domain_error)?;
        if state.task_review_pending(actor.principal_id, &params.task_id)
            && store
                .find_route_receipt(&operation_id)
                .await
                .map_err(|e| domain_error(DomainError::Store(e)))?
                .is_none()
        {
            return Err(refusal(
                "pending_work",
                "Finish pending permission review before changing this conversation model",
            ));
        }
        let outcome = routes::set_task_route(
            &store,
            &SystemClock,
            actor,
            routes::SetTaskRoute {
                operation_id: params.operation_id,
                expected_revision: Revision::new(params.expected_revision),
                task_id: params.task_id.clone(),
                route_id: params.route_id,
                configuration_revision: Revision::new(params.configuration_revision),
            },
        )
        .await
        .map_err(domain_error)?;
        if !outcome.replayed {
            self.routes
                .cancel_task(&mut state, actor.principal_id, &params.task_id);
        }
        let task = routes::task_route(&store, actor, &params.task_id)
            .await
            .map_err(domain_error)?;
        let receipt = InquelloReceipt {
            operation_id: outcome.receipt.operation_id.to_string(),
            command: routes::SET_TASK_ROUTE_COMMAND.into(),
            expected_revision: outcome.receipt.expected_revision.get(),
            resulting_revision: outcome.receipt.resulting_revision.get(),
            replayed: outcome.replayed,
        };
        Ok(Some(
            task_view(
                &task,
                &state,
                actor.principal_id,
                Some(receipt),
                task_disclosure_bindings(&store, actor, &task).await?,
            )
            .into(),
        ))
    }

    #[expect(
        clippy::await_holding_invalid_type,
        reason = "Serialize the trusted cached state and local SQLite read/commit with invalidation; these guarded operations perform no provider or service network I/O."
    )]
    pub(crate) async fn route_private_auth(
        &self,
        connection: ConnectionId,
        params: InquelloRoutePrivateAuthParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let mut state = self.routes.state.lock().await;
        let (_, actor) = self.context(connection).await?;
        let invalid = || refusal("invalid", "Invalid private provider handoff");
        let id = RouteId::parse(&params.route_id).ok_or_else(invalid)?;
        uuid::Uuid::parse_str(&params.account_ref).map_err(|_| invalid())?;
        let key = (actor.principal_id, id);
        if params.generation == 0
            || state
                .generations
                .get(&key)
                .is_some_and(|old| *old >= params.generation)
        {
            return Err(invalid());
        }
        if state.generations.len() >= 1024 && !state.generations.contains_key(&key) {
            return Err(invalid());
        }
        match id {
            RouteId::ClaudeApiKey => self
                .routes
                .auth
                .install(
                    AuthScope {
                        principal_id: actor.principal_id.to_string(),
                        route_id: params.route_id,
                        account_ref: params.account_ref.clone(),
                        generation: params.generation,
                    },
                    params.api_key.ok_or_else(invalid)?,
                )
                .map_err(|_| invalid())?,
            RouteId::CodexResponses => {
                if params.api_key.is_some() {
                    return Err(invalid());
                }
                let provider = self.routes.responses.as_ref().ok_or_else(invalid)?;
                provider.auth_binding().map_err(|_| invalid())?;
            }
        }
        self.routes
            .cancel_principal_reviews(&mut state, actor.principal_id);
        state.generations.insert(key, params.generation);
        state
            .credentials
            .insert(key, (params.account_ref, params.generation));
        Ok(Some(
            InquelloRoutePrivateAuthResponse { accepted: true }.into(),
        ))
    }

    #[expect(
        clippy::await_holding_invalid_type,
        reason = "Serialize the trusted cached state and local SQLite read/commit with invalidation; these guarded operations perform no provider or service network I/O."
    )]
    pub(crate) async fn routes_invalidate(
        &self,
        connection: ConnectionId,
        params: InquelloRoutesInvalidateParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let mut state = self.routes.state.lock().await;
        let (store, actor) = self.context(connection).await?;
        if params.task_id.is_some() && params.route_id.is_some() {
            return Err(refusal(
                "invalid",
                "Invalidate one Task or one provider route, not both",
            ));
        }
        if let Some(task) = params.task_id {
            routes::task_route(&store, actor, &task)
                .await
                .map_err(domain_error)?;
            self.routes
                .cancel_task(&mut state, actor.principal_id, &task);
        } else if let Some(route) = params.route_id {
            let id = RouteId::parse(&route)
                .ok_or_else(|| refusal("invalid", "Unknown processing route"))?;
            let key = (actor.principal_id, id);
            if state
                .generations
                .get(&key)
                .is_some_and(|old| params.generation < *old)
            {
                return Err(refusal("invalid", "Stale provider generation"));
            }
            self.routes
                .auth
                .invalidate(&actor.principal_id.to_string(), &route, params.generation)
                .map_err(|_| refusal("invalid", "Provider invalidation unavailable"))?;
            state.credentials.remove(&key);
            state.generations.insert(key, params.generation);
            self.routes
                .cancel_principal_reviews(&mut state, actor.principal_id);
        } else {
            self.routes
                .invalidate_principal(&mut state, actor.principal_id);
        }
        Ok(Some(
            InquelloRoutePrivateAuthResponse { accepted: true }.into(),
        ))
    }
}

fn config_view(config: &routes::RouteConfiguration) -> InquelloRouteConfiguration {
    InquelloRouteConfiguration {
        route_id: config.route_id().as_str().into(),
        deployment: config.deployment().into(),
        model: config.model().into(),
        api_version: config.api_version().into(),
        account_ref: config.account_ref().into(),
        region: config.region().map(str::to_string),
    }
}
fn route_view(
    candidate: &routes::RouteCandidate,
    configuration: Option<&routes::RouteConfiguration>,
    revision: u64,
    credential: bool,
) -> InquelloRouteView {
    let adapter = candidate.configurable;
    let eligibility =
        routes::route_eligibility(configuration, credential, adapter, DataTier::Synthetic);
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
async fn task_disclosure_bindings(
    store: &SqliteWorkingStore,
    actor: Actor,
    task: &routes::TaskRoute,
) -> Result<Vec<InquelloModelDisclosureBinding>, JSONRPCErrorError> {
    let refs = store
        .task_model_disclosure_bindings(actor.principal_id, task.task_id)
        .await
        .map_err(|error| domain_error(DomainError::Store(error)))?;
    bounded_disclosure_bindings(refs)
}
fn bounded_disclosure_bindings(
    refs: Vec<(RouteId, Revision, bool)>,
) -> Result<Vec<InquelloModelDisclosureBinding>, JSONRPCErrorError> {
    if refs.len() > 1024 {
        return Err(refusal(
            "dependencies_unavailable",
            "Retained model authority exceeds the bounded disclosure limit; protected content is unavailable",
        ));
    }
    Ok(refs
        .into_iter()
        .map(|(route, revision, active)| InquelloModelDisclosureBinding {
            route_id: route.as_str().into(),
            configuration_revision: revision.get(),
            active,
        })
        .collect())
}

fn task_view(
    task: &routes::TaskRoute,
    state: &reviewer::ReviewState,
    principal: PrincipalId,
    receipt: Option<InquelloReceipt>,
    disclosure_bindings: Vec<InquelloModelDisclosureBinding>,
) -> InquelloTaskRouteResponse {
    let selected = task.current.as_ref().and_then(|record| {
        routes::route_catalog().into_iter().find(|candidate| candidate.id == record.configuration.route_id().as_str()).map(|candidate| {
            let mut view = route_view(&candidate, Some(&record.configuration), record.configuration_revision.get(), state.credential(principal, &record.configuration).is_some());
            if task.stale_configuration { view.enabled = false; view.gate = Some("Route configuration changed; explicitly select the current candidate again".into()); }
            view
        })
    });
    InquelloTaskRouteResponse {
        disclosure_bindings,
        task_id: task.task_id.to_string(),
        workspace_id: task.workspace_id.to_string(),
        revision: task.revision.get(),
        configuration_revision: task
            .current
            .as_ref()
            .map(|r| r.configuration_revision.get()),
        stale_configuration: task.stale_configuration,
        selected,
        receipt,
    }
}

#[cfg(test)]
mod model_binding_tests {
    use super::*;
    use inquello_domain::organise::{CreateTask, OrganiseRecord, create_task};
    use tokio_util::sync::CancellationToken;

    #[test]
    fn inquello_disclosure_dependencies_are_complete_or_refused_at_the_bound() {
        let refs = (1..=1024)
            .map(|n| (RouteId::CodexResponses, Revision::new(n), n != 1))
            .collect::<Vec<_>>();
        let projected = bounded_disclosure_bindings(refs.clone()).unwrap();
        assert_eq!(projected.len(), 1024);
        assert!(!projected[0].active);
        let mut overflow = refs;
        overflow.push((RouteId::CodexResponses, Revision::new(1025), true));
        assert!(
            bounded_disclosure_bindings(overflow).is_err(),
            "never silently drop historical disclosure authority"
        );
    }
    const CONNECTION: ConnectionId = ConnectionId(1221);
    const PRINCIPAL: &str = "11111111-1111-4111-8111-111111111111";
    async fn setup() -> (tempfile::TempDir, InquelloRequestProcessor, Actor) {
        let dir = tempfile::tempdir().unwrap();
        let processor = InquelloRequestProcessor::with_store_path(
            Some(dir.path().join("working.sqlite")),
            vec![],
        );
        processor
            .set_principal(
                CONNECTION,
                InquelloSetPrincipalParams {
                    principal_id: Some(PRINCIPAL.into()),
                },
            )
            .await
            .unwrap();
        let actor = processor.actor(CONNECTION).unwrap();
        (dir, processor, actor)
    }

    async fn configure(processor: &InquelloRequestProcessor, revision: u64, model: &str) {
        processor.route_configure(CONNECTION, serde_json::from_value(serde_json::json!({"operationId":uuid::Uuid::new_v4().to_string(),"expectedRevision":revision,"configuration":{"routeId":"codex-responses","deployment":"openai-api","model":model,"apiVersion":"responses-v1","accountRef":PRINCIPAL,"region":null}})).unwrap()).await.unwrap();
    }

    async fn create_bound_task(
        processor: &InquelloRequestProcessor,
        actor: Actor,
        revision: u64,
    ) -> String {
        let (store, _) = processor.context(CONNECTION).await.unwrap();
        let task = create_task(
            &store,
            &SystemClock,
            actor,
            CreateTask {
                operation_id: uuid::Uuid::new_v4().to_string(),
                expected_revision: Revision::ZERO,
                workspace_id: "5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e".into(),
                engagement_id: None,
                folder_id: None,
                title: "Fictional model binding task".into(),
            },
        )
        .await
        .unwrap();
        let OrganiseRecord::Task(task) = task.record else {
            panic!("Task required")
        };
        routes::set_task_route(
            &store,
            &SystemClock,
            actor,
            routes::SetTaskRoute {
                operation_id: uuid::Uuid::new_v4().to_string(),
                expected_revision: Revision::ZERO,
                task_id: task.task_id.to_string(),
                route_id: "codex-responses".into(),
                configuration_revision: Revision::new(revision),
            },
        )
        .await
        .unwrap();
        task.task_id.to_string()
    }

    #[tokio::test]
    async fn inquello_same_provider_creation_preserves_a_and_revoke_fences_only_exact_dependents() {
        let (_dir, processor, actor) = setup().await;
        configure(&processor, 0, "gpt-6.1-terra").await;
        let a = create_bound_task(&processor, actor, 1).await;
        let token_a = CancellationToken::new();
        processor
            .register_task_cancellation(actor.principal_id, &a, token_a.clone())
            .await;
        let fence_a = processor
            .routes
            .disclosure_fence(actor.principal_id)
            .with_token(
                processor
                    .routes
                    .task_disclosure_token(actor.principal_id, &a),
            );
        configure(&processor, 1, "gpt-6.1-sol").await;
        let b = create_bound_task(&processor, actor, 2).await;
        let token_b = CancellationToken::new();
        processor
            .register_task_cancellation(actor.principal_id, &b, token_b.clone())
            .await;
        let fence_b = processor
            .routes
            .disclosure_fence(actor.principal_id)
            .with_token(
                processor
                    .routes
                    .task_disclosure_token(actor.principal_id, &b),
            );
        let (store, _) = processor.context(CONNECTION).await.unwrap();
        let selected = routes::task_route(&store, actor, &a).await.unwrap();
        assert!(!selected.stale_configuration);
        assert_eq!(
            selected.current.unwrap().configuration.model(),
            "gpt-6.1-terra"
        );
        assert!(!token_a.is_cancelled());
        assert!(fence_a.is_current());
        assert!(fence_b.is_current());
        let binding = store
            .load_configuration_binding(
                actor.principal_id,
                RouteId::CodexResponses,
                Revision::new(1),
            )
            .await
            .unwrap()
            .unwrap();
        processor
            .model_binding_state(
                CONNECTION,
                InquelloModelBindingStateParams {
                    operation_id: "scoped-revoke-a".into(),
                    binding_id: binding.binding_id,
                    expected_revision: 1,
                    state: "revoked".into(),
                },
            )
            .await
            .unwrap();
        assert!(token_a.is_cancelled());
        assert!(!fence_a.is_current());
        assert!(!token_b.is_cancelled());
        assert!(fence_b.is_current());
        assert!(
            !routes::task_route(&store, actor, &b)
                .await
                .unwrap()
                .stale_configuration
        );
    }

    #[tokio::test]
    async fn inquello_resolve_replays_after_credential_loss_and_catalog_change_without_new_configuration()
     {
        let (_dir, processor, actor) = setup().await;
        let names = vec!["gpt-6.1-terra".into(), "gpt-6.1-sol".into()];
        let (version, choices) = model_choices(names.clone());
        assert_eq!(choices.len(), 3);
        let choice = choices
            .iter()
            .find(|(_, route, _)| *route == RouteId::ClaudeApiKey)
            .unwrap()
            .0
            .clone();
        processor.routes.state.lock().await.credentials.insert(
            (actor.principal_id, RouteId::ClaudeApiKey),
            (PRINCIPAL.into(), 1),
        );
        let command = InquelloModelResolveParams {
            operation_id: "resolve-exact-model".into(),
            catalog_version: version,
            choice_id: choice,
        };
        processor
            .model_resolve(CONNECTION, command.clone(), names)
            .await
            .unwrap();
        processor.routes.state.lock().await.credentials.clear();
        processor
            .model_resolve(CONNECTION, command.clone(), vec![])
            .await
            .unwrap();
        let (store, _) = processor.context(CONNECTION).await.unwrap();
        assert_eq!(
            store
                .list_model_bindings(actor.principal_id)
                .await
                .unwrap()
                .len(),
            1
        );
        let mut conflicting = command;
        conflicting.catalog_version = "0".repeat(64);
        assert!(
            processor
                .model_resolve(CONNECTION, conflicting, vec![])
                .await
                .is_err()
        );
        assert!(serde_json::from_value::<InquelloModelResolveParams>(serde_json::json!({"operationId":"x","catalogVersion":"0".repeat(64),"choiceId":"1".repeat(64),"accountRef":PRINCIPAL})).is_err());
    }
}
