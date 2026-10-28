//! The protected capability register and the C/E inventory map (AD-14, FR-44, NFR-9).
//!
//! Nothing is enabled without a reviewed register entry, and synthetic evidence is
//! never real-data eligibility. Both files are compiled in; no runtime path, admin
//! override or environment toggle can enable a capability.

mod inventory;
mod register;

pub use inventory::INVENTORY_MAP_SCHEMA_VERSION;
pub use inventory::InventoryMap;
pub use inventory::InventoryRow;
pub use inventory::InventoryStatus;
pub use inventory::StoryRef;
pub use register::CAPABILITY_REGISTER_SCHEMA_VERSION;
pub use register::CapabilityEntry;
pub use register::CapabilityRegister;
pub use register::Enablement;
pub use register::EvidenceKind;
pub use register::EvidenceRef;
pub use register::EvidenceStatus;
pub use register::enablement;

/// A register entry's declared eligibility uses the same three states as the
/// effective [`Enablement`].
pub type Eligibility = Enablement;

/// Errors loading or validating the register or the inventory map.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum CapabilityError {
    /// The document is not valid JSON for its schema, or has unknown fields.
    #[error("capability document could not be parsed: {0}")]
    Parse(String),
    #[error("capability document schema version {found} is not supported (expected {expected})")]
    UnsupportedSchemaVersion { found: u32, expected: u32 },
    /// A register entry failed validation; `id` names it.
    #[error("capability register entry {id} is invalid: {reason}")]
    InvalidEntry { id: String, reason: String },
    #[error("capability register entry {id} appears more than once")]
    DuplicateEntry { id: String },
    /// An inventory map row failed validation; `id` names the C/E item.
    #[error("inventory item {id} {reason}")]
    InvalidInventoryRow { id: String, reason: String },
}
