//! The tool profile of a Task (Story 1.19): the concrete reach of the tools a
//! Task runs on this device, derived only from the effective policy and the
//! Task's broad mode.
//!
//! - **Bounded** (Standard and No prompt): the Task's private working folder
//!   with its `output` folder, the system locations tools need in order to run
//!   (read only), and the Workspace's allowed network destinations. Nothing
//!   else on the device is reachable. Under a `read_only` ceiling the working
//!   folder and its `output` folder are read only: the policy allows no writes.
//! - **Unbounded** (a permitted Full access broad mode): the profile states its
//!   true reach, no filesystem or network limits, and never claims a boundary.

use crate::DomainError;
use crate::execution_policy::broad_mode::BroadMode;
use crate::execution_policy::broad_mode::BroadModeStatus;
use crate::execution_policy::broad_mode::thread_settings;
use crate::execution_policy::effective::EffectivePolicy;
use crate::execution_policy::effective::SettingSource;
use crate::execution_policy::section::SandboxLevel;
use crate::organise::TaskId;
use std::path::Component;
use std::path::Path;
use std::path::PathBuf;

/// The name of the output folder inside a Task's working folder.
pub const TASK_OUTPUT_DIR: &str = "output";

/// A Task's private working folder: an absolute, normalised path whose last
/// component is the Task id. Its `output` folder is inside it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TaskFolder {
    task_id: TaskId,
    root: PathBuf,
}

impl TaskFolder {
    /// Validates the folder main chose for `task_id`: absolute, with no `.`
    /// or `..` component, and named after the Task.
    pub fn new(root: impl Into<PathBuf>, task_id: TaskId) -> Result<Self, DomainError> {
        let root = root.into();
        let invalid = |why: &str| DomainError::InvalidCommand(format!("taskFolder {why}"));
        if !root.is_absolute() {
            return Err(invalid("must be an absolute path"));
        }
        let dotted = root
            .to_string_lossy()
            .split(['/', '\\'])
            .any(|segment| segment == "." || segment == "..");
        if dotted
            || root
                .components()
                .any(|component| matches!(component, Component::CurDir | Component::ParentDir))
        {
            return Err(invalid("must not contain `.` or `..`"));
        }
        if root.file_name().and_then(|name| name.to_str()) != Some(task_id.to_string().as_str()) {
            return Err(invalid("must be named after the Task"));
        }
        Ok(Self { task_id, root })
    }

    pub const fn task_id(&self) -> TaskId {
        self.task_id
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn output(&self) -> PathBuf {
        self.root.join(TASK_OUTPUT_DIR)
    }
}

/// Read only or read and write.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FolderAccess {
    ReadOnly,
    ReadWrite,
}

impl FolderAccess {
    pub const fn as_str(self) -> &'static str {
        match self {
            FolderAccess::ReadOnly => "read",
            FolderAccess::ReadWrite => "write",
        }
    }

    pub const fn writable(self) -> bool {
        matches!(self, FolderAccess::ReadWrite)
    }
}

/// One permitted location of a bounded profile, named as people see it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Boundary {
    /// The Task's working folder.
    WorkingFolder(FolderAccess),
    /// The `output` folder inside it.
    OutputFolder(FolderAccess),
    /// The system locations tools need in order to run; always read only.
    System,
}

impl Boundary {
    /// `working_folder`, `output_folder` or `system`.
    pub const fn kind(self) -> &'static str {
        match self {
            Boundary::WorkingFolder(_) => "working_folder",
            Boundary::OutputFolder(_) => "output_folder",
            Boundary::System => "system",
        }
    }

    pub const fn access(self) -> FolderAccess {
        match self {
            Boundary::WorkingFolder(access) | Boundary::OutputFolder(access) => access,
            Boundary::System => FolderAccess::ReadOnly,
        }
    }

    /// The boundary's name in a denial: "working folder (read/write)",
    /// "output folder", "system (read-only)".
    pub const fn label(self) -> &'static str {
        match self {
            Boundary::WorkingFolder(FolderAccess::ReadWrite) => "working folder (read/write)",
            Boundary::WorkingFolder(FolderAccess::ReadOnly) => "working folder (read-only)",
            Boundary::OutputFolder(FolderAccess::ReadWrite) => "output folder",
            Boundary::OutputFolder(FolderAccess::ReadOnly) => "output folder (read-only)",
            Boundary::System => "system (read-only)",
        }
    }
}

/// Which network destinations a Task's tools may contact.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum NetworkReach {
    /// Only these host patterns, through the runtime's network proxy; empty
    /// means no destination at all.
    Listed(Vec<String>),
    /// No network limit (Full access only).
    Unrestricted,
}

/// What a Task's tools can reach, without any device path: the explanation
/// shown on the Task and in S07.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ToolReach {
    /// False only for a permitted Full access broad mode.
    pub bounded: bool,
    /// The permitted locations of a bounded profile, in a fixed order; empty
    /// when unbounded.
    pub boundaries: Vec<Boundary>,
    pub network: NetworkReach,
    /// The rule that governs the network reach.
    pub network_source: SettingSource,
}

impl ToolReach {
    /// Whether any boundary permits writes.
    pub fn writes(&self) -> bool {
        !self.bounded || self.boundaries.iter().any(|b| b.access().writable())
    }
}

/// The reach of a Task's tools under the effective policy and its broad mode.
/// Pure: it agrees with [`thread_settings`] by construction.
pub fn tool_reach(policy: &EffectivePolicy, status: BroadModeStatus) -> ToolReach {
    let settings = thread_settings(policy, status);
    if settings.mode == BroadMode::FullAccess {
        return ToolReach {
            bounded: false,
            boundaries: Vec::new(),
            network: NetworkReach::Unrestricted,
            network_source: policy.full_access.source,
        };
    }
    let access = if settings.sandbox == SandboxLevel::ReadOnly {
        FolderAccess::ReadOnly
    } else {
        FolderAccess::ReadWrite
    };
    ToolReach {
        bounded: true,
        boundaries: vec![
            Boundary::WorkingFolder(access),
            Boundary::OutputFolder(access),
            Boundary::System,
        ],
        network: NetworkReach::Listed(policy.allowed_domains.value.clone()),
        network_source: policy.allowed_domains.source,
    }
}

/// A Task's tool profile: its reach and the folder it applies to.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ToolProfile {
    pub reach: ToolReach,
    pub folder: TaskFolder,
}

impl ToolProfile {
    /// The Task's folders and their access, for the runtime's profile; empty
    /// when unbounded. The system locations are not paths here: the runtime
    /// names its own minimal set.
    pub fn folders(&self) -> Vec<(PathBuf, FolderAccess)> {
        self.reach
            .boundaries
            .iter()
            .filter_map(|boundary| match boundary {
                Boundary::WorkingFolder(access) => {
                    Some((self.folder.root().to_path_buf(), *access))
                }
                Boundary::OutputFolder(access) => Some((self.folder.output(), *access)),
                Boundary::System => None,
            })
            .collect()
    }

    /// The writable folders; empty when nothing is writable or unbounded.
    pub fn writable_roots(&self) -> Vec<PathBuf> {
        self.folders()
            .into_iter()
            .filter(|(_, access)| access.writable())
            .map(|(path, _)| path)
            .collect()
    }

    /// The network allowlist; `None` when unrestricted.
    pub fn network_allowlist(&self) -> Option<&[String]> {
        match &self.reach.network {
            NetworkReach::Listed(domains) => Some(domains),
            NetworkReach::Unrestricted => None,
        }
    }
}

/// The only derivation of a Task's tool profile: from the effective policy,
/// the broad mode and the Task folder.
pub fn tool_profile(
    policy: &EffectivePolicy,
    status: BroadModeStatus,
    folder: TaskFolder,
) -> ToolProfile {
    ToolProfile {
        reach: tool_reach(policy, status),
        folder,
    }
}
