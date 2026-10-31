#![recursion_limit = "256"]

use clap::Parser;
use codex_app_server::AppServerCodeModeHostArgs;
use codex_app_server::AppServerRuntimeOptions;
use codex_app_server::AppServerTransport;
use codex_app_server::PluginStartupTasks;
use codex_app_server::run_main_with_transport_options;
use codex_arg0::Arg0DispatchPaths;
use codex_arg0::arg0_dispatch_or_else;
use codex_config::LoaderOverrides;
use codex_protocol::protocol::SessionSource;
use codex_utils_cli::CliConfigOverrides;
use codex_websocket_auth::WebsocketAuthArgs;
use std::path::PathBuf;

#[cfg(all(
    target_os = "linux",
    target_env = "musl",
    any(target_arch = "x86_64", target_arch = "aarch64")
))]
#[global_allocator]
static ALLOCATOR: tikv_jemallocator::Jemalloc = tikv_jemallocator::Jemalloc;

// Debug-only test hook: lets integration tests point the server at a temporary
// managed config file without writing to /etc.
const MANAGED_CONFIG_PATH_ENV_VAR: &str = "CODEX_APP_SERVER_MANAGED_CONFIG_PATH";
const DISABLE_MANAGED_CONFIG_ENV_VAR: &str = "CODEX_APP_SERVER_DISABLE_MANAGED_CONFIG";

#[derive(Debug, Parser)]
#[command(version)]
struct AppServerArgs {
    /// Read-only, quiescent native data provenance inspection; bounded JSON stdin/stdout.
    #[arg(long, hide = true)]
    inquello_data_inspect: bool,
    /// Load frozen cloud skills from a JSON snapshot instead of a live skill service.
    #[arg(long, value_name = "PATH")]
    cloud_skills_snapshot: Option<PathBuf>,
    #[command(flatten)]
    config_overrides: CliConfigOverrides,

    #[command(flatten)]
    code_mode_host: AppServerCodeModeHostArgs,

    /// Transport endpoint URL. Supported values: `stdio://` (default),
    /// `unix://`, `unix://PATH`, `ws://IP:PORT`, `off`.
    #[arg(
        long = "listen",
        value_name = "URL",
        default_value = AppServerTransport::DEFAULT_LISTEN_URL
    )]
    listen: AppServerTransport,

    /// Session source used to derive product restrictions and metadata.
    #[arg(
        long = "session-source",
        value_name = "SOURCE",
        default_value = "vscode",
        value_parser = SessionSource::from_startup_arg
    )]
    session_source: SessionSource,

    #[command(flatten)]
    auth: WebsocketAuthArgs,

    /// Fail if config.toml contains unknown configuration fields.
    #[arg(long = "strict-config", default_value_t = false)]
    strict_config: bool,

    /// Hidden debug-only test hook used by integration tests that spawn the
    /// production app-server binary.
    #[cfg(debug_assertions)]
    #[arg(long = "disable-plugin-startup-tasks-for-tests", hide = true)]
    disable_plugin_startup_tasks_for_tests: bool,

    /// Enable remote control for this app-server process without changing persistence.
    #[arg(long = "remote-control", hide = true)]
    remote_control: bool,

    /// Save loaded threads during managed daemon shutdown.
    #[arg(long, hide = true)]
    managed_daemon: bool,
}

fn main() -> anyhow::Result<()> {
    let remote_control_disabled = codex_app_server::take_remote_control_disabled_env();
    // Inquello (Story 1.14): keep the working-store path out of every child's environment.
    codex_app_server::take_inquello_working_store_env();
    arg0_dispatch_or_else(move |arg0_paths: Arg0DispatchPaths| async move {
        let AppServerArgs {
            inquello_data_inspect,
            cloud_skills_snapshot,
            config_overrides,
            code_mode_host,
            listen,
            session_source,
            auth,
            strict_config,
            #[cfg(debug_assertions)]
            disable_plugin_startup_tasks_for_tests,
            remote_control,
            managed_daemon,
        } = AppServerArgs::parse();
        if inquello_data_inspect {
            use std::io::Read;
            let mut input = Vec::new();
            std::io::stdin().take(65_537).read_to_end(&mut input)?;
            anyhow::ensure!(input.len() <= 65_536, "inspection request exceeds bound");
            let request = serde_json::from_slice(&input)?;
            let response = inspect_native_data(request).await;
            println!("{}", serde_json::to_string(&response)?);
            return Ok(());
        }
        let loader_overrides = if disable_managed_config_from_debug_env() {
            LoaderOverrides::without_managed_config_for_tests()
        } else {
            managed_config_path_from_debug_env()
                .map(LoaderOverrides::with_managed_config_path_for_tests)
                .unwrap_or_default()
        };
        let transport = listen;
        let auth = auth.try_into_settings()?;
        let mut runtime_options = AppServerRuntimeOptions {
            cloud_skills_snapshot,
            code_mode_host_transport: code_mode_host.into(),
            managed_daemon,
            ..Default::default()
        };
        #[cfg(debug_assertions)]
        if disable_plugin_startup_tasks_for_tests {
            runtime_options.plugin_startup_tasks = PluginStartupTasks::Skip;
        }
        runtime_options.remote_control_startup_mode =
            match (remote_control, remote_control_disabled) {
                (true, _) => codex_app_server::RemoteControlStartupMode::EnabledEphemeral,
                (false, true) => codex_app_server::RemoteControlStartupMode::DisabledEphemeral,
                (false, false) => codex_app_server::RemoteControlStartupMode::ResolvePersisted,
            };

        let exit = run_main_with_transport_options(
            arg0_paths,
            config_overrides,
            loader_overrides,
            strict_config,
            /*default_analytics_enabled*/ false,
            transport,
            session_source,
            auth,
            runtime_options,
        )
        .await?;
        if exit == codex_app_server::AppServerExit::Forced {
            // Runtime teardown can wait forever for blocked rollout I/O.
            std::process::exit(0);
        }
        Ok(())
    })
}

fn disable_managed_config_from_debug_env() -> bool {
    #[cfg(debug_assertions)]
    {
        if let Ok(value) = std::env::var(DISABLE_MANAGED_CONFIG_ENV_VAR) {
            return matches!(value.as_str(), "1" | "true" | "TRUE" | "yes" | "YES");
        }
    }

    false
}

fn managed_config_path_from_debug_env() -> Option<PathBuf> {
    #[cfg(debug_assertions)]
    {
        if let Ok(value) = std::env::var(MANAGED_CONFIG_PATH_ENV_VAR) {
            return if value.is_empty() {
                None
            } else {
                Some(PathBuf::from(value))
            };
        }
    }

    None
}

#[cfg(test)]
#[path = "main_tests.rs"]
mod tests;

// Production has no caller-supplied evidence or eligibility toggle. The private
// lookup seam is used only by native composition unit fixtures below.
async fn inspect_native_data(request: inquello_adapters::data_provenance::InspectRequest)
    -> inquello_adapters::data_provenance::InspectResponse
{
    inspect_native_data_with_evidence(request, inquello_domain::routes::compiled_evidence_for_identity).await
}
async fn inspect_native_data_with_evidence(
    request: inquello_adapters::data_provenance::InspectRequest,
    evidence: impl Fn(&inquello_domain::routes::RouteEvidenceIdentity) -> Option<inquello_domain::routes::NegativeAuthorizationEvidence>,
) -> inquello_adapters::data_provenance::InspectResponse {
    let mut response = inquello_adapters::data_provenance::inspect(request).await;
    for workspace in &mut response.workspaces { for task in &mut workspace.tasks {
        if task.data_tier != "real" { continue; }
        let Some(configuration)=task.route_configuration.clone().and_then(|input|inquello_domain::routes::RouteConfiguration::parse(input).ok()) else {response.available=false;continue;};
        let identity=inquello_domain::routes::RouteEvidenceIdentity {
            route_id:configuration.route_id().as_str().into(),deployment:configuration.deployment().into(),endpoint:configuration.endpoint().into(),
            model:configuration.model().into(),api_version:configuration.api_version().into(),configuration_digest:inquello_domain::routes::configuration_digest(&configuration),
            implementation_digest:env!("INQUELLO_BEHAVIOR_DIGEST").into(),runtime_version:env!("CARGO_PKG_VERSION").into(),
            contract_version:format!("inquello-v{}-authorization-v1",inquello_protocol::PROTOCOL_MAJOR),platform:env!("INQUELLO_BUILD_PLATFORM").into(),
        };
        let Some(proof)=evidence(&identity) else {response.available=false;continue;};
        if !proof.complete() || proof.identity != identity || proof.data_policy_digest != env!("INQUELLO_DATA_POLICY_DIGEST") {response.available=false;continue;}
        task.route_identity=Some(identity);task.report_digest=Some(proof.report_digest);task.processing_scope=Some(proof.processing_scope);task.data_policy_digest=Some(proof.data_policy_digest);
    }}
    if !response.available {response.files.clear();response.workspaces.clear();response.reason=Some("Native ownership, current build evidence or data policy unavailable; recovery/export remains quarantined".into());}
    response
}

#[cfg(test)]
#[path = "main_inspection_tests.rs"]
mod inspection_composition_tests;
