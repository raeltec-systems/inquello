//! Domain values for local working metadata.

use crate::error::DomainError;
use std::fmt;
use uuid::Uuid;

/// The working-store schema version this domain writes into [`StoreInfo`].
pub const STORE_SCHEMA_VERSION: u32 = 1;

/// The longest accepted operation ID, in UTF-8 bytes.
pub const OPERATION_ID_MAX_BYTES: usize = 128;

/// A caller-chosen idempotency key carried by every mutation.
///
/// Valid IDs are 1 to [`OPERATION_ID_MAX_BYTES`] bytes of UTF-8 and contain only
/// printable characters: no control characters and no whitespace other than the
/// plain ASCII space, which may not lead or trail.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct OperationId(String);

impl OperationId {
    pub fn parse(value: &str) -> Result<Self, DomainError> {
        if value.is_empty() {
            return Err(DomainError::InvalidCommand(
                "operation ID must not be empty".to_string(),
            ));
        }
        if value.len() > OPERATION_ID_MAX_BYTES {
            return Err(DomainError::InvalidCommand(format!(
                "operation ID must be at most {OPERATION_ID_MAX_BYTES} bytes, got {}",
                value.len()
            )));
        }
        if value
            .chars()
            .any(|c| c.is_control() || (c.is_whitespace() && c != ' '))
        {
            return Err(DomainError::InvalidCommand(
                "operation ID must contain only printable characters".to_string(),
            ));
        }
        if value.starts_with(' ') || value.ends_with(' ') {
            return Err(DomainError::InvalidCommand(
                "operation ID must not start or end with a space".to_string(),
            ));
        }
        Ok(Self(value.to_string()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for OperationId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

/// The working store's revision. An empty store is at revision 0, and every applied
/// command advances it by one.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Revision(u64);

impl Revision {
    pub const ZERO: Revision = Revision(0);

    pub const fn new(value: u64) -> Self {
        Self(value)
    }

    pub const fn get(self) -> u64 {
        self.0
    }

    pub fn next(self) -> Result<Self, DomainError> {
        self.0
            .checked_add(1)
            .map(Self)
            .ok_or_else(|| DomainError::InvalidCommand("revision overflow".to_string()))
    }
}

impl fmt::Display for Revision {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}

/// Milliseconds since the Unix epoch, as reported by the [`crate::Clock`] port.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Timestamp(i64);

impl Timestamp {
    pub const fn from_unix_millis(millis: i64) -> Self {
        Self(millis)
    }

    pub const fn unix_millis(self) -> i64 {
        self.0
    }
}

/// The stable identity of one working store, fixed when it is initialized.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct StoreId(Uuid);

impl StoreId {
    pub fn new_random() -> Self {
        Self(Uuid::new_v4())
    }

    pub const fn from_uuid(uuid: Uuid) -> Self {
        Self(uuid)
    }

    pub const fn as_uuid(&self) -> &Uuid {
        &self.0
    }
}

impl fmt::Display for StoreId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}

/// The single `store_info` record: the first and only working metadata so far.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StoreInfo {
    pub store_id: StoreId,
    pub schema_version: u32,
    pub revision: Revision,
    pub created_at: Timestamp,
}

/// The domain commands a receipt can record.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum CommandKind {
    InitializeStore,
}

impl CommandKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            CommandKind::InitializeStore => "initialize_store",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "initialize_store" => Some(CommandKind::InitializeStore),
            _ => None,
        }
    }
}

/// What happened to the operation a receipt records.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ReceiptStatus {
    Applied,
}

impl ReceiptStatus {
    pub const fn as_str(self) -> &'static str {
        match self {
            ReceiptStatus::Applied => "applied",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "applied" => Some(ReceiptStatus::Applied),
            _ => None,
        }
    }
}

/// The durable record of one applied operation. A replay of the same operation ID
/// and the same command returns this record instead of applying the command again.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Receipt {
    pub operation_id: OperationId,
    pub command: CommandKind,
    pub expected_revision: Revision,
    pub resulting_revision: Revision,
    pub status: ReceiptStatus,
    pub recorded_at: Timestamp,
}

impl Receipt {
    /// Whether this receipt records the same request (command and expected revision).
    pub(crate) fn matches_request(&self, command: CommandKind, expected: Revision) -> bool {
        self.command == command && self.expected_revision == expected
    }
}

/// The result of a domain command.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CommandOutcome {
    pub receipt: Receipt,
    /// True when the receipt came from an earlier application of the same operation.
    pub replayed: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn operation_id_accepts_printable_ids_up_to_the_limit() {
        for value in [
            "a",
            "op-1",
            "op 1",
            "é€",
            &"x".repeat(OPERATION_ID_MAX_BYTES),
        ] {
            let id = OperationId::parse(value).map(|id| id.as_str().to_string());
            assert_eq!(id, Ok(value.to_string()));
        }
    }

    #[test]
    fn operation_id_rejects_empty_long_and_non_printable_ids() {
        let too_long = "x".repeat(OPERATION_ID_MAX_BYTES + 1);
        // 43 three-byte characters are 129 bytes but only 43 chars.
        let too_many_bytes = "€".repeat(43);
        for value in [
            "",
            too_long.as_str(),
            too_many_bytes.as_str(),
            "a\nb",
            "a\tb",
            "a\u{0}b",
            "a\u{7f}b",
            "a\u{2028}b",
            " a",
            "a ",
        ] {
            assert!(
                matches!(
                    OperationId::parse(value),
                    Err(DomainError::InvalidCommand(_))
                ),
                "{value:?} should be rejected"
            );
        }
    }

    #[test]
    fn command_kind_and_status_round_trip() {
        assert_eq!(
            CommandKind::parse(CommandKind::InitializeStore.as_str()),
            Some(CommandKind::InitializeStore)
        );
        assert_eq!(
            ReceiptStatus::parse(ReceiptStatus::Applied.as_str()),
            Some(ReceiptStatus::Applied)
        );
        assert_eq!(CommandKind::parse("unknown"), None);
    }
}
