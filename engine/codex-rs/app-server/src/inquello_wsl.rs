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
/// The PATH every guest command is given (one-shot and private-Task).
pub(crate) const GUEST_PATH: &str = "/usr/bin:/bin";
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

/// The guest broker's transfer bounds (`guest-broker.py`: `LIMIT`, `MAX_FILES`;
/// the desktop's `validateTransfer` uses the same). The broker re-validates
/// every entry; these only refuse an oversized manifest before any effect.
const MATERIAL_ENTRY_LIMIT: usize = 10_000;
const MATERIAL_BYTE_LIMIT: u64 = 2 * 256 * 1024 * 1024 - 64;
const MATERIAL_STAGING_BUDGET: Duration = Duration::from_secs(120);

/// Story 2.1: attached material for a new Task, staged by the guest broker's
/// existing `replace` action before the first turn (owner decision
/// 2026-11-11). The desktop main process inventoried and bounded it and wrote
/// the broker's transfer manifest under its private profile storage; the
/// request names only the operation and the manifest's digest.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct StartMaterial {
    pub operation_id: String,
    pub sha256: String,
}

/// Staging the attached material failed before the Task's first turn.
#[derive(Debug)]
pub(crate) struct MaterialNotStaged(pub &'static str);
impl std::fmt::Display for MaterialNotStaged {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.0)
    }
}
impl std::error::Error for MaterialNotStaged {}

impl StartMaterial {
    pub(crate) fn new(operation_id: &str, sha256: &str) -> anyhow::Result<Self> {
        uuid::Uuid::parse_str(operation_id)?;
        if operation_id != operation_id.to_ascii_lowercase()
            || sha256.len() != 64
            || !sha256.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
        {
            bail!(MaterialNotStaged("attached material identity is invalid"));
        }
        Ok(Self {
            operation_id: operation_id.into(),
            sha256: sha256.into(),
        })
    }

    /// `D:\Inquello\profiles\<scope>\material\<operation>.json`, beside the
    /// scope's bindings and transfer journals.
    fn manifest(&self, profiles: &Path, scope: &str) -> std::path::PathBuf {
        profiles
            .join(scope)
            .join("material")
            .join(format!("{}.json", self.operation_id))
    }

    /// The broker `replace` request for the verified manifest. Refuses a link,
    /// an oversized or changed manifest, anything but a JSON array, and more
    /// entries than the broker accepts.
    fn replace_request(&self, profiles: &Path, scope: &str) -> anyhow::Result<Vec<u8>> {
        let file = self.manifest(profiles, scope);
        let metadata = std::fs::symlink_metadata(&file)
            .map_err(|_| MaterialNotStaged("attached material is missing"))?;
        if !metadata.is_file() || metadata.file_type().is_symlink() {
            bail!(MaterialNotStaged("attached material is not a regular file"));
        }
        if metadata.len() > MATERIAL_BYTE_LIMIT {
            bail!(MaterialNotStaged("attached material exceeds the transfer bound"));
        }
        let mut bytes = Vec::with_capacity(metadata.len() as usize);
        {
            use std::io::Read;
            std::fs::File::open(&file)
                .and_then(|source| source.take(MATERIAL_BYTE_LIMIT + 1).read_to_end(&mut bytes))
                .map_err(|_| MaterialNotStaged("attached material could not be read"))?;
        }
        if bytes.len() as u64 > MATERIAL_BYTE_LIMIT {
            bail!(MaterialNotStaged("attached material exceeds the transfer bound"));
        }
        if format!("{:x}", Sha256::digest(&bytes)) != self.sha256 {
            bail!(MaterialNotStaged("attached material changed after it was prepared"));
        }
        let entries: Vec<serde::de::IgnoredAny> = serde_json::from_slice(&bytes)
            .map_err(|_| MaterialNotStaged("attached material is not a transfer manifest"))?;
        if entries.is_empty() || entries.len() > MATERIAL_ENTRY_LIMIT {
            bail!(MaterialNotStaged("attached material exceeds the transfer bound"));
        }
        let mut request = b"{\"action\":\"replace\",\"entries\":".to_vec();
        request.extend_from_slice(&bytes);
        request.push(b'}');
        Ok(request)
    }
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
    /// With `material`, the new guest Task folder is published by the broker's
    /// `replace` action from the desktop-prepared manifest instead of being
    /// initialized empty, so the files are there before the first command.
    pub(crate) async fn prepare_model(
        host_root: &Path,
        principal: &str,
        writable: bool,
        domains: Vec<String>,
        phase: &mut ModelSetupPhase,
        material: Option<&StartMaterial>,
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
        if material.is_some() && binding.exists() {
            // Material belongs only to a newly reserved Task; never republish.
            bail!(MaterialNotStaged("attached material needs a new Task"));
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
            let (request, budget) = match material {
                Some(material) => (
                    material.replace_request(Path::new("D:\\Inquello\\profiles"), &plan.scope)?,
                    MATERIAL_STAGING_BUDGET,
                ),
                None => (
                    b"{\"action\":\"initialize\"}".to_vec(),
                    Duration::from_secs(30),
                ),
            };
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
            let result = run_model_setup_probe(&mut child, phase, Some(&request), budget).await;
            let staged = match result {
                Ok(result) if result.status.success() => Ok(()),
                Ok(result) => Err(anyhow::anyhow!(
                    "Task guest initialization failed: {}",
                    String::from_utf8_lossy(&result.stderr)
                )),
                Err(error) => Err(error.context("Linux Task initialization could not complete")),
            };
            if let Err(error) = staged {
                if material.is_some() {
                    tracing::warn!("Attached material was not staged: {error:#}");
                    bail!(MaterialNotStaged(
                        "the Task folder could not receive the attached material"
                    ));
                }
                return Err(error);
            }
            // The initialize and replace actions create directories and files
            // synchronously, hold their locks only for this broker process, and
            // start no executor/children.
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
                    ("PATH".into(), GUEST_PATH.into()),
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
        // The guest's system socket locations stay hidden (owner decision
        // 2026-11-11): Task commands may use local sockets, but only their own.
        for hidden in [
            "/usr/lib/modules",
            "/usr/src",
            "/usr/lib/linux-tools",
            "/usr/lib/wsl",
            "/run",
            "/var/run",
            "/tmp/.X11-unix",
            "/mnt/wslg",
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

    /// `dangerously_allow_all_unix_sockets` grants private Task commands local
    /// (Unix) sockets in the Linux sandbox's proxy-routed seccomp mode, so a
    /// program such as LibreOffice can use its own single-instance pipe (owner
    /// decision 2026-11-11). On Linux the proxy never forwards to Unix sockets
    /// (`x-unix-socket` is macOS-only), the command's network namespace is
    /// private, and the guest's socket locations are hidden by `sandbox`.
    fn network_config(&self) -> anyhow::Result<NetworkProxyConfig> {
        let domains: serde_json::Map<String, serde_json::Value> = self
            .domains
            .iter()
            .map(|domain| (domain.clone(), serde_json::json!("allow")))
            .collect();
        let config: NetworkProxyConfig = serde_json::from_value(serde_json::json!({
            "enabled": true, "domains": domains, "enable_socks5": false,
            "enable_socks5_udp": false, "allow_upstream_proxy": false,
            "dangerously_allow_all_unix_sockets": true, "allow_local_binding": false,
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
                ("PATH".into(), GUEST_PATH.into()),
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

/// Not-found as the guest executor's filesystem handler reports it
/// (`exec-server`'s `rpc::not_found`).
const GUEST_NOT_FOUND: i64 = -32004;

/// The guest's read-only filesystem queries over an existing executor
/// connection, under the Task's sandbox. Used only to resolve programs.
#[derive(Clone)]
pub(crate) struct GuestChannel {
    client: ExecServerClient,
    sandbox: FileSystemSandboxContext,
}

impl crate::inquello_program::GuestFs for GuestChannel {
    fn entry<'a>(
        &'a self,
        path: &'a str,
    ) -> impl std::future::Future<
        Output = Result<
            crate::inquello_program::GuestEntry,
            crate::inquello_program::GuestUnavailable,
        >,
    > + Send
    + 'a {
        use crate::inquello_program::GuestEntry;
        use crate::inquello_program::GuestUnavailable;
        use codex_exec_server::ExecServerError;
        async move {
            // A program word that does not survive the file-URI round trip
            // exactly is never queried under another name.
            let uri = uri(path).map_err(|_| GuestUnavailable)?;
            if uri.decoded_path_bytes().as_ref() != path.as_bytes() {
                return Err(GuestUnavailable);
            }
            let not_found = |error: &ExecServerError| matches!(error, ExecServerError::Server { code, .. } if *code == GUEST_NOT_FOUND);
            let metadata = match self
                .client
                .fs_get_metadata(codex_exec_server_protocol::FsGetMetadataParams {
                    path: uri.clone(),
                    follow_symlinks: Some(true),
                    sandbox: Some(self.sandbox.clone()),
                })
                .await
            {
                Ok(metadata) => metadata,
                Err(error) if not_found(&error) => return Ok(GuestEntry::Missing),
                Err(_) => return Err(GuestUnavailable),
            };
            if !metadata.is_file {
                return Ok(GuestEntry::NotFile);
            }
            match self
                .client
                .fs_canonicalize(codex_exec_server_protocol::FsCanonicalizeParams {
                    path: uri,
                    sandbox: Some(self.sandbox.clone()),
                })
                .await
            {
                Ok(canonical) => {
                    String::from_utf8(canonical.path.decoded_path_bytes().into_owned())
                        .map(GuestEntry::File)
                        .map_err(|_| GuestUnavailable)
                }
                Err(error) if not_found(&error) => Ok(GuestEntry::Missing),
                Err(_) => Err(GuestUnavailable),
            }
        }
    }
}

type RetainedKey = (String, String);

/// Each private Task's retained executor channel, by (scope, Task), with the
/// generation that registered it.
static RETAINED: std::sync::LazyLock<
    std::sync::Mutex<HashMap<RetainedKey, (uuid::Uuid, GuestChannel)>>,
> = std::sync::LazyLock::new(Default::default);

impl WslExecPlan {
    /// Makes this private Task's live executor connection available to
    /// resolve its commands' programs, until [`Self::release_channel`].
    pub(crate) fn retain_channel(
        &self,
        generation: uuid::Uuid,
        client: &ExecServerClient,
    ) -> anyhow::Result<()> {
        let channel = GuestChannel {
            client: client.clone(),
            sandbox: self.sandbox()?,
        };
        RETAINED
            .lock()
            .map_err(|_| anyhow::anyhow!("guest channel registry unavailable"))?
            .insert(
                (self.scope.clone(), self.task_id.clone()),
                (generation, channel),
            );
        Ok(())
    }

    /// Forgets the channel this generation registered (a successor's stays).
    pub(crate) fn release_channel(&self, generation: uuid::Uuid) {
        if let Ok(mut retained) = RETAINED.lock() {
            let key = (self.scope.clone(), self.task_id.clone());
            if retained
                .get(&key)
                .is_some_and(|(owner, _)| *owner == generation)
            {
                retained.remove(&key);
            }
        }
    }
}

/// The Linux guest a command will run in, for resolving its program there.
pub(crate) enum GuestTarget {
    /// `inquello/tools/exec`: a short read-only connection to the Task's own
    /// guest executor, with no network, closed before the command runs.
    Connect { scope: String, task_id: String },
    /// A private Task's model command: its live executor connection.
    Retained { scope: String, task_id: String },
}

impl GuestTarget {
    /// Resolves `words` inside the guest, with its PATH and the Task's guest
    /// working folder. Unreachable, failing or slow means unresolved.
    pub(crate) async fn resolve(&self, words: &[String]) -> crate::inquello_program::Resolutions {
        use crate::inquello_program::GuestResolver;
        use crate::inquello_program::RESOLUTION_BUDGET;
        use crate::inquello_program::Resolutions;
        use crate::inquello_program::resolve_within;
        let (scope, task_id) = match self {
            Self::Connect { scope, task_id } | Self::Retained { scope, task_id } => {
                (scope, task_id)
            }
        };
        let plan = WslExecPlan {
            scope: scope.clone(),
            task_id: task_id.clone(),
            command: vec![],
            writable: false,
            domains: vec![],
            timeout_ms: None,
        };
        let resolver = |channel: GuestChannel| GuestResolver {
            fs: channel,
            cwd: plan.root(),
            search_path: GUEST_PATH.to_string(),
        };
        match self {
            Self::Retained { .. } => {
                let channel = RETAINED.lock().ok().and_then(|retained| {
                    retained
                        .get(&(scope.clone(), task_id.clone()))
                        .map(|(_, channel)| channel.clone())
                });
                match channel {
                    Some(channel) => {
                        resolve_within(&resolver(channel), words, RESOLUTION_BUDGET).await
                    }
                    None => Resolutions::unresolved(),
                }
            }
            Self::Connect { .. } => {
                let Ok(sandbox) = plan.sandbox() else {
                    return Resolutions::unresolved();
                };
                let client = match plan.connect().await {
                    Ok(client) => client,
                    Err(error) => {
                        tracing::warn!("Linux program resolution unavailable: {error:#}");
                        return Resolutions::unresolved();
                    }
                };
                let channel = GuestChannel {
                    client: client.clone(),
                    sandbox,
                };
                let resolutions =
                    resolve_within(&resolver(channel), words, RESOLUTION_BUDGET).await;
                // Release the guest's Task lock before the command itself runs.
                if let Err(error) = plan.close_and_wait(&client).await {
                    tracing::warn!("Linux program resolution cleanup unconfirmed: {error:#}");
                }
                resolutions
            }
        }
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

    fn plan() -> WslExecPlan {
        WslExecPlan {
            scope: "a".repeat(64),
            task_id: uuid::Uuid::new_v4().to_string(),
            command: vec![],
            writable: true,
            domains: vec![],
            timeout_ms: None,
        }
    }

    #[test]
    fn private_task_commands_get_local_sockets_and_never_the_guest_socket_locations() {
        let plan = plan();
        // The one existing grant: allow-all Unix sockets for this Task's
        // managed network, on both the model path and the one-shot tool path.
        assert_eq!(
            plan.network_config()
                .unwrap()
                .dangerously_allow_all_unix_sockets,
            Some(true)
        );
        let environment = plan.environment_config().unwrap();
        assert!(
            environment
                .network_policy
                .as_ref()
                .is_some_and(|policy| policy.dangerously_allow_all_unix_sockets)
        );
        assert!(plan.network().unwrap().proxy.dangerously_allow_all_unix_sockets);
        // Nothing else in the managed network widens.
        let config = plan.network_config().unwrap();
        assert!(config.enabled && !config.allow_upstream_proxy && !config.mitm);
        assert_eq!(config.allow_local_binding, Some(false));
        assert!(config.unix_sockets.is_none());
        fn denied(value: &serde_json::Value, found: &mut Vec<String>) {
            match value {
                serde_json::Value::Object(map) => {
                    if map.get("access").and_then(serde_json::Value::as_str) == Some("deny") {
                        found.push(map.get("path").map(ToString::to_string).unwrap_or_default());
                    }
                    map.values().for_each(|child| denied(child, found));
                }
                serde_json::Value::Array(items) => items.iter().for_each(|item| denied(item, found)),
                _ => {}
            }
        }
        let mut found = Vec::new();
        denied(&serde_json::to_value(plan.sandbox().unwrap()).unwrap(), &mut found);
        for hidden in ["/run", "/var/run", "/tmp/.X11-unix", "/mnt/wslg", "/usr/lib/wsl"] {
            assert!(
                found.iter().any(|path| path.contains(&format!("//{hidden}\""))),
                "{hidden} must stay hidden from Task commands: {found:?}"
            );
        }
    }

    #[test]
    fn start_material_identity_is_strict() {
        let operation = uuid::Uuid::new_v4().to_string();
        assert!(StartMaterial::new(&operation, &"0".repeat(64)).is_ok());
        for (operation, digest) in [
            (operation.as_str(), "0".repeat(63)),
            (operation.as_str(), "G".repeat(64)),
            (operation.as_str(), "A".repeat(64)),
            ("..\\escape", "0".repeat(64)),
            ("not-an-operation", "0".repeat(64)),
        ] {
            assert!(StartMaterial::new(operation, &digest).is_err(), "{operation} {digest}");
        }
        let upper = uuid::Uuid::new_v4().to_string().to_uppercase();
        assert!(StartMaterial::new(&upper, &"0".repeat(64)).is_err());
    }

    #[test]
    fn start_material_stages_only_the_verified_bounded_manifest() {
        let profiles = tempfile::tempdir().unwrap();
        let scope = "b".repeat(64);
        let folder = profiles.path().join(&scope).join("material");
        std::fs::create_dir_all(&folder).unwrap();
        let operation = uuid::Uuid::new_v4().to_string();
        let write = |bytes: &[u8]| {
            std::fs::write(folder.join(format!("{operation}.json")), bytes).unwrap();
            format!("{:x}", Sha256::digest(bytes))
        };
        let manifest =
            br#"[{"path":"attached","kind":"directory"},{"path":"attached/a.txt","kind":"file","data":"YQ==","sha256":"ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb"}]"#;
        let digest = write(manifest);
        let material = StartMaterial::new(&operation, &digest).unwrap();
        let request = material.replace_request(profiles.path(), &scope).unwrap();
        let parsed: serde_json::Value = serde_json::from_slice(&request).unwrap();
        assert_eq!(parsed["action"], "replace");
        assert_eq!(parsed["entries"], serde_json::from_slice::<serde_json::Value>(manifest).unwrap());
        assert_eq!(parsed.as_object().unwrap().len(), 2);
        let refused = |material: &StartMaterial| {
            let error = material.replace_request(profiles.path(), &scope).unwrap_err();
            assert!(error.downcast_ref::<MaterialNotStaged>().is_some(), "{error:#}");
            error.to_string()
        };
        // Changed after it was prepared.
        write(br#"[{"path":"attached","kind":"directory"}]"#);
        assert!(refused(&material).contains("changed"));
        // A manifest that tries to add another broker action is not an array.
        let smuggled = br#"[], "action": "retire""#;
        let digest = write(smuggled);
        assert!(refused(&StartMaterial::new(&operation, &digest).unwrap()).contains("not a transfer manifest"));
        // Empty and over the broker's entry bound.
        let digest = write(b"[]");
        assert!(refused(&StartMaterial::new(&operation, &digest).unwrap()).contains("bound"));
        let many = format!("[{}]", vec!["{}"; MATERIAL_ENTRY_LIMIT + 1].join(","));
        let digest = write(many.as_bytes());
        assert!(refused(&StartMaterial::new(&operation, &digest).unwrap()).contains("bound"));
        // Another operation's manifest, or none, is never used.
        let other = StartMaterial::new(&uuid::Uuid::new_v4().to_string(), &digest).unwrap();
        assert!(refused(&other).contains("missing"));
        // A directory where the manifest should be.
        std::fs::remove_file(folder.join(format!("{operation}.json"))).unwrap();
        std::fs::create_dir(folder.join(format!("{operation}.json"))).unwrap();
        assert!(refused(&StartMaterial::new(&operation, &digest).unwrap()).contains("regular file"));
    }

    #[tokio::test]
    async fn invalid_task_with_material_fails_before_any_probe() {
        let material = StartMaterial::new(&uuid::Uuid::new_v4().to_string(), &"0".repeat(64)).unwrap();
        let mut phase = ModelSetupPhase::NoOutstandingProcess;
        assert!(
            WslExecPlan::prepare_model(
                Path::new("invalid-task-id"),
                "principal",
                true,
                vec![],
                &mut phase,
                Some(&material)
            )
            .await
            .is_err()
        );
        assert!(phase == ModelSetupPhase::NoOutstandingProcess);
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
