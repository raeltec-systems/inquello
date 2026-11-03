//! Windows policy authority / dedicated Linux executor seam. No host paths or
//! inherited environment enter the executor's sandbox policy.
use crate::outgoing_message::{ConnectionId, ConnectionRequestId, OutgoingMessageSender};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;
use tokio_util::sync::CancellationToken;

use anyhow::Context;
use anyhow::bail;
use codex_app_server_protocol::CommandExecResponse;
use codex_exec_server::ExecServerClient;
use codex_exec_server::FileSystemSandboxContext;
use codex_exec_server_protocol::ExecOutputStream;
use codex_exec_server_protocol::ExecParams;
use codex_exec_server_protocol::ProcessId;
use codex_exec_server_protocol::ProcessSandboxType;
use codex_exec_server_protocol::ReadParams;
use codex_network_proxy::NetworkProxyConfig;
use codex_network_proxy::RemoteNetworkProxyConfig;
use codex_network_proxy::RemoteNetworkProxyLaunchConfig;
use codex_protocol::models::ManagedFileSystemPermissions;
use codex_protocol::models::PermissionProfile;
use codex_protocol::permissions::FileSystemAccessMode;
use codex_protocol::permissions::FileSystemPath;
use codex_protocol::permissions::FileSystemSandboxEntry;
use codex_protocol::permissions::FileSystemSpecialPath;
use codex_protocol::permissions::NetworkSandboxPolicy;
use codex_utils_path_uri::PathUri;
use sha2::Digest;
use sha2::Sha256;

const GUEST_BIN: &str = "/opt/inquello/runtime/bin";
const HOST_TEMP: &str = "D:\\Inquello\\tmp";

#[derive(Clone, Default)]
pub(crate) struct WslExecManager {
    active: Arc<tokio::sync::Mutex<HashMap<(ConnectionId, String), CancellationToken>>>,
}

impl WslExecManager {
    pub(crate) async fn start(
        &self,
        request: ConnectionRequestId,
        plan: WslExecPlan,
        outgoing: Arc<OutgoingMessageSender>,
        cancellation: CancellationToken,
        usage: crate::request_processors::ToolUsage,
    ) -> anyhow::Result<()> {
        if !matches!(plan.timeout_ms, None | Some(1..=120_000)) {
            bail!("timeout must be between 1 and 120000 milliseconds");
        }
        let key = (request.connection_id, plan.task_id.clone());
        let mut active = self.active.lock().await;
        if active.contains_key(&key) {
            bail!("Task already has a running workload");
        }
        active.insert(key.clone(), cancellation.clone());
        drop(active);
        let manager = self.clone();
        tokio::spawn(async move {
            let result = {
                let monitor = async {
                    loop {
                        if usage.recheck().await.is_err() {
                            cancellation.cancel();
                            break;
                        }
                        tokio::time::sleep(Duration::from_millis(250)).await;
                    }
                };
                if usage.recheck().await.is_err() {
                    Err(anyhow::anyhow!("Task authority changed before execution"))
                } else {
                    let execute = plan.execute(cancellation.clone());
                    tokio::pin!(execute);
                    tokio::select! {
                        result = &mut execute => result,
                        _ = monitor => execute.await,
                    }
                }
            };
            usage
                .finish(match &result {
                    Ok(response) if response.exit_code == 0 => {
                        inquello_domain::usage::AttemptStatus::Completed
                    }
                    Ok(_) => inquello_domain::usage::AttemptStatus::Failed,
                    Err(_) => inquello_domain::usage::AttemptStatus::Uncertain,
                })
                .await;
            manager.active.lock().await.remove(&key);
            match result {
                Ok(response) => outgoing.send_response(request, response).await,
                Err(error) => {
                    tracing::warn!("Inquello Linux execution failed: {error:#}");
                    outgoing
                        .send_error(
                            request,
                            codex_app_server_protocol::JSONRPCErrorError {
                                code: crate::error_code::INTERNAL_ERROR_CODE,
                                message: "Linux execution unavailable; no fallback was attempted"
                                    .into(),
                                data: Some(serde_json::json!({"kind": "execution_unavailable"})),
                            },
                        )
                        .await;
                }
            }
        });
        Ok(())
    }
    pub(crate) async fn connection_closed(&self, connection: ConnectionId) {
        for ((id, _), cancellation) in self.active.lock().await.iter() {
            if *id == connection {
                cancellation.cancel();
            }
        }
    }
}

struct CloseExecutor(ExecServerClient);
impl Drop for CloseExecutor {
    fn drop(&mut self) {
        let client = self.0.clone();
        tokio::spawn(async move {
            client.close_isolated_stdio().await;
        });
    }
}

#[derive(Clone)]
pub(crate) struct WslExecPlan {
    pub scope: String,
    pub task_id: String,
    pub command: Vec<String>,
    pub writable: bool,
    pub domains: Vec<String>,
    pub timeout_ms: Option<i64>,
}

/// Profiles and signed-in accounts must never enumerate each other's guest
/// data. This stable opaque key is also used by the main-process transfer broker.
pub(crate) fn scope_key(task_parent: &Path, principal: &str) -> anyhow::Result<String> {
    let canonical = std::fs::canonicalize(task_parent)?;
    let normalized = canonical
        .to_string_lossy()
        .replace('\\', "/")
        .trim_start_matches("//?/")
        .to_lowercase();
    Ok(format!(
        "{:x}",
        Sha256::digest(format!("{normalized}\0{principal}"))
    ))
}

pub(crate) fn require_windows_binding(task_root: &Path, principal: &str) -> anyhow::Result<()> {
    let scope = scope_key(
        task_root.parent().context("Task parent missing")?,
        principal,
    )?;
    let task = task_root
        .file_name()
        .and_then(|s| s.to_str())
        .context("Task id missing")?;
    uuid::Uuid::parse_str(task)?;
    let binding = Path::new("D:\\Inquello\\profiles")
        .join(&scope)
        .join("bindings")
        .join(format!("{task}.json"));
    match std::fs::read(binding) {
        Ok(bytes) => {
            let state: serde_json::Value = serde_json::from_slice(&bytes)?;
            if state["version"] != 1
                || state["scope"] != scope
                || state["taskId"] != task
                || state["backend"] != "windows"
                || state["state"] != "ready"
            {
                bail!("Verified Windows Task file transition required");
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(error.into()),
    }
    Ok(())
}

fn uri(path: &str) -> anyhow::Result<PathUri> {
    Ok(format!("file://{path}").parse()?)
}

/// Only synchronous validation or fully completed successful setup probes prove
/// no outstanding process. Cancellation and uncertain subprocess outcomes do not.
#[derive(Clone, Copy, Default, PartialEq, Eq)]
pub(crate) enum ModelSetupPhase {
    NoOutstandingProcess,
    #[default]
    UnconfirmedResourceAttempt,
}

/// Runs only fixed synchronous setup probes, never an executor. Successful exit
/// proves this probe completed; timeout, cancellation, write/wait failure and
/// nonzero exit retain uncertainty. A failed spawn proves no child was created.
async fn run_model_setup_probe(
    process: &mut tokio::process::Command,
    phase: &mut ModelSetupPhase,
    input: Option<&[u8]>,
    budget: Duration,
) -> anyhow::Result<std::process::Output> {
    process.kill_on_drop(true);
    let mut child = match process.spawn() {
        Ok(child) => child,
        Err(error) => {
            *phase = ModelSetupPhase::NoOutstandingProcess;
            return Err(error.into());
        }
    };
    *phase = ModelSetupPhase::UnconfirmedResourceAttempt;
    let wait = async move {
        if let Some(input) = input {
            use tokio::io::AsyncWriteExt;
            child
                .stdin
                .take()
                .context("Broker input missing")?
                .write_all(input)
                .await?;
        }
        Ok::<_, anyhow::Error>(child.wait_with_output().await?)
    };
    let output = tokio::time::timeout(budget, wait)
        .await
        .context("Setup probe timed out")??;
    if output.status.success() {
        *phase = ModelSetupPhase::NoOutstandingProcess;
    }
    Ok(output)
}

async fn verified_boot_id(scope: &str) -> anyhow::Result<String> {
    verified_boot_id_tracked(scope, None).await
}

async fn verified_boot_id_tracked(
    scope: &str,
    phase: Option<&mut ModelSetupPhase>,
) -> anyhow::Result<String> {
    use base64::Engine;
    let system = std::env::var("SystemRoot")?;
    let profile = std::env::var("USERPROFILE")?;
    let bytes: Vec<u8> = include_str!("inquello_wsl_preflight.ps1")
        .encode_utf16()
        .flat_map(u16::to_le_bytes)
        .collect();
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    let mut process = tokio::process::Command::from(codex_utils_process::background_command(
        format!("{system}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"),
    ));
    process
        .env_clear()
        .env("SystemRoot", &system)
        .env("WINDIR", &system)
        .env("USERPROFILE", profile)
        .env("INQUELLO_WSL_SCOPE", scope)
        .env("TEMP", HOST_TEMP)
        .env("TMP", HOST_TEMP)
        .current_dir(HOST_TEMP)
        .args(["-NoProfile", "-NonInteractive", "-EncodedCommand", &encoded])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);
    let mut untracked = ModelSetupPhase::default();
    let result = run_model_setup_probe(
        &mut process,
        phase.unwrap_or(&mut untracked),
        None,
        Duration::from_secs(15),
    )
    .await
    .context("Windows D-only storage preflight could not complete")?;
    if !result.status.success() {
        bail!("D-only WSL host preflight failed");
    }
    let boot = String::from_utf8(result.stdout)?.trim().to_string();
    uuid::Uuid::parse_str(&boot)?;
    Ok(boot)
}

// The idle broker verifies all installed binaries before acquiring any lock.
// Measured full verification takes ~15s; allow the existing 10s scope-lock
// bound plus 5s launch/response overhead. No startup limit or trust check changes.
const LOCK_RELEASE_PROBE_BUDGET: Duration = Duration::from_secs(30);
// All retries share one envelope: close 5s + host verification 15s + probe 30s.
const EXECUTOR_CLEANUP_BUDGET: Duration = Duration::from_secs(50);
pub(crate) const EXECUTOR_RETIREMENT_WAIT: Duration =
    Duration::from_secs(EXECUTOR_CLEANUP_BUDGET.as_secs() + 5);

async fn within_cleanup_budget<T>(
    cleanup: impl std::future::Future<Output = anyhow::Result<T>>,
    budget: Duration,
) -> anyhow::Result<T> {
    tokio::time::timeout(budget, cleanup)
        .await
        .context("Linux Task executor cleanup deadline elapsed; retirement unconfirmed")?
}

async fn wait_for_lock_release_probe<T>(
    wait: impl std::future::Future<Output = std::io::Result<T>>,
    budget: Duration,
) -> anyhow::Result<T> {
    tokio::time::timeout(budget, wait)
        .await
        .context("Linux Task lock-release probe timed out")?
        .context("Linux Task lock-release probe could not complete")
}

impl WslExecPlan {
    pub(crate) async fn close_and_wait(&self, client: &ExecServerClient) -> anyhow::Result<()> {
        within_cleanup_budget(self.close_and_wait_inner(client), EXECUTOR_CLEANUP_BUDGET).await
    }

    async fn close_and_wait_inner(&self, client: &ExecServerClient) -> anyhow::Result<()> {
        tokio::time::timeout(Duration::from_secs(5), client.close_isolated_stdio())
            .await
            .context("Linux executor stdio close timed out")?;
        let boot = verified_boot_id(&self.scope).await?;
        let system = std::env::var("SystemRoot")?;
        for _ in 0..20 {
            let mut process = tokio::process::Command::from(
                codex_utils_process::background_command(format!("{system}\\System32\\wsl.exe")),
            );
            process
                .env_clear()
                .env("SystemRoot", &system)
                .env("WINDIR", &system)
                .env("TEMP", HOST_TEMP)
                .env("TMP", HOST_TEMP)
                .current_dir(HOST_TEMP)
                .args([
                    "-d",
                    "Inquello-Engine",
                    "--user",
                    "inquello",
                    "--cd",
                    "/",
                    "--exec",
                    "/usr/bin/env",
                    "-i",
                    "PATH=/usr/bin:/bin",
                    "LANG=C.UTF-8",
                    "/usr/bin/python3",
                    "-I",
                    "/usr/local/libexec/inquello-broker.py",
                    "transfer",
                    &self.scope,
                    &self.task_id,
                    &boot,
                ])
                .stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .kill_on_drop(true);
            let mut child = process.spawn()?;
            use tokio::io::AsyncWriteExt;
            child
                .stdin
                .take()
                .context("Broker input missing")?
                .write_all(b"{\"action\":\"idle\"}")
                .await?;
            // Expiry drops the owned wait future and its kill_on_drop child.
            let result =
                wait_for_lock_release_probe(child.wait_with_output(), LOCK_RELEASE_PROBE_BUDGET)
                    .await?;
            if result.status.success() {
                return Ok(());
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
        bail!("Executor stopped but Task lock release could not be confirmed")
    }
    /// Native model-Task setup may initialize a newly reserved empty Task.
    /// Nonempty legacy data requires the verified desktop migration broker.
    pub(crate) async fn prepare_model(
        host_root: &Path,
        principal: &str,
        writable: bool,
        domains: Vec<String>,
        phase: &mut ModelSetupPhase,
    ) -> anyhow::Result<Self> {
        let task_id = host_root
            .file_name()
            .and_then(|s| s.to_str())
            .context("Task identity missing")?
            .to_string();
        uuid::Uuid::parse_str(&task_id)?;
        let scope = scope_key(
            host_root.parent().context("Task parent missing")?,
            principal,
        )?;
        let plan = Self {
            scope,
            task_id,
            command: vec![],
            writable,
            domains,
            timeout_ms: None,
        };
        let boot = verified_boot_id_tracked(&plan.scope, Some(phase)).await?;
        let binding_dir = Path::new("D:\\Inquello\\profiles")
            .join(&plan.scope)
            .join("bindings");
        let binding = binding_dir.join(format!("{}.json", plan.task_id));
        // Discovery locator only: account authority remains the authenticated
        // principal and its derived scope, never this metadata.
        std::fs::create_dir_all(&binding_dir)?;
        let locator = binding_dir
            .parent()
            .context("Profile directory missing")?
            .join("profile.json");
        let profile_key = scope_key(host_root.parent().context("Task parent missing")?, "")?;
        let metadata = serde_json::to_vec(
            &serde_json::json!({"version":1,"scope":plan.scope,"taskParentKey":profile_key}),
        )?;
        match std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&locator)
        {
            Ok(mut file) => {
                use std::io::Write;
                file.write_all(&metadata)?;
                file.sync_all()?;
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                let existing: serde_json::Value =
                    serde_json::from_slice(&std::fs::read(&locator)?)?;
                if existing["version"] != 1
                    || existing["scope"] != plan.scope
                    || existing["taskParentKey"] != profile_key
                {
                    bail!("Invalid desktop profile locator");
                }
            }
            Err(error) => return Err(error.into()),
        }
        if !binding.exists() {
            for child in std::fs::read_dir(host_root)? {
                let child = child?;
                let metadata = std::fs::symlink_metadata(child.path())?;
                if child.file_name() != "output"
                    || !metadata.is_dir()
                    || metadata.file_type().is_symlink()
                    || std::fs::read_dir(child.path())?.next().is_some()
                {
                    bail!("Existing Task files require verified migration to Linux");
                }
            }
            let system = std::env::var("SystemRoot")?;
            let mut child = tokio::process::Command::from(codex_utils_process::background_command(
                format!("{system}\\System32\\wsl.exe"),
            ));
            child
                .env_clear()
                .env("SystemRoot", &system)
                .env("WINDIR", &system)
                .env("TEMP", HOST_TEMP)
                .env("TMP", HOST_TEMP)
                .current_dir(HOST_TEMP)
                .args([
                    "-d",
                    "Inquello-Engine",
                    "--user",
                    "inquello",
                    "--cd",
                    "/",
                    "--exec",
                    "/usr/bin/env",
                    "-i",
                    "PATH=/usr/bin:/bin",
                    "LANG=C.UTF-8",
                    "/usr/bin/python3",
                    "-I",
                    "/usr/local/libexec/inquello-broker.py",
                    "transfer",
                    &plan.scope,
                    &plan.task_id,
                    &boot,
                ])
                .stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .kill_on_drop(true);
            let result = run_model_setup_probe(
                &mut child,
                phase,
                Some(b"{\"action\":\"initialize\"}"),
                Duration::from_secs(30),
            )
            .await
            .context("Linux empty Task initialization could not complete")?;
            if !result.status.success() {
                bail!(
                    "Empty Task guest initialization failed: {}",
                    String::from_utf8_lossy(&result.stderr)
                );
            }
            // The initialize action creates directories synchronously, holds its
            // locks only for this broker process, and starts no executor/children.
            std::fs::create_dir_all(&binding_dir)?;
            let temporary = binding_dir.join(format!("{}.tmp", uuid::Uuid::new_v4()));
            let mut file = std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temporary)?;
            use std::io::Write;
            file.write_all(&serde_json::to_vec(&serde_json::json!({"version":1,"scope":plan.scope,"taskId":plan.task_id,"backend":"linux","state":"ready","transaction":"empty-task-initialization"}))?)?;
            file.sync_all()?;
            std::fs::rename(temporary, binding)?;
        }
        Ok(plan)
    }

    pub(crate) fn environment_config(
        &self,
    ) -> anyhow::Result<codex_protocol::protocol::EnvironmentConfig> {
        Ok(codex_protocol::protocol::EnvironmentConfig {
            environment_hooks: Default::default(),
            allow_login_shell: false,
            workspace_roots: vec![uri(&self.root())?],
            permission_profile: codex_protocol::models::PermissionProfileSnapshot::legacy(
                self.sandbox()?.permissions,
            ),
            shell_environment_policy: codex_protocol::config_types::ShellEnvironmentPolicy {
                inherit: codex_protocol::config_types::ShellEnvironmentPolicyInherit::None,
                r#set: HashMap::from([
                    ("PATH".into(), "/usr/bin:/bin".into()),
                    ("HOME".into(), self.root()),
                    ("LANG".into(), "C.UTF-8".into()),
                    ("TMPDIR".into(), "/tmp".into()),
                ]),
                ignore_default_excludes: false,
                ..Default::default()
            },
            windows_sandbox_level: codex_protocol::config_types::WindowsSandboxLevel::Disabled,
            windows_sandbox_type: codex_protocol::sandbox::SandboxType::None,
            use_legacy_landlock: false,
            exec_policy: None,
            mcp_policy: None,
            network_policy: Some(codex_network_proxy::EnvironmentNetworkPolicy::from_config(
                &self.network_config()?,
                true,
            )),
            selected_capability_roots: vec![],
        })
    }

    pub(crate) fn root(&self) -> String {
        format!("/var/lib/inquello/tasks/{}/{}", self.scope, self.task_id)
    }

    pub(crate) fn sandbox(&self) -> anyhow::Result<FileSystemSandboxContext> {
        let root = self.root();
        let mut entries = vec![FileSystemSandboxEntry::new(
            FileSystemPath::Special {
                value: FileSystemSpecialPath::Minimal,
            },
            FileSystemAccessMode::Read,
        )];
        for name in ["codex", "codex-linux-sandbox", "bwrap"] {
            entries.push(FileSystemSandboxEntry::new(
                FileSystemPath::Path {
                    path: uri(&format!("{GUEST_BIN}/{name}"))?,
                },
                FileSystemAccessMode::Read,
            ));
        }
        entries.push(FileSystemSandboxEntry::new(
            FileSystemPath::Path { path: uri(&root)? },
            if self.writable {
                FileSystemAccessMode::Write
            } else {
                FileSystemAccessMode::Read
            },
        ));
        for hidden in [
            "/usr/lib/modules",
            "/usr/src",
            "/usr/lib/linux-tools",
            "/usr/lib/wsl",
        ] {
            entries.push(FileSystemSandboxEntry::new(
                FileSystemPath::Path { path: uri(hidden)? },
                FileSystemAccessMode::Deny,
            ));
        }
        Ok(FileSystemSandboxContext::from_permission_profile(
            PermissionProfile::Managed {
                file_system: ManagedFileSystemPermissions::Restricted {
                    entries,
                    glob_scan_max_depth: None,
                },
                network: NetworkSandboxPolicy::Restricted,
            },
            uri(&root)?,
        ))
    }

    fn network_config(&self) -> anyhow::Result<NetworkProxyConfig> {
        let domains: serde_json::Map<String, serde_json::Value> = self
            .domains
            .iter()
            .map(|domain| (domain.clone(), serde_json::json!("allow")))
            .collect();
        let config: NetworkProxyConfig = serde_json::from_value(serde_json::json!({
            "enabled": true, "domains": domains, "enable_socks5": false,
            "enable_socks5_udp": false, "allow_upstream_proxy": false,
            "dangerously_allow_all_unix_sockets": false, "allow_local_binding": false,
            "credential_broker": false, "mitm": false
        }))?;
        Ok(config)
    }

    fn network(&self) -> anyhow::Result<RemoteNetworkProxyLaunchConfig> {
        Ok(RemoteNetworkProxyLaunchConfig::new(
            RemoteNetworkProxyConfig::from_effective_config(&self.network_config()?)?,
        ))
    }

    /// The fixed launcher validates the live guest before it opens stdio. It
    /// holds a per-Task lock until all executor-owned descendants have exited.
    pub(crate) async fn connect(&self) -> anyhow::Result<ExecServerClient> {
        self.connect_tracked(&mut ModelSetupPhase::default()).await
    }

    pub(crate) async fn connect_tracked(
        &self,
        phase: &mut ModelSetupPhase,
    ) -> anyhow::Result<ExecServerClient> {
        if !cfg!(windows) {
            bail!("the WSL backend requires Windows");
        }
        if self.scope.len() != 64 || !self.scope.bytes().all(|b| b.is_ascii_hexdigit()) {
            bail!("invalid execution scope");
        }
        uuid::Uuid::parse_str(&self.task_id)?;
        let binding = Path::new("D:\\Inquello\\profiles")
            .join(&self.scope)
            .join("bindings")
            .join(format!("{}.json", self.task_id));
        let state: serde_json::Value = serde_json::from_slice(
            &std::fs::read(binding).context("Task files have not been transferred to Linux")?,
        )?;
        if state["backend"] != "linux"
            || state["state"] != "ready"
            || state["scope"] != self.scope
            || state["taskId"] != self.task_id
        {
            bail!("Task transfer is incomplete or belongs to another backend");
        }
        // A trusted main-process preflight supplies this receipt only after a
        // live storage/isolation probe. The launcher independently checks its
        // boot identity, mounts and immutable installed binary hashes.
        let boot_id = verified_boot_id_tracked(&self.scope, Some(phase)).await?;
        let system = std::env::var("SystemRoot").context("Windows system directory missing")?;
        let env = HashMap::from([
            ("SystemRoot".into(), system.clone()),
            ("WINDIR".into(), system.clone()),
            ("PATH".into(), format!("{system}\\System32")),
            ("TEMP".into(), HOST_TEMP.into()),
            ("TMP".into(), HOST_TEMP.into()),
            ("TMPDIR".into(), HOST_TEMP.into()),
        ]);
        let args = [
            "--distribution",
            "Inquello-Engine",
            "--user",
            "inquello",
            "--cd",
            "/",
            "--exec",
            "/usr/bin/env",
            "-i",
            "PATH=/usr/bin:/bin",
            "LANG=C.UTF-8",
            "/usr/local/libexec/inquello-executor",
            &self.scope,
            &self.task_id,
            &boot_id,
            if self.writable { "write" } else { "read" },
        ]
        .into_iter()
        .map(str::to_owned)
        .collect();
        let client = ExecServerClient::connect_isolated_stdio_tracked(
            format!("{system}\\System32\\wsl.exe"),
            args,
            env,
            HOST_TEMP.into(),
            Duration::from_secs(30),
            || *phase = ModelSetupPhase::UnconfirmedResourceAttempt,
        )
        .await
        .context("Linux isolated executor connection failed")?;
        Ok(client)
    }

    pub(crate) async fn execute(
        self,
        cancellation: CancellationToken,
    ) -> anyhow::Result<CommandExecResponse> {
        let client = self.connect().await?;
        let _close = CloseExecutor(client.clone());
        let process_id = ProcessId::new(uuid::Uuid::new_v4().to_string());
        let root = self.root();
        let launch = client.exec(ExecParams {
            process_id: process_id.clone(),
            metadata: None,
            argv: self.command.clone(),
            cwd: uri(&root)?,
            env_policy: None,
            shell_snapshot: None,
            env: HashMap::from([
                ("PATH".into(), "/usr/bin:/bin".into()),
                ("HOME".into(), root.clone()),
                ("TMPDIR".into(), "/tmp".into()),
                ("LANG".into(), "C.UTF-8".into()),
            ]),
            tty: false,
            pipe_stdin: false,
            arg0: None,
            sandbox: Some(self.sandbox()?),
            enforce_managed_network: true,
            managed_network: None,
            network_proxy: Some(self.network()?),
        });
        let result = tokio::select! {
            _ = cancellation.cancelled() => bail!("Linux workload cancelled before launch"),
            result = tokio::time::timeout(Duration::from_secs(30), launch) => result.context("executor launch timed out")??,
        };
        if result.sandbox_type != Some(ProcessSandboxType::LinuxSeccomp) {
            let _ = client.terminate(&process_id).await;
            bail!("executor did not enforce the required Linux sandbox");
        }
        let run = async {
            let mut stdout = Vec::new();
            let mut stderr = Vec::new();
            let mut seq = None;
            loop {
                let read = client
                    .read(ReadParams {
                        process_id: process_id.clone(),
                        after_seq: seq,
                        max_bytes: Some(64 * 1024),
                        wait_ms: Some(1000),
                    })
                    .await?;
                seq = read.next_seq.checked_sub(1).or(seq);
                let drained = read.chunks.is_empty();
                for chunk in read.chunks {
                    let target = match chunk.stream {
                        ExecOutputStream::Stdout | ExecOutputStream::Pty => &mut stdout,
                        ExecOutputStream::Stderr => &mut stderr,
                    };
                    let remaining = (1024 * 1024usize).saturating_sub(target.len());
                    target.extend(chunk.chunk.0.iter().take(remaining));
                }
                if let Some(failure) = read.failure {
                    bail!("executor failed: {failure}");
                }
                if read.closed && drained {
                    return Ok(CommandExecResponse {
                        exit_code: read
                            .exit_code
                            .context("executor closed without exit status")?,
                        stdout: String::from_utf8_lossy(&stdout).into_owned(),
                        stderr: String::from_utf8_lossy(&stderr).into_owned(),
                    });
                }
            }
        };
        let limit = Duration::from_millis(self.timeout_ms.unwrap_or(60_000) as u64);
        let outcome = tokio::select! {
            _ = cancellation.cancelled() => None,
            result = tokio::time::timeout(limit, run) => Some(result),
        };
        let result = match outcome {
            Some(Ok(result)) => result,
            _ => {
                tokio::time::timeout(Duration::from_secs(5), client.terminate(&process_id))
                    .await
                    .context("executor did not acknowledge cancellation")??;
                Err(anyhow::anyhow!(
                    "Linux workload cancelled or timed out and was terminated"
                ))
            }
        };
        self.close_and_wait(&client).await?;
        result
    }
}

#[cfg(test)]
mod inquello_lock_release_probe_tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, Ordering};

    #[tokio::test]
    async fn connect_validation_failure_preserves_proven_no_process_phase() {
        let plan = WslExecPlan {
            scope: "invalid-scope".into(),
            task_id: uuid::Uuid::new_v4().to_string(),
            command: vec![],
            writable: false,
            domains: vec![],
            timeout_ms: None,
        };
        let mut phase = ModelSetupPhase::NoOutstandingProcess;
        assert!(plan.connect_tracked(&mut phase).await.is_err());
        assert!(phase == ModelSetupPhase::NoOutstandingProcess);
        phase = ModelSetupPhase::UnconfirmedResourceAttempt;
        assert!(plan.connect_tracked(&mut phase).await.is_err());
        assert!(phase == ModelSetupPhase::UnconfirmedResourceAttempt);
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn setup_probe_actual_spawn_exit_and_cancellation_classify_retirement() {
        let missing = tempfile::tempdir().unwrap();
        let mut phase = ModelSetupPhase::NoOutstandingProcess;
        let mut absent = tokio::process::Command::new(missing.path().join("does-not-exist.exe"));
        assert!(
            run_model_setup_probe(&mut absent, &mut phase, None, Duration::from_secs(5))
                .await
                .is_err()
        );
        assert!(phase == ModelSetupPhase::NoOutstandingProcess);
        let system = std::env::var("SystemRoot").unwrap();
        let executable = Path::new(&system)
            .join("System32")
            .join("WindowsPowerShell")
            .join("v1.0")
            .join("powershell.exe");
        for (script, budget, clean) in [
            ("exit 0", Duration::from_secs(10), true),
            ("exit 7", Duration::from_secs(10), false),
            ("Start-Sleep -Seconds 60", Duration::from_millis(1), false),
        ] {
            let mut process = tokio::process::Command::new(&executable);
            process
                .args(["-NoProfile", "-NonInteractive", "-Command", script])
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped());
            phase = ModelSetupPhase::NoOutstandingProcess;
            let result = run_model_setup_probe(&mut process, &mut phase, None, budget).await;
            assert_eq!(phase == ModelSetupPhase::NoOutstandingProcess, clean);
            if clean {
                assert!(result.unwrap().status.success());
            }
        }
        let mut process = tokio::process::Command::new(&executable);
        process
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Start-Sleep -Seconds 60",
            ])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());
        phase = ModelSetupPhase::NoOutstandingProcess;
        let mut pending = Box::pin(run_model_setup_probe(
            &mut process,
            &mut phase,
            None,
            Duration::from_secs(10),
        ));
        assert!(
            tokio::time::timeout(Duration::from_millis(1), &mut pending)
                .await
                .is_err()
        );
        drop(pending); // Cancellation drops only this owned kill-on-drop child.
        assert!(phase == ModelSetupPhase::UnconfirmedResourceAttempt);
    }

    #[tokio::test]
    async fn bounded_probe_wait_drops_owned_future_on_expiry() {
        struct OwnedWait(Arc<AtomicBool>);
        impl Drop for OwnedWait {
            fn drop(&mut self) {
                self.0.store(true, Ordering::SeqCst);
            }
        }
        let dropped = Arc::new(AtomicBool::new(false));
        let owned = OwnedWait(Arc::clone(&dropped));
        let pending = async move {
            let _owned = owned;
            std::future::pending::<std::io::Result<()>>().await
        };
        let error = wait_for_lock_release_probe(pending, Duration::from_millis(1))
            .await
            .expect_err("unconfirmed cleanup must remain bounded");
        assert!(error.to_string().contains("probe timed out"));
        assert!(dropped.load(Ordering::SeqCst));
        assert_eq!(LOCK_RELEASE_PROBE_BUDGET, Duration::from_secs(30));
    }

    #[tokio::test]
    async fn total_cleanup_envelope_expires_without_confirming_retirement() {
        let error = within_cleanup_budget(
            std::future::pending::<anyhow::Result<()>>(),
            Duration::from_millis(1),
        )
        .await
        .expect_err("all retries must share a finite cleanup deadline");
        assert!(error.to_string().contains("retirement unconfirmed"));
        assert_eq!(EXECUTOR_CLEANUP_BUDGET, Duration::from_secs(50));
        assert_eq!(EXECUTOR_RETIREMENT_WAIT, Duration::from_secs(55));
        within_cleanup_budget(async { Ok(()) }, Duration::from_secs(1))
            .await
            .expect("completed cleanup stays confirmed");
    }

    #[tokio::test]
    async fn bounded_probe_wait_preserves_confirmation_and_io_failure() {
        let confirmed = wait_for_lock_release_probe(async { Ok(true) }, Duration::from_secs(1))
            .await
            .expect("confirmed probe");
        assert!(confirmed);
        let error = wait_for_lock_release_probe(
            async { Err::<(), _>(std::io::Error::other("probe unavailable")) },
            Duration::from_secs(1),
        )
        .await
        .expect_err("I/O failure must not confirm cleanup");
        assert!(error.to_string().contains("probe could not complete"));
    }
}
