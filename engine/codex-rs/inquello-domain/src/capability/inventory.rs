//! The inventory map: how every C/E inventory item is accounted for.
//!
//! `register/inventory-map.json` holds one row per C (C01 to C78 plus C54A) and E
//! (E01 to E20) item. A row is `enabled` (citing register entries that are enabled),
//! `planned` (citing the stories in `epics.md` that realise it) or `deferred-unmet`
//! (no story realises it yet; an unmet requirement, never an approved reduction).
//! The map is generated from the planning documents by
//! `tests/inventory_map.rs`, which also proves it against them.

use super::CapabilityError;
use super::CapabilityRegister;
use serde::Deserialize;
use serde::Serialize;
use std::collections::BTreeSet;

/// The inventory map schema version this domain reads.
pub const INVENTORY_MAP_SCHEMA_VERSION: u32 = 1;

const EMBEDDED_INVENTORY_MAP: &str = include_str!("../../register/inventory-map.json");

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum InventoryStatus {
    Enabled,
    Planned,
    DeferredUnmet,
}

/// A story that realises an inventory item.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StoryRef {
    /// The story number, such as `"12.7"`.
    pub story: String,
    pub epic: u32,
    /// The story's increment label from `epics.md`, such as `"Increment 1"`.
    pub increment: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InventoryRow {
    pub id: String,
    pub title: String,
    pub status: InventoryStatus,
    pub stories: Vec<StoryRef>,
    pub register_entries: Vec<String>,
    pub reason: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InventoryMap {
    pub schema_version: u32,
    pub sources: Vec<String>,
    pub items: Vec<InventoryRow>,
}

impl InventoryMap {
    /// Parses the map compiled into this binary. Call [`InventoryMap::validate`]
    /// before relying on it.
    pub fn load_embedded() -> Result<Self, CapabilityError> {
        Self::from_json(EMBEDDED_INVENTORY_MAP)
    }

    pub fn from_json(json: &str) -> Result<Self, CapabilityError> {
        let map: Self = serde_json::from_str(json)
            .map_err(|error| CapabilityError::Parse(error.to_string()))?;
        if map.schema_version != INVENTORY_MAP_SCHEMA_VERSION {
            return Err(CapabilityError::UnsupportedSchemaVersion {
                found: map.schema_version,
                expected: INVENTORY_MAP_SCHEMA_VERSION,
            });
        }
        Ok(map)
    }

    pub fn row(&self, id: &str) -> Option<&InventoryRow> {
        self.items.iter().find(|row| row.id == id)
    }

    /// Rows that no story realises: unmet scope, kept disabled.
    pub fn deferred_unmet(&self) -> impl Iterator<Item = &InventoryRow> {
        self.items
            .iter()
            .filter(|row| row.status == InventoryStatus::DeferredUnmet)
    }

    /// Checks each row's internal consistency and that every `enabled` row is backed
    /// by register entries that are actually enabled. Coverage of the full inventory
    /// and story existence are checked against the planning documents by the tests.
    pub fn validate(&self, register: &CapabilityRegister) -> Result<(), CapabilityError> {
        let mut seen = BTreeSet::new();
        for row in &self.items {
            let invalid = |reason: String| CapabilityError::InvalidInventoryRow {
                id: row.id.clone(),
                reason,
            };
            if !seen.insert(row.id.as_str()) {
                return Err(invalid("appears more than once".to_string()));
            }
            if row.title.trim().is_empty() {
                return Err(invalid("title must not be empty".to_string()));
            }
            match row.status {
                InventoryStatus::Enabled => {
                    if row.register_entries.is_empty() {
                        return Err(invalid(
                            "is enabled without citing a register entry".to_string(),
                        ));
                    }
                    for entry in &row.register_entries {
                        if !register.enablement(entry).is_enabled() {
                            return Err(invalid(format!(
                                "is enabled but register entry {entry} is not enabled"
                            )));
                        }
                    }
                    if row.reason.is_some() {
                        return Err(invalid(
                            "an enabled row carries no deferral reason".to_string(),
                        ));
                    }
                }
                InventoryStatus::Planned => {
                    if row.stories.is_empty() {
                        return Err(invalid("is planned without a realising story".to_string()));
                    }
                    if !row.register_entries.is_empty() {
                        return Err(invalid(
                            "is planned but cites register entries; mark it enabled or drop them"
                                .to_string(),
                        ));
                    }
                    if row.reason.is_some() {
                        return Err(invalid(
                            "a planned row carries no deferral reason".to_string(),
                        ));
                    }
                }
                InventoryStatus::DeferredUnmet => {
                    if !row.stories.is_empty() {
                        return Err(invalid(
                            "is deferred-unmet but cites realising stories".to_string(),
                        ));
                    }
                    if !row.register_entries.is_empty() {
                        return Err(invalid(
                            "is deferred-unmet but cites register entries".to_string(),
                        ));
                    }
                    if row
                        .reason
                        .as_deref()
                        .is_none_or(|reason| reason.trim().is_empty())
                    {
                        return Err(invalid("is deferred-unmet without a reason".to_string()));
                    }
                }
            }
        }
        Ok(())
    }
}
