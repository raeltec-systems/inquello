//! Workspace authorization for the shared service (AD-6/7, SC-1, SC-3).
//!
//! - [`WorkspacePolicy`]: the versioned role policy stored with a Workspace. Every
//!   role has a [`RoleKind`] (`audit_team` or `reviewer` only, so no firm
//!   hierarchy is hard-coded), a label and the [`Action`]s it permits. Any other
//!   kind, such as `guest`, rejects the whole policy, and so does any action this
//!   contract does not know: unknown semantics are denied, never ignored.
//!   External-audit client or independence attributes are refused as
//!   `route_not_available` (OQ-15).
//! - [`decide`]: the pure allow-or-deny decision over the session, the Workspace
//!   kind, the membership and its role bindings, Engagement memberships and
//!   explicit grants. A [`DenyReason`] names only the missing authority, never the
//!   resource, and an unknown resource is refused for the same reason as a
//!   forbidden one.
//!
//! A `private_task` reference is allowed only for its creator. Membership, roles,
//! Engagement membership and `manage_membership` never reach another creator's
//! private Task.

mod decision;
mod policy;

pub(crate) use policy::check_keys;

#[cfg(test)]
mod tests;

pub use decision::AccessRequest;
pub use decision::AuthorityFacts;
pub use decision::Decision;
pub use decision::DenyReason;
pub use decision::Grant;
pub use decision::GrantAudience;
pub use decision::MembershipFacts;
pub use decision::ResourceFacts;
pub use decision::ResourceKind;
pub use decision::ResourceRecord;
pub use decision::ResourceRef;
pub use decision::check_membership;
pub use decision::decide;
pub use policy::Action;
pub use policy::POLICY_FORMAT_VERSION;
pub use policy::PolicyError;
pub use policy::ROLE_ID_MAX_BYTES;
pub use policy::ROLE_LABEL_MAX_CHARS;
pub use policy::RoleDefinition;
pub use policy::RoleId;
pub use policy::RoleKind;
pub use policy::WorkspaceKind;
pub use policy::WorkspacePolicy;
