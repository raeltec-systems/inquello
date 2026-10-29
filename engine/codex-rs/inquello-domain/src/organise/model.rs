//! Domain values for private Workspace organisation (Story 1.14): Engagements,
//! folders, Tasks and the locally remembered Workspace labels.

use crate::error::DomainError;
use crate::model::OperationId;
use crate::model::ReceiptStatus;
use crate::model::Revision;
use crate::model::Timestamp;
use std::fmt;
use uuid::Uuid;

/// The longest accepted name or title, in characters.
pub const NAME_MAX_CHARS: usize = 200;
/// The longest accepted Engagement objectives or scope text, in characters.
pub const TEXT_MAX_CHARS: usize = 4000;
/// The longest accepted runtime thread reference, in bytes.
pub const THREAD_REF_MAX_BYTES: usize = 128;

macro_rules! uuid_id {
    ($(#[$meta:meta])* $name:ident, $what:literal) => {
        $(#[$meta])*
        #[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
        pub struct $name(Uuid);

        impl $name {
            pub fn new_random() -> Self {
                Self(Uuid::new_v4())
            }

            pub const fn from_uuid(uuid: Uuid) -> Self {
                Self(uuid)
            }

            pub const fn as_uuid(&self) -> &Uuid {
                &self.0
            }

            /// Parses the canonical lowercase hyphenated form only.
            pub fn parse(value: &str) -> Result<Self, DomainError> {
                parse_canonical_uuid(value)
                    .map(Self)
                    .ok_or_else(|| DomainError::InvalidCommand(format!("{} must be a UUID", $what)))
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                self.0.fmt(f)
            }
        }
    };
}

uuid_id!(
    /// A shared-service Workspace (Story 1.11).
    WorkspaceId,
    "workspace_id"
);
uuid_id!(
    /// A shared-service principal `(issuer, subject)` (Story 1.10a).
    PrincipalId,
    "principal_id"
);
uuid_id!(
    /// A local Engagement record.
    EngagementId,
    "engagement_id"
);
uuid_id!(
    /// The shared-service Engagement (Story 1.11) that owns membership.
    ServiceEngagementId,
    "service_engagement_id"
);
uuid_id!(
    /// A folder inside an Engagement.
    FolderId,
    "folder_id"
);
uuid_id!(
    /// A private Task.
    TaskId,
    "task_id"
);

fn parse_canonical_uuid(value: &str) -> Option<Uuid> {
    let uuid = Uuid::parse_str(value).ok()?;
    (uuid.hyphenated().to_string() == value).then_some(uuid)
}

/// Validates a one-line name or title: trimmed, 1 to [`NAME_MAX_CHARS`]
/// characters, no control characters.
pub(crate) fn parse_name(value: &str, field: &str) -> Result<String, DomainError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(DomainError::InvalidCommand(format!(
            "{field} must not be empty"
        )));
    }
    if trimmed.chars().count() > NAME_MAX_CHARS {
        return Err(DomainError::InvalidCommand(format!(
            "{field} must be at most {NAME_MAX_CHARS} characters"
        )));
    }
    if trimmed.chars().any(char::is_control) {
        return Err(DomainError::InvalidCommand(format!(
            "{field} must not contain control characters"
        )));
    }
    Ok(trimmed.to_string())
}

/// Validates free text (objectives, scope): trimmed, at most
/// [`TEXT_MAX_CHARS`] characters, line breaks and tabs allowed, no other
/// control characters. May be empty.
pub(crate) fn parse_text(value: &str, field: &str) -> Result<String, DomainError> {
    let trimmed = value.trim();
    if trimmed.chars().count() > TEXT_MAX_CHARS {
        return Err(DomainError::InvalidCommand(format!(
            "{field} must be at most {TEXT_MAX_CHARS} characters"
        )));
    }
    if trimmed
        .chars()
        .any(|c| c.is_control() && c != '\n' && c != '\t')
    {
        return Err(DomainError::InvalidCommand(format!(
            "{field} must not contain control characters"
        )));
    }
    Ok(trimmed.to_string())
}

/// An optional one-line name: `None` or blank means absent.
pub(crate) fn parse_optional_name(
    value: Option<&str>,
    field: &str,
) -> Result<Option<String>, DomainError> {
    match value {
        Some(value) if !value.trim().is_empty() => parse_name(value, field).map(Some),
        _ => Ok(None),
    }
}

/// A calendar date `YYYY-MM-DD` bounding an Engagement period.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct PeriodDate(String);

impl PeriodDate {
    pub fn parse(value: &str, field: &str) -> Result<Self, DomainError> {
        let invalid = || DomainError::InvalidCommand(format!("{field} must be a YYYY-MM-DD date"));
        let bytes = value.as_bytes();
        if bytes.len() != 10 || bytes[4] != b'-' || bytes[7] != b'-' {
            return Err(invalid());
        }
        let digits = |range: std::ops::Range<usize>| -> Result<u32, DomainError> {
            let part = &value[range];
            if part.bytes().all(|b| b.is_ascii_digit()) {
                part.parse().map_err(|_| invalid())
            } else {
                Err(invalid())
            }
        };
        let year = digits(0..4)?;
        let month = digits(5..7)?;
        let day = digits(8..10)?;
        let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
        let days_in_month = match month {
            1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
            4 | 6 | 9 | 11 => 30,
            2 if leap => 29,
            2 => 28,
            _ => return Err(invalid()),
        };
        if year == 0 || day == 0 || day > days_in_month {
            return Err(invalid());
        }
        Ok(Self(value.to_string()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

pub(crate) fn parse_optional_date(
    value: Option<&str>,
    field: &str,
) -> Result<Option<PeriodDate>, DomainError> {
    match value {
        Some(value) if !value.is_empty() => PeriodDate::parse(value, field).map(Some),
        _ => Ok(None),
    }
}

/// A runtime thread reference: 1 to [`THREAD_REF_MAX_BYTES`] printable bytes.
pub(crate) fn parse_thread_ref(value: &str) -> Result<String, DomainError> {
    if value.is_empty() || value.len() > THREAD_REF_MAX_BYTES {
        return Err(DomainError::InvalidCommand(format!(
            "runtime_thread_id must be 1 to {THREAD_REF_MAX_BYTES} bytes"
        )));
    }
    if value.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err(DomainError::InvalidCommand(
            "runtime_thread_id must contain only printable characters".to_string(),
        ));
    }
    Ok(value.to_string())
}

/// Every Task is private to its creator; no other visibility exists yet.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Visibility {
    Private,
}

impl Visibility {
    pub const fn as_str(self) -> &'static str {
        match self {
            Visibility::Private => "private",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "private" => Some(Visibility::Private),
            _ => None,
        }
    }
}

/// A local Engagement, linked to the shared-service Engagement that owns its
/// membership.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Engagement {
    pub engagement_id: EngagementId,
    pub workspace_id: WorkspaceId,
    pub service_engagement_id: ServiceEngagementId,
    pub name: String,
    pub objectives: String,
    pub scope: String,
    pub client_entity: Option<String>,
    pub period_start: Option<PeriodDate>,
    pub period_end: Option<PeriodDate>,
    pub revision: Revision,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}

/// A folder inside one Engagement.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Folder {
    pub folder_id: FolderId,
    pub engagement_id: EngagementId,
    pub workspace_id: WorkspaceId,
    pub name: String,
    pub revision: Revision,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}

/// A private Task. An ad hoc Task has no Engagement; a Task in a folder always
/// has the folder's Engagement.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Task {
    pub task_id: TaskId,
    pub workspace_id: WorkspaceId,
    pub creator_principal_id: PrincipalId,
    pub engagement_id: Option<EngagementId>,
    pub folder_id: Option<FolderId>,
    pub title: String,
    pub runtime_thread_id: Option<String>,
    /// Empty until later epics add sources.
    pub source_refs: Vec<String>,
    /// Empty until later epics add artifacts.
    pub artifact_refs: Vec<String>,
    pub visibility: Visibility,
    pub revision: Revision,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}

/// The name a principal last saw for a shared-service Workspace, kept so that
/// private Tasks stay readable while the shared service is down.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WorkspaceLabel {
    pub principal_id: PrincipalId,
    pub workspace_id: WorkspaceId,
    pub name: String,
    pub revision: Revision,
    pub updated_at: Timestamp,
}

/// One record written by an organise command.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum OrganiseRecord {
    Engagement(Engagement),
    Folder(Folder),
    Task(Task),
    WorkspaceLabel(WorkspaceLabel),
}

impl OrganiseRecord {
    pub fn revision(&self) -> Revision {
        match self {
            OrganiseRecord::Engagement(record) => record.revision,
            OrganiseRecord::Folder(record) => record.revision,
            OrganiseRecord::Task(record) => record.revision,
            OrganiseRecord::WorkspaceLabel(record) => record.revision,
        }
    }

    /// The record's own ID (for a Workspace label, the Workspace ID).
    pub fn resource_id(&self) -> Uuid {
        match self {
            OrganiseRecord::Engagement(record) => *record.engagement_id.as_uuid(),
            OrganiseRecord::Folder(record) => *record.folder_id.as_uuid(),
            OrganiseRecord::Task(record) => *record.task_id.as_uuid(),
            OrganiseRecord::WorkspaceLabel(record) => *record.workspace_id.as_uuid(),
        }
    }
}

/// The organise commands a receipt can record.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum OrganiseCommandKind {
    CreateEngagement,
    UpdateEngagement,
    CreateFolder,
    CreateTask,
    RenameTask,
    MoveTask,
    AttachThread,
    RememberWorkspace,
}

impl OrganiseCommandKind {
    pub const ALL: [OrganiseCommandKind; 8] = [
        OrganiseCommandKind::CreateEngagement,
        OrganiseCommandKind::UpdateEngagement,
        OrganiseCommandKind::CreateFolder,
        OrganiseCommandKind::CreateTask,
        OrganiseCommandKind::RenameTask,
        OrganiseCommandKind::MoveTask,
        OrganiseCommandKind::AttachThread,
        OrganiseCommandKind::RememberWorkspace,
    ];

    pub const fn as_str(self) -> &'static str {
        match self {
            OrganiseCommandKind::CreateEngagement => "create_engagement",
            OrganiseCommandKind::UpdateEngagement => "update_engagement",
            OrganiseCommandKind::CreateFolder => "create_folder",
            OrganiseCommandKind::CreateTask => "create_task",
            OrganiseCommandKind::RenameTask => "rename_task",
            OrganiseCommandKind::MoveTask => "move_task",
            OrganiseCommandKind::AttachThread => "attach_thread",
            OrganiseCommandKind::RememberWorkspace => "remember_workspace",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|kind| kind.as_str() == value)
    }
}

/// The durable record of one applied organise operation.
///
/// Unlike the store-level [`crate::Receipt`], it is scoped to one record: the
/// revisions are that record's, and `request` holds the canonical request so a
/// reused operation ID with any other request (or another principal) is refused.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OrganiseReceipt {
    pub operation_id: OperationId,
    pub principal_id: PrincipalId,
    pub command: OrganiseCommandKind,
    pub resource_id: Uuid,
    pub expected_revision: Revision,
    pub resulting_revision: Revision,
    /// Canonical JSON of the validated request.
    pub request: String,
    pub status: ReceiptStatus,
    pub recorded_at: Timestamp,
}

/// The result of an organise command: the receipt and the record as it now is.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OrganiseOutcome {
    pub receipt: OrganiseReceipt,
    pub record: OrganiseRecord,
    /// True when the receipt came from an earlier application of the same operation.
    pub replayed: bool,
}

/// One Workspace's local organisation as one principal may see it.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct WorkspaceTree {
    pub engagements: Vec<Engagement>,
    pub folders: Vec<Folder>,
    /// Only Tasks the principal created.
    pub tasks: Vec<Task>,
}

/// A Workspace this device knows for a principal: from a remembered label, or
/// because the principal has a private Task in it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct KnownWorkspace {
    pub workspace_id: WorkspaceId,
    pub label: Option<WorkspaceLabel>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn ids_accept_only_canonical_uuids() {
        let canonical = "5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e";
        assert_eq!(
            TaskId::parse(canonical).map(|id| id.to_string()),
            Ok(canonical.to_string())
        );
        for value in [
            "",
            "5D6E7F80-91A2-4B3C-8D4E-5F6A7B8C9D0E",
            "5d6e7f8091a24b3c8d4e5f6a7b8c9d0e",
            "{5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e}",
            "not-a-uuid",
        ] {
            assert!(TaskId::parse(value).is_err(), "{value:?}");
        }
    }

    #[test]
    fn names_are_trimmed_bounded_and_printable() {
        assert_eq!(parse_name("  FY26  ", "name"), Ok("FY26".to_string()));
        assert!(parse_name("   ", "name").is_err());
        assert!(parse_name("a\u{7}b", "name").is_err());
        assert!(parse_name(&"x".repeat(NAME_MAX_CHARS + 1), "name").is_err());
        assert!(parse_name(&"é".repeat(NAME_MAX_CHARS), "name").is_ok());
        assert_eq!(
            parse_text("line\none", "scope"),
            Ok("line\none".to_string())
        );
        assert_eq!(parse_text("", "scope"), Ok(String::new()));
        assert!(parse_text("a\u{0}b", "scope").is_err());
        assert_eq!(parse_optional_name(Some("  "), "client"), Ok(None));
    }

    #[test]
    fn period_dates_are_real_calendar_dates() {
        for value in ["2026-01-01", "2024-02-29", "2026-12-31"] {
            assert!(PeriodDate::parse(value, "period_start").is_ok(), "{value}");
        }
        for value in [
            "2026-02-29",
            "2026-13-01",
            "2026-04-31",
            "0000-01-01",
            "2026-1-01",
            "26-01-01",
            "2026/01/01",
            "2026-01-0a",
        ] {
            assert!(PeriodDate::parse(value, "period_start").is_err(), "{value}");
        }
    }

    #[test]
    fn command_kinds_round_trip() {
        for kind in OrganiseCommandKind::ALL {
            assert_eq!(OrganiseCommandKind::parse(kind.as_str()), Some(kind));
        }
        assert_eq!(OrganiseCommandKind::parse("initialize_store"), None);
        assert_eq!(Visibility::parse("private"), Some(Visibility::Private));
        assert_eq!(Visibility::parse("shared"), None);
    }
}
