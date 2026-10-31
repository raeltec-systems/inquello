//! Inquello private Workspace organisation (Story 1.14) and Task states
//! (Story 1.15): the `inquello/*` methods over the Inquello working store.
//!
//! - The store path comes from `INQUELLO_WORKING_STORE`, which the desktop sets
//!   to `<userData>/working/working.sqlite`. `codex-app-server` takes the
//!   variable out of its own environment at startup
//!   ([`take_inquello_working_store_env`]), so no tool or child process the
//!   runtime starts inherits it. Without it every method answers
//!   `store_not_configured`.
//! - The store opens on the first call that needs it (and initializes its
//!   `store_info`), never at startup.
//! - The acting principal is bound per connection by
//!   `inquello/session/setPrincipal`, which only the desktop main process sends.
//!   No other payload names a principal. A call before a principal is bound is
//!   `unauthenticated`.
//! - Every mutation is an `inquello-domain` command with an operation ID and an
//!   expected revision; this module only translates the wire shapes.
//! - `inquello/state/record` takes its actor kind from the desktop main
//!   process. A `human` actor is always the bound principal; the payload never
//!   names one. The domain refuses `review` and `approval_marker` from any
//!   other actor and every dimension except `task` and `run` (Story 1.15).
//! - `inquello/policy/effective` (Story 1.18) combines the Workspace execution
//!   policy that main fetched from the shared service with this runtime's own
//!   managed requirements (`configRequirements/read`) and user configuration
//!   layer (`config/read`), which the dispatch reads and passes in. The domain
//!   computes the result; this module only translates shapes.
//! - `inquello/broadMode/read` and `inquello/broadMode/set` read and set a
//!   Task's broader execution mode for its creator. Setting re-validates the
//!   Workspace policy, checks it is the Task's own Workspace, and refuses a
//!   broader mode the effective policy does not permit
//!   (`broad_mode_not_permitted`, with the governing rule).
//! - Story 1.20: `inquello/tools/exec` evaluates the command against the
//!   Workspace command rules and the person's own rules, matched by the
//!   runtime's own exec-policy prefix matching. A forbidden command is
//!   refused (`command_forbidden`); a command that asks needs an allowed
//!   permission request for exactly that command (`permission_required`
//!   otherwise), used once. `inquello/permissions/request`, `pending` and
//!   `decide` hold those requests; `inquello/permissions/userRules/read` and
//!   `set` hold the person's own rules (prompt or forbid only). The
//!   automatic permission reviewer is mapped to the runtime's inherited
//!   `approvals_reviewer` setting, which stays `user` until a processing
//!   route exists.

use crate::error_code::INTERNAL_ERROR_CODE;
use crate::error_code::INVALID_REQUEST_ERROR_CODE;
use crate::outgoing_message::ConnectionId;
use codex_app_server_protocol::AskForApproval;
use codex_app_server_protocol::ClientResponsePayload;
use codex_app_server_protocol::CommandExecParams;
use codex_app_server_protocol::ConfigLayerSource;
use codex_app_server_protocol::ConfigReadResponse;
use codex_app_server_protocol::ConfigRequirementsReadResponse;
use codex_app_server_protocol::InquelloBroadModeReadParams;
use codex_app_server_protocol::InquelloBroadModeReadResponse;
use codex_app_server_protocol::InquelloBroadModeSetParams;
use codex_app_server_protocol::InquelloBroadModeSetResponse;
use codex_app_server_protocol::InquelloCapabilityContractEntry;
use codex_app_server_protocol::InquelloCommandEvaluation;
use codex_app_server_protocol::InquelloCommandRule;
use codex_app_server_protocol::InquelloCommandRuleView;
use codex_app_server_protocol::InquelloDeviceRequirements;
use codex_app_server_protocol::InquelloEngagement;
use codex_app_server_protocol::InquelloEngagementCreateParams;
use codex_app_server_protocol::InquelloEngagementResponse;
use codex_app_server_protocol::InquelloEngagementUpdateParams;
use codex_app_server_protocol::InquelloFolder;
use codex_app_server_protocol::InquelloFolderCreateParams;
use codex_app_server_protocol::InquelloFolderResponse;
use codex_app_server_protocol::InquelloKnownWorkspace;
use codex_app_server_protocol::InquelloPermissionDecision;
use codex_app_server_protocol::InquelloPermissionRequest;
use codex_app_server_protocol::InquelloPermissionReviewer;
use codex_app_server_protocol::InquelloPermissionsDecideParams;
use codex_app_server_protocol::InquelloPermissionsDecideResponse;
use codex_app_server_protocol::InquelloPermissionsPendingParams;
use codex_app_server_protocol::InquelloPermissionsPendingResponse;
use codex_app_server_protocol::InquelloPermissionsRequestParams;
use codex_app_server_protocol::InquelloPermissionsRequestResponse;
use codex_app_server_protocol::InquelloPolicyEffectiveParams;
use codex_app_server_protocol::InquelloPolicyEffectiveResponse;
use codex_app_server_protocol::InquelloPolicySetting;
use codex_app_server_protocol::InquelloPolicySource;
use codex_app_server_protocol::InquelloReceipt;
use codex_app_server_protocol::InquelloRuleSource;
use codex_app_server_protocol::InquelloRuntimeProfile;
use codex_app_server_protocol::InquelloSetPrincipalParams;
use codex_app_server_protocol::InquelloSetPrincipalResponse;
use codex_app_server_protocol::InquelloStateDimension;
use codex_app_server_protocol::InquelloStateListParams;
use codex_app_server_protocol::InquelloStateListResponse;
use codex_app_server_protocol::InquelloStateRecord;
use codex_app_server_protocol::InquelloStateRecordParams;
use codex_app_server_protocol::InquelloStateRecordResponse;
use codex_app_server_protocol::InquelloTask;
use codex_app_server_protocol::InquelloTaskAttachThreadParams;
use codex_app_server_protocol::InquelloTaskBroadMode;
use codex_app_server_protocol::InquelloTaskCreateParams;
use codex_app_server_protocol::InquelloTaskMoveParams;
use codex_app_server_protocol::InquelloTaskPolicy;
use codex_app_server_protocol::InquelloTaskRenameParams;
use codex_app_server_protocol::InquelloTaskResponse;
use codex_app_server_protocol::InquelloTaskVisibility;
use codex_app_server_protocol::InquelloThreadSettings;
use codex_app_server_protocol::InquelloToolBoundary;
use codex_app_server_protocol::InquelloToolReach;
use codex_app_server_protocol::InquelloToolsExecParams;
use codex_app_server_protocol::InquelloUserRulesReadResponse;
use codex_app_server_protocol::InquelloUserRulesSetParams;
use codex_app_server_protocol::InquelloUserRulesSetResponse;
use codex_app_server_protocol::InquelloWorkspaceExecutionPolicy;
use codex_app_server_protocol::InquelloWorkspaceListResponse;
use codex_app_server_protocol::InquelloWorkspaceRememberParams;
use codex_app_server_protocol::InquelloWorkspaceRememberResponse;
use codex_app_server_protocol::InquelloWorkspaceTreeParams;
use codex_app_server_protocol::InquelloWorkspaceTreeResponse;
use codex_app_server_protocol::JSONRPCErrorError;
use codex_app_server_protocol::SandboxMode;
use inquello_adapters::SqliteWorkingStore;
use inquello_adapters::SystemClock;
use inquello_domain::Clock;
use inquello_domain::DomainError;
use inquello_domain::InitializeStore;
use inquello_domain::Revision;
use inquello_domain::execution_policy;
use inquello_domain::execution_policy::ApprovalBehaviour;
use inquello_domain::execution_policy::BroadModeStatus;
use inquello_domain::execution_policy::CommandEvaluation;
use inquello_domain::execution_policy::CommandRule;
use inquello_domain::execution_policy::DeviceRequirements;
use inquello_domain::execution_policy::EffectivePolicy;
use inquello_domain::execution_policy::ExecutionPolicy;
use inquello_domain::execution_policy::RuleDecision;
use inquello_domain::execution_policy::RuleSource;
use inquello_domain::execution_policy::SandboxLevel;
use inquello_domain::execution_policy::Setting;
use inquello_domain::execution_policy::SettingSource;
use inquello_domain::execution_policy::SourcedRule;
use inquello_domain::execution_policy::TaskFolder;
use inquello_domain::execution_policy::ToolProfile;
use inquello_domain::execution_policy::ToolReach;
use inquello_domain::execution_policy::UserConfig;
use inquello_domain::execution_policy::WorkspaceLayer;
use inquello_domain::organise;
use inquello_domain::organise::Actor;
use inquello_domain::organise::OrganiseOutcome;
use inquello_domain::organise::OrganiseRecord;
use inquello_domain::organise::PrincipalId;
use inquello_domain::organise::TaskId;
use inquello_domain::organise::WorkspaceId;
use inquello_domain::state;
use inquello_domain::state::StateDimension;
use inquello_domain::state::StateWriter;
use serde_json::json;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::OnceLock;

/// The environment variable naming the working-store file.
pub const INQUELLO_WORKING_STORE_ENV_VAR: &str = "INQUELLO_WORKING_STORE";

static TAKEN_WORKING_STORE: OnceLock<Option<PathBuf>> = OnceLock::new();

/// Reads and removes `INQUELLO_WORKING_STORE` before worker threads start, so
/// nothing the runtime spawns (shells, tools, MCP servers) inherits the path.
pub fn take_inquello_working_store_env() {
    let path = std::env::var_os(INQUELLO_WORKING_STORE_ENV_VAR)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from);
    // SAFETY: app-server calls this synchronously at process startup, before spawning threads.
    unsafe { std::env::remove_var(INQUELLO_WORKING_STORE_ENV_VAR) };
    let _ = TAKEN_WORKING_STORE.set(path);
}

/// The configured store path: the value taken at startup or, for hosts that did
/// not take it (tests, other embedders), the current environment.
fn configured_store_path() -> Option<PathBuf> {
    match TAKEN_WORKING_STORE.get() {
        Some(taken) => taken.clone(),
        None => std::env::var_os(INQUELLO_WORKING_STORE_ENV_VAR)
            .filter(|value| !value.is_empty())
            .map(PathBuf::from),
    }
}

#[path = "inquello_routes.rs"]
mod route_bridge;
#[path = "inquello_reviewer.rs"]
mod reviewer;
#[path = "inquello_tasks.rs"]
pub(crate) mod tasks_bridge;
#[path = "inquello_usage.rs"]
pub(crate) mod usage_bridge;

#[derive(Default)]
struct BootstrapAdmission {
    generation: u64,
    transitions: usize,
    closed: bool,
}
/// Counts identity transitions even when they overlap or their future is dropped.
/// This owns no mutex guard across an await.
struct BootstrapTransition<'a> {
    states: &'a Mutex<HashMap<ConnectionId, BootstrapAdmission>>,
    connection: ConnectionId,
}
impl Drop for BootstrapTransition<'_> {
    fn drop(&mut self) {
        let mut states = self.states.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        let state = states.entry(self.connection).or_default();
        state.transitions = state.transitions.checked_sub(1).expect("balanced identity transition");
        state.generation = state.generation.checked_add(1).expect("bootstrap generation exhausted");
    }
}

pub(crate) struct InquelloRequestProcessor {
    task_config: Option<super::ConfigRequestProcessor>,
    // Unit fixtures replace local policy I/O only, never route evidence/approval.
    #[cfg(test)]
    task_layer_fixture: Option<(DeviceRequirements,UserConfig)>,
    authority_generations: Mutex<HashMap<ConnectionId,u64>>,
    #[cfg(all(feature="inference-fixtures",debug_assertions))]
    task_fixtures: tokio::sync::Mutex<HashMap<ConnectionId,tasks_bridge::TaskFixture>>,
    task_outgoing: Option<std::sync::Arc<crate::outgoing_message::OutgoingMessageSender>>,
    task_start_lock: tokio::sync::Mutex<()>,
    task_bootstrap_generations: Mutex<HashMap<ConnectionId,BootstrapAdmission>>,
    task_sessions: tokio::sync::Mutex<HashMap<ConnectionId, tasks_bridge::SessionBinding>>,
    routes: reviewer::RouteRuntime,
    runtime_id: String,
    usage_sources: Option<(std::sync::Arc<super::AccountRequestProcessor>, super::CatalogRequestProcessor)>,
    store_path: Option<PathBuf>,
    /// Roots the agent can write; the store may not live inside one.
    agent_writable_roots: Vec<PathBuf>,
    store: tokio::sync::OnceCell<SqliteWorkingStore>,
    principals: Mutex<HashMap<ConnectionId, PrincipalId>>,
}

impl InquelloRequestProcessor {
    pub(crate) fn new(agent_writable_roots: Vec<PathBuf>) -> Self {
        Self::with_store_path(configured_store_path(), agent_writable_roots)
    }

    pub(crate) fn with_store_path(
        store_path: Option<PathBuf>,
        agent_writable_roots: Vec<PathBuf>,
    ) -> Self {
        Self {
            task_config: None,
            #[cfg(test)]
            task_layer_fixture: None,
            authority_generations: Mutex::new(HashMap::new()),
            #[cfg(all(feature="inference-fixtures",debug_assertions))]
            task_fixtures: tokio::sync::Mutex::new(HashMap::new()),
            task_outgoing: None,
            task_start_lock: tokio::sync::Mutex::new(()),
            task_bootstrap_generations: Mutex::new(HashMap::new()),
            task_sessions: tokio::sync::Mutex::new(HashMap::new()),
            routes: reviewer::RouteRuntime::default(),
            runtime_id: uuid::Uuid::new_v4().to_string(),
            usage_sources: None,
            store_path,
            agent_writable_roots,
            store: tokio::sync::OnceCell::new(),
            principals: Mutex::new(HashMap::new()),
        }
    }

    // Closed entries are retained: delayed requests cannot reopen a connection.
    fn begin_task_bootstrap(&self, connection: ConnectionId) -> Result<u64, JSONRPCErrorError> {
        let mut states = self.task_bootstrap_generations.lock().map_err(|_|refusal("authority_unknown","Session fence unavailable"))?;
        let state = states.entry(connection).or_default();
        if state.closed || state.transitions != 0 {
            return Err(refusal("stale","Identity transition or closed connection prevents session setup"));
        }
        state.generation = state.generation.checked_add(1).expect("bootstrap generation exhausted");
        Ok(state.generation)
    }

    fn begin_bootstrap_transition(&self, connection: ConnectionId, close: bool) -> BootstrapTransition<'_> {
        let mut states = self.task_bootstrap_generations.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        let state = states.entry(connection).or_default();
        state.generation = state.generation.checked_add(1).expect("bootstrap generation exhausted");
        state.transitions = state.transitions.checked_add(1).expect("identity transition count exhausted");
        state.closed |= close;
        BootstrapTransition { states: &self.task_bootstrap_generations, connection }
    }

    pub(crate) async fn connection_closed(&self, connection_id: ConnectionId) {
        let _transition = self.begin_bootstrap_transition(connection_id, true);
        if let Ok(mut generations)=self.authority_generations.lock() {let generation=generations.entry(connection_id).or_insert(1);*generation=generation.saturating_add(1);}
        #[cfg(all(feature="inference-fixtures",debug_assertions))]
        self.task_fixtures.lock().await.remove(&connection_id);
        if let Some(session)=self.task_sessions.lock().await.remove(&connection_id) {session.cancellation.cancel();}
        let mut state = self.routes.state.lock().await;
        if let Some(principal) = self.principals_guard().remove(&connection_id) {
            self.routes.invalidate_principal(&mut state, principal);
        }
    }

    fn principals_guard(&self) -> std::sync::MutexGuard<'_, HashMap<ConnectionId, PrincipalId>> {
        self.principals
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }

    // ---- session -------------------------------------------------------------

    pub(crate) async fn set_principal(
        &self,
        connection_id: ConnectionId,
        params: InquelloSetPrincipalParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let _transition = self.begin_bootstrap_transition(connection_id, false);
        if let Ok(mut generations)=self.authority_generations.lock() {let generation=generations.entry(connection_id).or_insert(1);*generation=generation.saturating_add(1);}
        #[cfg(all(feature="inference-fixtures",debug_assertions))]
        self.task_fixtures.lock().await.remove(&connection_id);
        if let Some(session) = self.task_sessions.lock().await.remove(&connection_id) { session.cancellation.cancel(); }
        let mut state = self.routes.state.lock().await;
        let mut principals = self.principals_guard();
        if let Some(principal) = principals.get(&connection_id).copied() {
            self.routes.invalidate_principal(&mut state, principal);
        }
        match params.principal_id {
            Some(value) => {
                let principal = PrincipalId::parse(&value).map_err(domain_error)?;
                principals.insert(connection_id, principal);
            }
            None => {
                principals.remove(&connection_id);
            }
        }
        let bound = principals.get(&connection_id).map(ToString::to_string);
        Ok(Some(
            InquelloSetPrincipalResponse {
                principal_id: bound,
            }
            .into(),
        ))
    }

    fn actor(&self, connection_id: ConnectionId) -> Result<Actor, JSONRPCErrorError> {
        self.principals_guard()
            .get(&connection_id)
            .copied()
            .map(|principal_id| Actor { principal_id })
            .ok_or_else(|| refusal("unauthenticated", "no Inquello principal is signed in"))
    }

    /// Opens (once) and returns the working store. A failed open is retried on
    /// the next call.
    async fn store(&self) -> Result<SqliteWorkingStore, JSONRPCErrorError> {
        let Some(path) = &self.store_path else {
            return Err(refusal(
                "store_not_configured",
                "the Inquello working store is not configured",
            ));
        };
        self.store
            .get_or_try_init(|| open_store(path, &self.agent_writable_roots))
            .await
            .cloned()
    }

    async fn context(
        &self,
        connection_id: ConnectionId,
    ) -> Result<(SqliteWorkingStore, Actor), JSONRPCErrorError> {
        let actor = self.actor(connection_id)?;
        Ok((self.store().await?, actor))
    }

    // ---- queries -------------------------------------------------------------

    pub(crate) async fn workspace_list(
        &self,
        connection_id: ConnectionId,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection_id).await?;
        let known = organise::known_workspaces(&store, actor)
            .await
            .map_err(domain_error)?;
        let mut current = Vec::new();
        for workspace in known {
            if self.current_workspace_metadata(connection_id, actor, &workspace.workspace_id.to_string()).await.is_ok() { current.push(workspace); }
        }
        if self.actor(connection_id)? != actor { return Err(refusal("not_found", "Private work unavailable")); }
        let known = current;
        Ok(Some(
            InquelloWorkspaceListResponse {
                workspaces: known
                    .into_iter()
                    .map(|known| InquelloKnownWorkspace {
                        workspace_id: known.workspace_id.to_string(),
                        name: known.label.as_ref().map(|label| label.name.clone()),
                        label_revision: known.label.map_or(0, |label| label.revision.get()),
                    })
                    .collect(),
            }
            .into(),
        ))
    }

    pub(crate) async fn workspace_tree(
        &self,
        connection_id: ConnectionId,
        params: InquelloWorkspaceTreeParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection_id).await?;
        self.current_workspace_metadata(connection_id,actor,&params.workspace_id).await?;
        let tree = organise::workspace_tree(&store, actor, &params.workspace_id)
            .await
            .map_err(domain_error)?;
        let mut tasks=Vec::new(); let mut unavailable_tasks=Vec::new();
        for task in &tree.tasks {
            let available=self.authorize_task_metadata(connection_id,actor,&task.task_id.to_string()).await.is_ok();
            match private_task_tree_item(task,actor,&params.workspace_id,available) {
                Some(Ok(task))=>tasks.push(task),Some(Err(task))=>unavailable_tasks.push(task),None=>{},
            }
        }
        self.current_workspace_metadata(connection_id,actor,&params.workspace_id).await?;
        Ok(Some(
            InquelloWorkspaceTreeResponse {
                workspace_id: params.workspace_id,
                engagements: tree.engagements.iter().map(engagement_view).collect(),
                folders: tree.folders.iter().map(folder_view).collect(),
                tasks, unavailable_tasks,
            }
            .into(),
        ))
    }

    // ---- commands ------------------------------------------------------------

    pub(crate) async fn workspace_remember(
        &self,
        connection_id: ConnectionId,
        params: InquelloWorkspaceRememberParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection_id).await?;
        let outcome = organise::remember_workspace(
            &store,
            &SystemClock,
            actor,
            organise::RememberWorkspace {
                operation_id: params.operation_id,
                expected_revision: Revision::new(params.expected_revision),
                workspace_id: params.workspace_id,
                name: params.name,
            },
        )
        .await
        .map_err(domain_error)?;
        let receipt = receipt_view(&outcome);
        let OrganiseRecord::WorkspaceLabel(label) = outcome.record else {
            return Err(unexpected_record());
        };
        Ok(Some(
            InquelloWorkspaceRememberResponse {
                workspace: InquelloKnownWorkspace {
                    workspace_id: label.workspace_id.to_string(),
                    name: Some(label.name),
                    label_revision: label.revision.get(),
                },
                receipt,
            }
            .into(),
        ))
    }

    pub(crate) async fn engagement_create(
        &self,
        connection_id: ConnectionId,
        params: InquelloEngagementCreateParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection_id).await?;
        let outcome = organise::create_engagement(
            &store,
            &SystemClock,
            actor,
            organise::CreateEngagement {
                operation_id: params.operation_id,
                expected_revision: Revision::new(params.expected_revision),
                workspace_id: params.workspace_id,
                service_engagement_id: params.service_engagement_id,
                name: params.name,
                objectives: params.objectives,
                scope: params.scope,
                client_entity: params.client_entity,
                period_start: params.period_start,
                period_end: params.period_end,
            },
        )
        .await
        .map_err(domain_error)?;
        engagement_response(&outcome).map(|response| Some(response.into()))
    }

    pub(crate) async fn engagement_update(
        &self,
        connection_id: ConnectionId,
        params: InquelloEngagementUpdateParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection_id).await?;
        let outcome = organise::update_engagement(
            &store,
            &SystemClock,
            actor,
            organise::UpdateEngagement {
                operation_id: params.operation_id,
                expected_revision: Revision::new(params.expected_revision),
                workspace_id: params.workspace_id,
                engagement_id: params.engagement_id,
                name: params.name,
                objectives: params.objectives,
                scope: params.scope,
                client_entity: params.client_entity,
                period_start: params.period_start,
                period_end: params.period_end,
            },
        )
        .await
        .map_err(domain_error)?;
        engagement_response(&outcome)
            .map(|response| Some(ClientResponsePayload::InquelloEngagementUpdate(response)))
    }

    pub(crate) async fn folder_create(
        &self,
        connection_id: ConnectionId,
        params: InquelloFolderCreateParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection_id).await?;
        let outcome = organise::create_folder(
            &store,
            &SystemClock,
            actor,
            organise::CreateFolder {
                operation_id: params.operation_id,
                expected_revision: Revision::new(params.expected_revision),
                workspace_id: params.workspace_id,
                engagement_id: params.engagement_id,
                name: params.name,
            },
        )
        .await
        .map_err(domain_error)?;
        let receipt = receipt_view(&outcome);
        let OrganiseRecord::Folder(folder) = &outcome.record else {
            return Err(unexpected_record());
        };
        Ok(Some(
            InquelloFolderResponse {
                folder: folder_view(folder),
                receipt,
            }
            .into(),
        ))
    }

    pub(crate) async fn task_create(
        &self,
        connection_id: ConnectionId,
        params: InquelloTaskCreateParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection_id).await?;
        let outcome = organise::create_task(
            &store,
            &SystemClock,
            actor,
            organise::CreateTask {
                operation_id: params.operation_id,
                expected_revision: Revision::new(params.expected_revision),
                workspace_id: params.workspace_id,
                engagement_id: params.engagement_id,
                folder_id: params.folder_id,
                title: params.title,
            },
        )
        .await
        .map_err(domain_error)?;
        task_response(&outcome).map(|response| Some(response.into()))
    }

    pub(crate) async fn task_rename(
        &self,
        connection_id: ConnectionId,
        params: InquelloTaskRenameParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection_id).await?;
        let outcome = organise::rename_task(
            &store,
            &SystemClock,
            actor,
            organise::RenameTask {
                operation_id: params.operation_id,
                expected_revision: Revision::new(params.expected_revision),
                workspace_id: params.workspace_id,
                task_id: params.task_id,
                title: params.title,
            },
        )
        .await
        .map_err(domain_error)?;
        task_response(&outcome)
            .map(|response| Some(ClientResponsePayload::InquelloTaskRename(response)))
    }

    pub(crate) async fn task_move(
        &self,
        connection_id: ConnectionId,
        params: InquelloTaskMoveParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection_id).await?;
        let outcome = organise::move_task(
            &store,
            &SystemClock,
            actor,
            organise::MoveTask {
                operation_id: params.operation_id,
                expected_revision: Revision::new(params.expected_revision),
                workspace_id: params.workspace_id,
                task_id: params.task_id,
                engagement_id: params.engagement_id,
                folder_id: params.folder_id,
            },
        )
        .await
        .map_err(domain_error)?;
        task_response(&outcome)
            .map(|response| Some(ClientResponsePayload::InquelloTaskMove(response)))
    }

    pub(crate) async fn task_attach_thread(
        &self,
        connection_id: ConnectionId,
        params: InquelloTaskAttachThreadParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection_id).await?;
        let outcome = organise::attach_thread(
            &store,
            &SystemClock,
            actor,
            organise::AttachThread {
                operation_id: params.operation_id,
                expected_revision: Revision::new(params.expected_revision),
                workspace_id: params.workspace_id,
                task_id: params.task_id,
                runtime_thread_id: params.runtime_thread_id,
            },
        )
        .await
        .map_err(domain_error)?;
        task_response(&outcome)
            .map(|response| Some(ClientResponsePayload::InquelloTaskAttachThread(response)))
    }

    // ---- Task states (Story 1.15) ------------------------------------------------

    pub(crate) async fn state_list(
        &self,
        connection_id: ConnectionId,
        params: InquelloStateListParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection_id).await?;
        let states = state::task_states(&store, actor, &params.task_id)
            .await
            .map_err(domain_error)?;
        Ok(Some(
            InquelloStateListResponse {
                task_id: states.task_id.to_string(),
                revision: states.revision.get(),
                dimensions: StateDimension::ALL
                    .into_iter()
                    .map(|dimension| InquelloStateDimension {
                        dimension: dimension.as_str().to_string(),
                        records: states.history(dimension).map(state_record_view).collect(),
                    })
                    .collect(),
            }
            .into(),
        ))
    }

    pub(crate) async fn state_record(
        &self,
        connection_id: ConnectionId,
        params: InquelloStateRecordParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection_id).await?;
        let writer = state_writer(&params.actor_kind, params.actor_ref)?;
        let outcome = state::record_task_state(
            &store,
            &SystemClock,
            actor,
            state::RecordTaskState {
                operation_id: params.operation_id,
                expected_revision: Revision::new(params.expected_revision),
                task_id: params.task_id,
                dimension: params.dimension,
                scope_kind: params.scope_kind,
                scope_id: params.scope_id,
                value: params.value,
                writer,
            },
        )
        .await
        .map_err(domain_error)?;
        Ok(Some(
            InquelloStateRecordResponse {
                task_id: outcome.record.task_id.to_string(),
                record: state_record_view(&outcome.record),
                receipt: InquelloReceipt {
                    operation_id: outcome.receipt.operation_id.to_string(),
                    command: state::RECORD_STATE_COMMAND.to_string(),
                    expected_revision: outcome.receipt.expected_revision.get(),
                    resulting_revision: outcome.receipt.resulting_revision.get(),
                    replayed: outcome.replayed,
                },
            }
            .into(),
        ))
    }
}

impl InquelloRequestProcessor {
    // ---- Effective policy and broader modes (Story 1.18) -------------------------

    pub(crate) async fn policy_effective(
        &self,
        connection_id: ConnectionId,
        params: InquelloPolicyEffectiveParams,
        device: DeviceRequirements,
        user: UserConfig,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        self.observe_review_authority(connection_id, &params.workspace_policy, &device, &user).await?;
        let actor = self.actor(connection_id)?;
        let layer = workspace_layer(&params.workspace_policy)?;
        let policy = execution_policy::effective_policy(&layer, &device, &user);
        let route_available = if let Some(task_id) = &params.task_id {
            let state = self.routes.state.lock().await;
            let selected = inquello_domain::routes::task_route(&self.store().await?, actor, task_id).await.map_err(domain_error)?;
            let credential = selected.current.as_ref().is_some_and(|record| state.credential(actor.principal_id, &record.configuration).is_some());
            selected.eligibility(credential, true, inquello_domain::routes::DataTier::Synthetic).enabled
        } else { false };
        let task = match params.task_id {
            Some(task_id) => {
                let store = self.store().await?;
                let broad = execution_policy::task_broad_mode(&store, actor, &task_id)
                    .await
                    .map_err(domain_error)?;
                if broad.workspace_id != layer.workspace_id {
                    return Err(domain_error(DomainError::WorkspaceMismatch));
                }
                let folder = params
                    .task_folder
                    .as_deref()
                    .map(|folder| task_folder(folder, broad.task_id))
                    .transpose()?;
                Some(task_policy(&policy, &broad, folder))
            }
            None if params.task_folder.is_some() => {
                return Err(refusal("invalid", "taskFolder needs a taskId"));
            }
            None => None,
        };
        Ok(Some(
            InquelloPolicyEffectiveResponse {
                environment: policy.environment.as_str().to_string(),
                workspace_id: policy.workspace_id.to_string(),
                policy_revision: policy.policy_revision.get(),
                authorization_epoch: policy.authorization_epoch.get(),
                settings: settings_view(&policy),
                device: device_view(&device),
                capabilities: capability_contract(),
                reach: reach_view(&execution_policy::tool_reach(
                    &policy,
                    BroadModeStatus::Standard,
                )),
                command_rules: execution_policy::effective_rules(&policy, &[], Revision::ZERO)
                    .iter()
                    .map(sourced_rule_view)
                    .collect(),
                reviewer: reviewer_view(&policy, route_available),
                task,
            }
            .into(),
        ))
    }

    pub(crate) async fn broad_mode_read(
        &self,
        connection_id: ConnectionId,
        params: InquelloBroadModeReadParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection_id).await?;
        let broad = execution_policy::task_broad_mode(&store, actor, &params.task_id)
            .await
            .map_err(domain_error)?;
        Ok(Some(
            InquelloBroadModeReadResponse {
                task_id: broad.task_id.to_string(),
                workspace_id: broad.workspace_id.to_string(),
                revision: broad.revision.get(),
                mode: broad.recorded().as_str().to_string(),
            }
            .into(),
        ))
    }

    pub(crate) async fn broad_mode_set(
        &self,
        connection_id: ConnectionId,
        params: InquelloBroadModeSetParams,
        device: DeviceRequirements,
        user: UserConfig,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let mut review_state = self.routes.state.lock().await;
        let (store, actor) = self.context(connection_id).await?;
        self.routes.cancel_principal_reviews(&mut review_state, actor.principal_id);

        let writer = state_writer(&params.actor_kind, params.actor_ref)?;
        let layer = workspace_layer(&params.workspace_policy)?;
        let policy = execution_policy::effective_policy(&layer, &device, &user);
        let outcome = execution_policy::set_broad_mode(
            &store,
            &SystemClock,
            actor,
            &policy,
            execution_policy::SetBroadMode {
                operation_id: params.operation_id,
                expected_revision: Revision::new(params.expected_revision),
                task_id: params.task_id,
                mode: params.mode,
                confirmation: params.confirmation,
                writer,
            },
        )
        .await
        .map_err(domain_error)?;
        let broad =
            execution_policy::task_broad_mode(&store, actor, &outcome.record.task_id.to_string())
                .await
                .map_err(domain_error)?;
        Ok(Some(
            InquelloBroadModeSetResponse {
                task: task_policy(&policy, &broad, None),
                receipt: InquelloReceipt {
                    operation_id: outcome.receipt.operation_id.to_string(),
                    command: execution_policy::SET_BROAD_MODE_COMMAND.to_string(),
                    expected_revision: outcome.receipt.expected_revision.get(),
                    resulting_revision: outcome.receipt.resulting_revision.get(),
                    replayed: outcome.replayed,
                },
            }
            .into(),
        ))
    }
}

/// What `inquello/tools/exec` runs (Story 1.19): the configuration edits to
/// write into the runtime's user configuration, when bounded, and the
/// runtime's own `command/exec` params.
pub(crate) struct ToolsExecPlan {
    /// `(key path, value)` pairs: the network proxy feature (without it a
    /// profile's network would not go through the proxy), the runtime's
    /// default permissions (the built-in `:read-only`, which the runtime
    /// requires once named profiles exist, so nothing outside a Task profile
    /// reaches more than read only) and the `[permissions.<id>]` table. Empty
    /// when unbounded.
    pub(crate) config_edits: Vec<(String, serde_json::Value)>,
    pub(crate) exec: CommandExecParams,
}

impl InquelloRequestProcessor {
    /// Derives the Task's tool profile from the same inputs as
    /// `inquello/policy/effective` and plans its command. Only the Task's
    /// creator may run it, and the Task must belong to the Workspace. The
    /// Task folder and its `output` folder must already exist.
    pub(crate) async fn tools_exec_plan(
        &self,
        connection_id: ConnectionId,
        params: InquelloToolsExecParams,
        device: DeviceRequirements,
        user: UserConfig,
    ) -> Result<ToolsExecPlan, JSONRPCErrorError> {
        let (store, actor) = self.context(connection_id).await?;
        let layer = workspace_layer(&params.workspace_policy)?;
        let command = match &params.sandbox_probe_target {
            // The local sandbox check (Story 1.19): a fixed probe, built here,
            // that only tests whether a path is visible. Rules do not apply.
            Some(target) => {
                if !params.command.is_empty() || target.is_empty() {
                    return Err(refusal(
                        "invalid",
                        "a sandbox check takes a probe target and no command",
                    ));
                }
                vec![
                    "/bin/sh".to_string(),
                    "-c".to_string(),
                    "test ! -e \"$1\"".to_string(),
                    "sandbox-check".to_string(),
                    target.clone(),
                ]
            }
            None => {
                if params.command.is_empty() {
                    return Err(refusal("invalid", "command must not be empty"));
                }
                params.command.clone()
            }
        };
        let evaluated = evaluate_task_command(
            &store,
            actor,
            &layer,
            &device,
            &user,
            &params.task_id,
            &command,
        )
        .await?;
        if params.sandbox_probe_target.is_none() {
            match evaluated.evaluation.decision {
                RuleDecision::Forbid => {
                    return Err(evaluation_refusal(
                        "command_forbidden",
                        "this command is forbidden by a command rule",
                        &evaluated.evaluation,
                    ));
                }
                RuleDecision::Prompt => {
                    let Some(request_id) = &params.permission_request_id else {
                        return Err(evaluation_refusal(
                            "permission_required",
                            "this command needs permission to act",
                            &evaluated.evaluation,
                        ));
                    };
                    execution_policy::use_permission(
                        &store,
                        &SystemClock,
                        actor,
                        request_id,
                        evaluated.broad.task_id,
                        &command,
                    )
                    .await
                    .map_err(|error| match error {
                        DomainError::PermissionNotGranted => evaluation_refusal(
                            "permission_required",
                            "no allowed permission request covers this command",
                            &evaluated.evaluation,
                        ),
                        error => domain_error(error),
                    })?;
                }
                // An allowed command still runs inside the Task's profile.
                RuleDecision::Allow => {}
            }
        }
        let policy = &evaluated.policy;
        let folder = task_folder(&params.task_folder, evaluated.broad.task_id)?;
        if !folder.root().is_dir() || !folder.output().is_dir() {
            return Err(refusal(
                "task_folder_missing",
                "the Task's working folder has not been created",
            ));
        }
        let profile = execution_policy::tool_profile(policy, evaluated.status, folder);
        let runtime = runtime_profile(&profile);
        let cwd = profile.folder.root().to_path_buf();
        let reviewer = (
            "approvals_reviewer".to_string(),
            json!(
                execution_policy::permission_reviewer(policy, false)
                    .runtime_setting()
            ),
        );
        let (config_edits, sandbox_policy, permission_profile) =
            match (runtime.permission_profile_id, runtime.permission_profile) {
                (Some(id), Some(table)) => (
                    vec![
                        ("features.network_proxy".to_string(), json!(true)),
                        ("default_permissions".to_string(), json!(":read-only")),
                        (format!("permissions.{id}"), table),
                        reviewer,
                    ],
                    None,
                    Some(id),
                ),
                _ => (
                    vec![reviewer],
                    Some(codex_app_server_protocol::SandboxPolicy::DangerFullAccess),
                    None,
                ),
            };
        Ok(ToolsExecPlan {
            config_edits,
            exec: CommandExecParams {
                command,
                process_id: None,
                tty: false,
                stream_stdin: false,
                stream_stdout_stderr: false,
                output_bytes_cap: None,
                disable_output_cap: false,
                disable_timeout: false,
                timeout_ms: params.timeout_ms,
                cwd: Some(cwd),
                env: None,
                size: None,
                sandbox_policy,
                permission_profile,
            },
        })
    }
}

// ---- Command rules and permission to act (Story 1.20) ----------------------------

/// The justification prefix that carries a rule's index through the
/// runtime's matcher.
const RULE_MARK: &str = "inquello-rule:";

/// Which of `rules` match `command` under the runtime's own exec-policy
/// prefix matching (`codex-execpolicy`, reached through the requirements
/// form `codex-config` exposes). Each rule becomes one prefix rule whose
/// justification carries its index. The matcher's decision is not used:
/// Inquello combines the matches itself (forbid over prompt over allow), so
/// every rule is given to the matcher as `prompt`.
pub(crate) fn matched_rules(
    command: &[String],
    rules: &[SourcedRule],
) -> Result<Vec<bool>, JSONRPCErrorError> {
    let mut matched = vec![false; rules.len()];
    if rules.is_empty() || command.is_empty() {
        return Ok(matched);
    }
    let requirements = codex_config::RequirementsExecPolicyToml {
        prefix_rules: rules
            .iter()
            .enumerate()
            .map(
                |(index, sourced)| codex_config::RequirementsExecPolicyPrefixRuleToml {
                    pattern: sourced
                        .rule
                        .prefix
                        .iter()
                        .map(
                            |token| codex_config::RequirementsExecPolicyPatternTokenToml {
                                token: Some(token.clone()),
                                any_of: None,
                            },
                        )
                        .collect(),
                    decision: Some(codex_config::RequirementsExecPolicyDecisionToml::Prompt),
                    justification: Some(format!("{RULE_MARK}{index}")),
                },
            )
            .collect(),
    };
    let policy = requirements.to_policy().map_err(|error| {
        tracing::error!("inquello command rules did not compile: {error}");
        failure(
            "rules_unavailable",
            "the command rules could not be applied",
        )
    })?;
    for found in policy.matches_for_command(command, None) {
        let value = serde_json::to_value(&found).unwrap_or_default();
        let index = value["prefixRuleMatch"]["justification"]
            .as_str()
            .and_then(|justification| justification.strip_prefix(RULE_MARK))
            .and_then(|index| index.parse::<usize>().ok());
        if let Some(index) = index
            && let Some(slot) = matched.get_mut(index)
        {
            *slot = true;
        }
    }
    Ok(matched)
}

/// One command evaluated for a Task, with the inputs it came from.
pub(crate) struct TaskEvaluation {
    pub(crate) policy: EffectivePolicy,
    pub(crate) broad: execution_policy::TaskBroadMode,
    pub(crate) status: BroadModeStatus,
    pub(crate) evaluation: CommandEvaluation,
}

/// Evaluates `command` for the caller's Task under the Workspace layer, the
/// device and user layers and the person's own rules.
async fn evaluate_task_command(
    store: &SqliteWorkingStore,
    actor: Actor,
    layer: &WorkspaceLayer,
    device: &DeviceRequirements,
    user: &UserConfig,
    task_id: &str,
    command: &[String],
) -> Result<TaskEvaluation, JSONRPCErrorError> {
    let policy = execution_policy::effective_policy(layer, device, user);
    let broad = execution_policy::task_broad_mode(store, actor, task_id)
        .await
        .map_err(domain_error)?;
    if broad.workspace_id != layer.workspace_id {
        return Err(domain_error(DomainError::WorkspaceMismatch));
    }
    let status = BroadModeStatus::of(&policy, broad.recorded());
    let own = execution_policy::user_rules(store, actor)
        .await
        .map_err(domain_error)?;
    let rules = execution_policy::effective_rules(&policy, &own.rules, own.revision);
    let matched = matched_rules(command, &rules)?;
    let evaluation = execution_policy::evaluate_command(command, &rules, &matched, &policy, status);
    Ok(TaskEvaluation {
        policy,
        broad,
        status,
        evaluation,
    })
}

impl InquelloRequestProcessor {
    pub(crate) async fn user_rules_read(
        &self,
        connection_id: ConnectionId,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection_id).await?;
        let rules = execution_policy::user_rules(&store, actor)
            .await
            .map_err(domain_error)?;
        Ok(Some(
            InquelloUserRulesReadResponse {
                revision: rules.revision.get(),
                rules: rules.rules.iter().map(rule_view).collect(),
            }
            .into(),
        ))
    }

    pub(crate) async fn user_rules_set(
        &self,
        connection_id: ConnectionId,
        params: InquelloUserRulesSetParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let mut review_state = self.routes.state.lock().await;
        let (store, actor) = self.context(connection_id).await?;
        self.routes.cancel_principal_reviews(&mut review_state, actor.principal_id);

        let outcome = execution_policy::set_user_rules(
            &store,
            &SystemClock,
            actor,
            execution_policy::SetUserRules {
                operation_id: params.operation_id,
                expected_revision: Revision::new(params.expected_revision),
                rules: params
                    .rules
                    .into_iter()
                    .map(|rule| execution_policy::UserRuleInput {
                        prefix: rule.prefix,
                        decision: rule.decision,
                        note: rule.note,
                    })
                    .collect(),
            },
        )
        .await
        .map_err(domain_error)?;
        Ok(Some(
            InquelloUserRulesSetResponse {
                revision: outcome.record.revision.get(),
                rules: outcome.record.rules.iter().map(rule_view).collect(),
                receipt: InquelloReceipt {
                    operation_id: outcome.receipt.operation_id.to_string(),
                    command: execution_policy::SET_USER_RULES_COMMAND.to_string(),
                    expected_revision: outcome.receipt.expected_revision.get(),
                    resulting_revision: outcome.receipt.resulting_revision.get(),
                    replayed: outcome.replayed,
                },
            }
            .into(),
        ))
    }

    /// Records a pending request after evaluating the command here. A
    /// forbidden command is refused with its rule and no request exists.
    pub(crate) async fn permissions_request(
        &self,
        connection_id: ConnectionId,
        params: InquelloPermissionsRequestParams,
        device: DeviceRequirements,
        user: UserConfig,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection_id).await?;
        if params.command.is_empty() {
            return Err(refusal("invalid", "command must not be empty"));
        }
        let layer = workspace_layer(&params.workspace_policy)?;
        let evaluated = evaluate_task_command(
            &store,
            actor,
            &layer,
            &device,
            &user,
            &params.task_id,
            &params.command,
        )
        .await?;
        if evaluated.evaluation.decision == RuleDecision::Forbid {
            return Err(evaluation_refusal(
                "command_forbidden",
                "this command is forbidden by a command rule",
                &evaluated.evaluation,
            ));
        }
        let outcome = execution_policy::request_permission(
            &store,
            &SystemClock,
            actor,
            execution_policy::RequestPermission {
                operation_id: params.operation_id,
                request_id: params.request_id,
                task_id: params.task_id,
                origin: params.origin,
                evaluation: evaluated.evaluation,
                ttl_ms: params.ttl_ms,
            },
        )
        .await
        .map_err(domain_error)?;
        Ok(Some(
            InquelloPermissionsRequestResponse {
                request: request_view(&outcome.request, SystemClock.now()),
                receipt: permission_receipt_view(&outcome),
            }
            .into(),
        ))
    }

    pub(crate) async fn permissions_pending(
        &self,
        connection_id: ConnectionId,
        params: InquelloPermissionsPendingParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection_id).await?;
        let now = SystemClock.now();
        let requests =
            execution_policy::pending_requests(&store, actor, params.task_id.as_deref(), now)
                .await
                .map_err(domain_error)?;
        Ok(Some(
            InquelloPermissionsPendingResponse {
                requests: requests
                    .iter()
                    .map(|request| request_view(request, now))
                    .collect(),
            }
            .into(),
        ))
    }

    /// Decides one request. A `human` decider is the bound principal; the
    /// automatic reviewer is refused until a processing route exists.
    pub(crate) async fn permissions_decide(
        &self,
        connection_id: ConnectionId,
        params: InquelloPermissionsDecideParams,
    ) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
        let (store, actor) = self.context(connection_id).await?;
        let invalid = |message: &str| refusal("invalid", message);
        let decider = match (params.actor_kind.as_str(), params.actor_ref) {
            ("human", None) => execution_policy::Decider::Human,
            ("human", Some(_)) => {
                return Err(invalid(
                    "a human actor is the signed-in principal and takes no actor reference",
                ));
            }
            ("system", Some(reference)) => execution_policy::Decider::System { reference },
            ("automated_reviewer", _) => {
                return Err(refusal("reviewer_not_available",
                    "Only a trusted runtime-created invocation can record automated permission review"));
            }
            ("system", None) => return Err(invalid("this actor needs an actor reference")),
            _ => {
                return Err(invalid(
                    "actor_kind must be human, system or automated_reviewer",
                ));
            }
        };
        let outcome = execution_policy::decide_permission(
            &store,
            &SystemClock,
            actor,
            execution_policy::DecidePermission {
                operation_id: params.operation_id,
                expected_revision: Revision::new(params.expected_revision),
                request_id: params.request_id,
                outcome: params.outcome,
                decider,
            },
        )
        .await
        .map_err(domain_error)?;
        Ok(Some(
            InquelloPermissionsDecideResponse {
                request: request_view(&outcome.request, SystemClock.now()),
                receipt: permission_receipt_view(&outcome),
            }
            .into(),
        ))
    }
}

fn rule_view(rule: &CommandRule) -> InquelloCommandRule {
    InquelloCommandRule {
        prefix: rule.prefix.clone(),
        decision: rule.decision.as_str().to_string(),
        note: rule.note.clone(),
    }
}

fn rule_source_view(source: RuleSource) -> InquelloRuleSource {
    InquelloRuleSource {
        kind: source.kind().to_string(),
        revision: source.revision().map(Revision::get),
        behaviour: source
            .behaviour()
            .map(|behaviour| behaviour.as_str().to_string()),
        label: source.to_string(),
    }
}

fn sourced_rule_view(sourced: &SourcedRule) -> InquelloCommandRuleView {
    InquelloCommandRuleView {
        rule: rule_view(&sourced.rule),
        source: rule_source_view(sourced.source),
    }
}

fn reviewer_view(policy: &EffectivePolicy, route_available: bool) -> InquelloPermissionReviewer {
    let state = execution_policy::permission_reviewer(policy, route_available);
    InquelloPermissionReviewer {
        enabled: policy.automatic_permission_review.value,
        state: state.kind().to_string(),
        label: if state == execution_policy::ReviewerState::NotAvailable {
            "Automated permission review: not available (no verified eligible Task route)".into()
        } else { state.label().to_string() },
        runtime_setting: state.runtime_setting().to_string(),
    }
}

fn evaluation_view(evaluation: &CommandEvaluation) -> InquelloCommandEvaluation {
    InquelloCommandEvaluation {
        decision: evaluation.decision.as_str().to_string(),
        controlling_rule: evaluation.controlling_rule.as_ref().map(rule_view),
        source: rule_source_view(evaluation.source),
        cannot_ask: evaluation.cannot_ask,
        command: evaluation.command.clone(),
        command_text: evaluation.command_text(),
        analysis: evaluation.analysis.clone(),
        destination: evaluation.destination.clone(),
        consequence: evaluation.consequence.clone(),
        rule_text: evaluation.rule_text(),
    }
}

fn request_view(
    request: &execution_policy::PermissionRequest,
    now: inquello_domain::Timestamp,
) -> InquelloPermissionRequest {
    InquelloPermissionRequest {
        request_id: request.request_id.to_string(),
        task_id: request.task_id.to_string(),
        workspace_id: request.workspace_id.to_string(),
        origin: request.origin.as_str().to_string(),
        label: execution_policy::PERMISSION_LABEL.to_string(),
        evaluation: evaluation_view(&request.evaluation),
        created_at: request.created_at.unix_millis(),
        expires_at: request.expires_at.unix_millis(),
        status: request.status(now).as_str().to_string(),
        revision: request.revision().get(),
        decision: request
            .decision
            .as_ref()
            .map(|decision| InquelloPermissionDecision {
                outcome: decision.outcome.as_str().to_string(),
                actor_kind: decision.actor_kind.as_str().to_string(),
                actor_ref: decision.actor_ref.clone(),
                decided_at: decision.decided_at.unix_millis(),
                label: (decision.actor_kind == execution_policy::DeciderKind::AutomatedReviewer)
                    .then(|| execution_policy::AUTOMATED_DECISION_LABEL.to_string()),
            }),
        used: request.used_at.is_some(),
    }
}

fn permission_receipt_view(
    outcome: &execution_policy::PermissionRequestOutcome,
) -> InquelloReceipt {
    InquelloReceipt {
        operation_id: outcome.receipt.operation_id.to_string(),
        command: outcome.receipt.command.clone(),
        expected_revision: outcome.receipt.expected_revision.get(),
        resulting_revision: outcome.receipt.resulting_revision.get(),
        replayed: outcome.replayed,
    }
}

/// A refusal that carries the command's decision record, so the host can
/// name the rule and its source.
fn evaluation_refusal(
    kind: &str,
    message: &str,
    evaluation: &CommandEvaluation,
) -> JSONRPCErrorError {
    JSONRPCErrorError {
        code: INVALID_REQUEST_ERROR_CODE,
        message: message.to_string(),
        data: Some(json!({
            "inquello": {
                "kind": kind,
                "evaluation": serde_json::to_value(evaluation_view(evaluation)).unwrap_or_default(),
            }
        })),
    }
}

/// The Task folder from main's payload, validated by the domain.
fn task_folder(folder: &str, task_id: TaskId) -> Result<TaskFolder, JSONRPCErrorError> {
    TaskFolder::new(std::path::PathBuf::from(folder), task_id).map_err(domain_error)
}

/// The permissions profile id of a Task's tool profile.
fn permission_profile_id(task_id: TaskId) -> String {
    format!("inquello-task-{task_id}")
}

fn reach_view(reach: &ToolReach) -> InquelloToolReach {
    let (network, domains) = match &reach.network {
        execution_policy::NetworkReach::Listed(domains) => ("listed", domains.clone()),
        execution_policy::NetworkReach::Unrestricted => ("unrestricted", Vec::new()),
    };
    InquelloToolReach {
        bounded: reach.bounded,
        boundaries: reach
            .boundaries
            .iter()
            .map(|boundary| InquelloToolBoundary {
                kind: boundary.kind().to_string(),
                access: boundary.access().as_str().to_string(),
                label: boundary.label().to_string(),
            })
            .collect(),
        network: network.to_string(),
        domains,
        network_source: source_view(reach.network_source),
    }
}

/// The tool profile in the runtime's own form. A bounded profile is a named
/// permissions profile: the runtime's `:minimal` system set and this runtime's
/// own executable (which the Linux sandbox re-executes) read only, the Task
/// folders as derived, and the network through the runtime's proxy with only
/// the allowed domains (none when empty, so every destination is blocked and
/// named). A permitted Full access mode is `danger-full-access`.
fn runtime_profile(profile: &ToolProfile) -> InquelloRuntimeProfile {
    if !profile.reach.bounded {
        return InquelloRuntimeProfile {
            sandbox: "danger-full-access".to_string(),
            permission_profile_id: None,
            permission_profile: None,
            readable_roots: Vec::new(),
            writable_roots: Vec::new(),
            network_allowlist: None,
        };
    }
    let mut filesystem = serde_json::Map::new();
    filesystem.insert(":minimal".to_string(), json!("read"));
    if let Ok(exe) = std::env::current_exe() {
        filesystem.insert(exe.to_string_lossy().into_owned(), json!("read"));
    }
    for (path, access) in profile.folders() {
        filesystem.insert(path.to_string_lossy().into_owned(), json!(access.as_str()));
    }
    let allowlist = profile.network_allowlist().unwrap_or_default().to_vec();
    let mut network = serde_json::Map::new();
    network.insert("enabled".to_string(), json!(true));
    if !allowlist.is_empty() {
        network.insert(
            "domains".to_string(),
            serde_json::Value::Object(
                allowlist
                    .iter()
                    .map(|domain| (domain.clone(), json!("allow")))
                    .collect(),
            ),
        );
    }
    InquelloRuntimeProfile {
        sandbox: "permission-profile".to_string(),
        permission_profile_id: Some(permission_profile_id(profile.folder.task_id())),
        permission_profile: Some(json!({
            "description": "Inquello Task tool profile (Story 1.19)",
            "filesystem": filesystem,
            "network": network,
        })),
        readable_roots: profile
            .folders()
            .into_iter()
            .map(|(path, _)| path.to_string_lossy().into_owned())
            .collect(),
        writable_roots: profile
            .writable_roots()
            .into_iter()
            .map(|path| path.to_string_lossy().into_owned())
            .collect(),
        network_allowlist: Some(allowlist),
    }
}

/// The Workspace layer from main's payload, validated by the domain.
fn workspace_layer(
    policy: &InquelloWorkspaceExecutionPolicy,
) -> Result<WorkspaceLayer, JSONRPCErrorError> {
    let workspace_id = WorkspaceId::parse(&policy.workspace_id).map_err(domain_error)?;
    let execution = match &policy.execution {
        None | Some(serde_json::Value::Null) => None,
        Some(value) => Some(ExecutionPolicy::from_value(value).map_err(|error| {
            refusal(
                "invalid",
                &format!("the Workspace policy is invalid: {error}"),
            )
        })?),
    };
    Ok(WorkspaceLayer {
        workspace_id,
        policy_revision: Revision::new(policy.policy_revision),
        authorization_epoch: Revision::new(policy.authorization_epoch),
        execution,
    })
}

impl InquelloRequestProcessor {
    /// The device layer of the effective policy (see [`read_device_requirements`]).
    pub(crate) fn device_requirements(
        response: &ConfigRequirementsReadResponse,
    ) -> DeviceRequirements {
        read_device_requirements(response)
    }

    /// The user layer of the effective policy (see [`read_user_config`]).
    pub(crate) fn user_config(response: &ConfigReadResponse) -> UserConfig {
        read_user_config(response)
    }
}

/// The device layer from `configRequirements/read`: allowed sandbox modes and
/// approval policies. A granular approval policy is none of Inquello's
/// behaviours, so it allows none of them.
fn read_device_requirements(response: &ConfigRequirementsReadResponse) -> DeviceRequirements {
    let Some(requirements) = &response.requirements else {
        return DeviceRequirements::default();
    };
    DeviceRequirements {
        sandbox_modes: requirements.allowed_sandbox_modes.as_ref().map(|modes| {
            modes
                .iter()
                .map(|mode| match mode {
                    SandboxMode::ReadOnly => SandboxLevel::ReadOnly,
                    SandboxMode::WorkspaceWrite => SandboxLevel::WorkspaceWrite,
                    SandboxMode::DangerFullAccess => SandboxLevel::FullAccess,
                })
                .collect()
        }),
        approvals: requirements
            .allowed_approval_policies
            .as_ref()
            .map(|policies| {
                policies
                    .iter()
                    .filter_map(|policy| match policy {
                        AskForApproval::UnlessTrusted => Some(ApprovalBehaviour::Untrusted),
                        AskForApproval::OnRequest => Some(ApprovalBehaviour::OnRequest),
                        AskForApproval::Never => Some(ApprovalBehaviour::Never),
                        AskForApproval::Granular { .. } => None,
                    })
                    .collect()
            }),
    }
}

/// The user layer: the `User` layers of `config/read` (with layers), later
/// layers overriding earlier ones. Unknown or unset values constrain nothing.
fn read_user_config(response: &ConfigReadResponse) -> UserConfig {
    let mut user = UserConfig::default();
    for layer in response.layers.iter().flatten() {
        if !matches!(layer.name, ConfigLayerSource::User { .. }) || layer.disabled_reason.is_some()
        {
            continue;
        }
        let config = &layer.config;
        if let Some(level) = config["sandbox_mode"].as_str().and_then(|mode| match mode {
            "read-only" => Some(SandboxLevel::ReadOnly),
            "workspace-write" => Some(SandboxLevel::WorkspaceWrite),
            "danger-full-access" => Some(SandboxLevel::FullAccess),
            _ => None,
        }) {
            user.sandbox = Some(level);
        }
        if let Some(behaviour) =
            config["approval_policy"]
                .as_str()
                .and_then(|policy| match policy {
                    "untrusted" => Some(ApprovalBehaviour::Untrusted),
                    "on-request" => Some(ApprovalBehaviour::OnRequest),
                    "never" => Some(ApprovalBehaviour::Never),
                    _ => None,
                })
        {
            user.approval = Some(behaviour);
        }
        if let Some(network) = config["sandbox_workspace_write"]["network_access"].as_bool() {
            user.network = Some(network);
        }
    }
    user
}

fn source_view(source: SettingSource) -> InquelloPolicySource {
    InquelloPolicySource {
        kind: source.kind().to_string(),
        revision: source.revision().map(Revision::get),
    }
}

fn setting_view<T>(name: &str, setting: Setting<T>, value: &str) -> InquelloPolicySetting {
    InquelloPolicySetting {
        name: name.to_string(),
        value: value.to_string(),
        source: source_view(setting.source),
        restricted: setting.restricted,
    }
}

fn allowed(value: bool) -> &'static str {
    if value { "allowed" } else { "denied" }
}

fn permitted(value: bool) -> &'static str {
    if value { "permitted" } else { "not_permitted" }
}

fn settings_view(policy: &EffectivePolicy) -> Vec<InquelloPolicySetting> {
    vec![
        setting_view("sandbox", policy.sandbox, policy.sandbox.value.as_str()),
        setting_view("approval", policy.approval, policy.approval.value.as_str()),
        setting_view("network", policy.network, allowed(policy.network.value)),
        setting_view(
            "mcp_tools",
            policy.mcp_tools,
            allowed(policy.mcp_tools.value),
        ),
        setting_view(
            "extensions",
            policy.extensions,
            allowed(policy.extensions.value),
        ),
        setting_view(
            "allow_local_mcp_servers",
            policy.allow_local_mcp_servers,
            allowed(policy.allow_local_mcp_servers.value),
        ),
        setting_view(
            "full_access",
            policy.full_access,
            permitted(policy.full_access.value),
        ),
        setting_view(
            "no_prompt",
            policy.no_prompt,
            permitted(policy.no_prompt.value),
        ),
    ]
}

fn device_view(device: &DeviceRequirements) -> InquelloDeviceRequirements {
    InquelloDeviceRequirements {
        configured: device.configured(),
        sandbox_modes: device
            .sandbox_modes
            .as_ref()
            .map(|modes| modes.iter().map(|mode| mode.as_str().to_string()).collect()),
        approvals: device.approvals.as_ref().map(|approvals| {
            approvals
                .iter()
                .map(|behaviour| behaviour.as_str().to_string())
                .collect()
        }),
    }
}

/// The Capability Contract entries from the compiled register: the two Story
/// 1.18 lists as not enabled, and the Story 1.19 local execution sandbox
/// (OQ-13). Fail closed: a missing entry is listed as not enabled.
fn capability_contract() -> Vec<InquelloCapabilityContractEntry> {
    let register = inquello_domain::capability::CapabilityRegister::load_embedded().ok();
    [
        ("prompt_inspection", "Eligibility verification required before enablement"),
        ("specialist_cyber_access", "Eligibility verification required before enablement"),
        (
            "execution_sandbox",
            "Execution sandbox: local OS sandbox on this device; no hosted sandbox — V2 revisit (OQ-13)",
        ),
    ]
    .into_iter()
    .map(|(id, fallback)| {
        let entry = register.as_ref().and_then(|register| register.entry(id));
        InquelloCapabilityContractEntry {
            id: id.to_string(),
            enabled: inquello_domain::capability::enablement(id).is_enabled(),
            limits: entry.map_or_else(|| vec![fallback.to_string()], |entry| entry.limits.clone()),
        }
    })
    .collect()
}

fn task_policy(
    policy: &EffectivePolicy,
    broad: &execution_policy::TaskBroadMode,
    folder: Option<TaskFolder>,
) -> InquelloTaskPolicy {
    let recorded = broad.recorded();
    let status = BroadModeStatus::of(policy, recorded);
    let settings = execution_policy::thread_settings(policy, status);
    let reach = reach_view(&execution_policy::tool_reach(policy, status));
    let runtime_profile = folder
        .map(|folder| runtime_profile(&execution_policy::tool_profile(policy, status, folder)));
    InquelloTaskPolicy {
        reach,
        runtime_profile,
        broad_mode: InquelloTaskBroadMode {
            task_id: broad.task_id.to_string(),
            revision: broad.revision.get(),
            recorded: recorded.as_str().to_string(),
            status: status.kind().to_string(),
            effective_mode: status.effective_mode().as_str().to_string(),
            governing: match status {
                BroadModeStatus::Suspended { rule, .. } => Some(source_view(rule)),
                _ => None,
            },
            label: execution_policy::BROAD_MODE_LABEL.to_string(),
            reach: recorded.reach().to_string(),
        },
        thread_settings: InquelloThreadSettings {
            sandbox: match settings.sandbox {
                SandboxLevel::ReadOnly => "read-only",
                SandboxLevel::WorkspaceWrite => "workspace-write",
                SandboxLevel::FullAccess => "danger-full-access",
            }
            .to_string(),
            approval_policy: match settings.approval {
                ApprovalBehaviour::Untrusted => "untrusted",
                ApprovalBehaviour::OnRequest => "on-request",
                ApprovalBehaviour::Never => "never",
            }
            .to_string(),
            network_access: settings.network,
            mode: settings.mode.as_str().to_string(),
        },
    }
}

/// The writer the host attests. A human writer is the bound principal, so a
/// human actor may not carry a reference of its own.
fn state_writer(
    actor_kind: &str,
    actor_ref: Option<String>,
) -> Result<StateWriter, JSONRPCErrorError> {
    let invalid = |message: &str| refusal("invalid", message);
    match (state::ActorKind::parse(actor_kind), actor_ref) {
        (Some(state::ActorKind::Human), None) => Ok(StateWriter::Human),
        (Some(state::ActorKind::Human), Some(_)) => Err(invalid(
            "a human actor is the signed-in principal and takes no actor reference",
        )),
        (Some(state::ActorKind::Runtime), Some(reference)) => {
            Ok(StateWriter::Runtime { reference })
        }
        (Some(state::ActorKind::System), Some(reference)) => Ok(StateWriter::System { reference }),
        (Some(_), None) => Err(invalid(
            "a runtime or system actor needs an actor reference",
        )),
        (None, _) => Err(invalid("actor_kind must be human, runtime or system")),
    }
}

fn state_record_view(record: &state::StateRecord) -> InquelloStateRecord {
    InquelloStateRecord {
        dimension: record.dimension.as_str().to_string(),
        scope_kind: record.scope_kind.as_str().to_string(),
        scope_id: record.scope_id.clone(),
        value: record.value.to_string(),
        version: record.version,
        actor_kind: record.actor_kind.as_str().to_string(),
        actor_ref: record.actor_ref.clone(),
        recorded_at: record.recorded_at.unix_millis(),
        revision: record.revision.get(),
    }
}

/// Opens the store and initializes its `store_info` on first use.
async fn open_store(
    path: &std::path::Path,
    agent_writable_roots: &[PathBuf],
) -> Result<SqliteWorkingStore, JSONRPCErrorError> {
    let store = SqliteWorkingStore::open(path, agent_writable_roots)
        .await
        .map_err(|error| {
            tracing::error!("inquello working store did not open: {error}");
            refusal(
                "store_unavailable",
                "the Inquello working store could not be opened",
            )
        })?;
    let info = inquello_domain::get_store_info(&store)
        .await
        .map_err(domain_error)?;
    if info.is_none() {
        inquello_domain::initialize_store(
            &store,
            &SystemClock,
            InitializeStore {
                operation_id: format!("initialize-{}", uuid::Uuid::new_v4()),
                expected_revision: Revision::ZERO,
            },
        )
        .await
        .map_err(domain_error)?;
    }
    Ok(store)
}

fn engagement_view(engagement: &organise::Engagement) -> InquelloEngagement {
    InquelloEngagement {
        engagement_id: engagement.engagement_id.to_string(),
        workspace_id: engagement.workspace_id.to_string(),
        service_engagement_id: engagement.service_engagement_id.to_string(),
        name: engagement.name.clone(),
        objectives: engagement.objectives.clone(),
        scope: engagement.scope.clone(),
        client_entity: engagement.client_entity.clone(),
        period_start: engagement
            .period_start
            .as_ref()
            .map(|date| date.as_str().to_string()),
        period_end: engagement
            .period_end
            .as_ref()
            .map(|date| date.as_str().to_string()),
        revision: engagement.revision.get(),
    }
}

fn folder_view(folder: &organise::Folder) -> InquelloFolder {
    InquelloFolder {
        folder_id: folder.folder_id.to_string(),
        engagement_id: folder.engagement_id.to_string(),
        workspace_id: folder.workspace_id.to_string(),
        name: folder.name.clone(),
        revision: folder.revision.get(),
    }
}

/// Only current creator/Workspace ownership permits even an unavailable item ID.
fn private_task_tree_item(task:&organise::Task,actor:Actor,workspace:&str,available:bool)
    ->Option<Result<InquelloTask,codex_app_server_protocol::InquelloUnavailableTask>> {
    if task.creator_principal_id!=actor.principal_id || task.workspace_id.to_string()!=workspace {return None;}
    Some(if available {Ok(task_view(task))}else{Err(codex_app_server_protocol::InquelloUnavailableTask{task_id:task.task_id.to_string(),reason:"current_authority_unavailable".into()})})
}
fn task_view(task: &organise::Task) -> InquelloTask {
    InquelloTask {
        task_id: task.task_id.to_string(),
        workspace_id: task.workspace_id.to_string(),
        creator_principal_id: task.creator_principal_id.to_string(),
        engagement_id: task.engagement_id.map(|id| id.to_string()),
        folder_id: task.folder_id.map(|id| id.to_string()),
        title: task.title.clone(),
        runtime_thread_id: task.runtime_thread_id.clone(),
        source_refs: task.source_refs.clone(),
        artifact_refs: task.artifact_refs.clone(),
        visibility: match task.visibility {
            organise::Visibility::Private => InquelloTaskVisibility::Private,
        },
        revision: task.revision.get(),
    }
}

fn receipt_view(outcome: &OrganiseOutcome) -> InquelloReceipt {
    InquelloReceipt {
        operation_id: outcome.receipt.operation_id.to_string(),
        command: outcome.receipt.command.as_str().to_string(),
        expected_revision: outcome.receipt.expected_revision.get(),
        resulting_revision: outcome.receipt.resulting_revision.get(),
        replayed: outcome.replayed,
    }
}

fn engagement_response(
    outcome: &OrganiseOutcome,
) -> Result<InquelloEngagementResponse, JSONRPCErrorError> {
    let OrganiseRecord::Engagement(engagement) = &outcome.record else {
        return Err(unexpected_record());
    };
    Ok(InquelloEngagementResponse {
        engagement: engagement_view(engagement),
        receipt: receipt_view(outcome),
    })
}

fn task_response(outcome: &OrganiseOutcome) -> Result<InquelloTaskResponse, JSONRPCErrorError> {
    let OrganiseRecord::Task(task) = &outcome.record else {
        return Err(unexpected_record());
    };
    Ok(InquelloTaskResponse {
        task: task_view(task),
        receipt: receipt_view(outcome),
    })
}

fn unexpected_record() -> JSONRPCErrorError {
    failure(
        "store_failure",
        "the working store returned an unexpected record",
    )
}

fn refusal(kind: &str, message: &str) -> JSONRPCErrorError {
    JSONRPCErrorError {
        code: INVALID_REQUEST_ERROR_CODE,
        message: message.to_string(),
        data: Some(json!({ "inquello": { "kind": kind } })),
    }
}

fn failure(kind: &str, message: &str) -> JSONRPCErrorError {
    JSONRPCErrorError {
        code: INTERNAL_ERROR_CODE,
        message: message.to_string(),
        data: Some(json!({ "inquello": { "kind": kind } })),
    }
}

/// Maps a domain refusal to a JSON-RPC error. Messages carry no record content.
fn domain_error(error: DomainError) -> JSONRPCErrorError {
    match error {
        DomainError::InvalidCommand(message) => refusal("invalid", &message),
        DomainError::NotFound => {
            refusal("not_found", "no such record is visible to this principal")
        }
        DomainError::WorkspaceMismatch => refusal(
            "workspace_mismatch",
            "the target belongs to another Workspace",
        ),
        DomainError::RevisionConflict { expected, actual } => JSONRPCErrorError {
            code: INVALID_REQUEST_ERROR_CODE,
            message: format!("revision conflict: expected {expected}, actual {actual}"),
            data: Some(json!({
                "inquello": {
                    "kind": "revision_conflict",
                    "expected": expected.get(),
                    "actual": actual.get(),
                }
            })),
        },
        DomainError::OperationConflict { .. } => refusal(
            "operation_conflict",
            "the operation ID was already used for a different request",
        ),
        DomainError::HumanActorRequired => refusal(
            "human_actor_required",
            "this state can only be recorded by a person",
        ),
        DomainError::DimensionNotEnabled => refusal(
            "dimension_not_enabled",
            "this state dimension cannot be written yet",
        ),
        DomainError::InvalidValue => refusal(
            "invalid_value",
            "the value is not a state of this dimension",
        ),
        DomainError::BroadModeNotPermitted { rule } => JSONRPCErrorError {
            code: INVALID_REQUEST_ERROR_CODE,
            message: format!("broad_mode_not_permitted: governed by {rule}"),
            data: Some(json!({
                "inquello": {
                    "kind": "broad_mode_not_permitted",
                    "rule": rule.kind(),
                    "revision": rule.revision().map(Revision::get),
                }
            })),
        },
        DomainError::UserRuleCannotAllow => refusal(
            "user_rule_cannot_allow",
            "your own rules can only ask or forbid, never allow",
        ),
        DomainError::RequestNotPending => {
            refusal("request_not_pending", "This request is no longer pending")
        }
        DomainError::PermissionNotGranted => refusal(
            "permission_required",
            "no allowed permission request covers this action",
        ),
        DomainError::AlreadyInitialized | DomainError::Store(_) => {
            tracing::error!("inquello working store failure: {error}");
            failure("store_failure", "the Inquello working store failed")
        }
    }
}

#[cfg(test)]
#[path = "inquello_processor_tests.rs"]
mod tests;

#[cfg(all(feature = "inference-fixtures", debug_assertions))]
impl InquelloRequestProcessor {
    pub(crate) fn fixture_principal(&self, connection: ConnectionId) -> Result<String, JSONRPCErrorError> {
        self.actor(connection).map(|actor| actor.principal_id.to_string())
    }
}
