//! Inquello's shared service: the authority for identity, sessions and
//! principal-scoped session commands (SC-1, SC-2) in the SC-7 synthetic topology.
//!
//! - **Login transaction** ([`config::IssuerConfig`] allowlist): expiring and
//!   one-use, binding a service nonce, issuer, client and redirect URI.
//! - **Bootstrap**: the service validates the ID token's signature and key,
//!   `iss`, `aud`, `azp`, `exp` and nonce itself, then consumes the transaction
//!   and creates the session in one PostgreSQL transaction. A principal is keyed
//!   by `(issuer, subject)`; email and name are attributes, never link keys.
//! - **Sessions**: opaque short-lived access credentials and rotating refresh
//!   credentials. Only SHA-256 hashes are stored. Reusing a rotated refresh
//!   credential revokes the whole refresh family.
//! - **Protected requests** resolve session, principal and revisions inside the
//!   request transaction, locking principal before session. Anything other than a
//!   current, active session is blocked; an unreachable database is
//!   `dependency_unavailable`. There is no cached fallback.
//! - **SC-2 receipts**: session commands carry the SC-2 envelope; the receipt,
//!   the mutation and the authorization check share one transaction.
//!
//! - **Workspaces** (Story 1.11): `internal_company` Workspaces with a versioned
//!   role policy (`audit_team` and `reviewer` kinds only), memberships with role
//!   bindings, Engagements, identity-bound one-use invites, Workspace-scoped SC-2
//!   membership commands and access checks. Every decision is the domain's
//!   [`inquello_domain::authorization::decide`] over facts read under the lock
//!   order principal → session → Workspace authorization epoch → resource. A
//!   private Task is reachable only by its creator. Workspaces are created only
//!   through the operator CLI ([`admin`], `inquello-service admin`), never over
//!   HTTP; `external_audit` is `route_not_available`.
//!
//! - **Transport**: plain HTTP on loopback only, or HTTPS terminated by the
//!   service itself (rustls) when a [`TlsConfig`] is given, which may then bind
//!   any address.
//!
//! The test OIDC issuer, the synthetic OIDC provider, the ephemeral test CA and
//! the `inquello-dev-topology` binary exist only behind the `test-issuer`
//! feature, and a production deployment refuses a test issuer.

pub mod admin;
mod clock;
mod commands;
pub mod config;
mod credentials;
mod digest;
mod error;
mod login;
mod oidc;
pub mod postgres;
mod routes;
mod server;
mod sessions;
#[cfg(feature = "test-issuer")]
pub mod test_issuer;
#[cfg(feature = "test-issuer")]
pub mod test_provider;
#[cfg(feature = "test-issuer")]
pub mod test_tls;
mod tls;
mod workspace_commands;
mod workspaces;

pub use clock::Clock;
pub use clock::SystemClock;
pub use clock::truncate_to_millis;
pub use config::ConfigError;
pub use config::DatabaseConfig;
pub use config::Deployment;
pub use config::IssuerConfig;
pub use config::Lifetimes;
pub use config::ServiceConfig;
pub use config::TlsConfig;
pub use config::redirect_uri_allowed;
pub use config::redirect_uri_matches;
pub use oidc::KeyConfigError;
pub use server::RunningService;
pub use server::StartError;
pub use server::start;
pub use tls::TlsSetupError;
