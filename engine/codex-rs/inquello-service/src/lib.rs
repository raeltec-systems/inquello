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
//! The test OIDC issuer exists only behind the `test-issuer` feature, and a
//! production deployment refuses one.

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

pub use clock::Clock;
pub use clock::SystemClock;
pub use clock::truncate_to_millis;
pub use config::ConfigError;
pub use config::DatabaseConfig;
pub use config::Deployment;
pub use config::IssuerConfig;
pub use config::Lifetimes;
pub use config::ServiceConfig;
pub use oidc::KeyConfigError;
pub use server::RunningService;
pub use server::StartError;
pub use server::start;
