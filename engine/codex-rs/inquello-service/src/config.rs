//! Service configuration and its fail-closed validation.
//!
//! Lifetimes are explicit inputs with no defaults: they are security-policy values
//! chosen by whoever deploys the service, not promises made by this code. A test
//! issuer is refused unless the crate was built with the `test-issuer` feature
//! *and* the deployment is [`Deployment::SyntheticTest`]. Without TLS the
//! service speaks plain HTTP and must bind a loopback address; with a
//! [`TlsConfig`] it terminates HTTPS itself and may bind any address.
//!
//! Redirect URIs match exactly, except that a registered loopback IP-literal
//! redirect (`http://127.0.0.1/...` or `http://[::1]/...`) accepts any port with
//! the same host and exact path (RFC 8252 §7.3).

use jsonwebtoken::jwk::JwkSet;
use rustls::pki_types::CertificateDer;
use rustls::pki_types::PrivateKeyDer;
use sqlx::postgres::PgConnectOptions;
use std::fmt;
use std::net::SocketAddr;
use std::time::Duration;

/// The issuer URL of the synthetic OIDC test issuer. The `.invalid` top-level
/// domain can never resolve, so it can never name a real issuer.
pub const TEST_ISSUER_URL: &str = "https://test-issuer.inquello.invalid";

/// Key IDs minted by the test issuer start with this prefix.
pub const TEST_KEY_ID_PREFIX: &str = "inquello-test-";

/// The largest accepted ID-token clock-skew allowance.
pub const MAX_CLOCK_SKEW: Duration = Duration::from_secs(300);

/// Where the service runs.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Deployment {
    /// Any deployment that is not the synthetic test topology. Refuses test issuers.
    Production,
    /// The SC-7 synthetic topology. Exists only with the `test-issuer` feature.
    #[cfg(feature = "test-issuer")]
    SyntheticTest,
}

impl Deployment {
    fn allows_test_issuer(self) -> bool {
        match self {
            Deployment::Production => false,
            #[cfg(feature = "test-issuer")]
            Deployment::SyntheticTest => true,
        }
    }
}

/// Explicit lifetimes. None has a default.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Lifetimes {
    /// How long a login transaction stays open.
    pub login_transaction: Duration,
    /// Access-credential lifetime.
    pub access: Duration,
    /// Refresh-credential lifetime (each rotation starts a new one).
    pub refresh: Duration,
    /// Absolute session lifetime from sign-in; refresh never extends it.
    pub session: Duration,
    /// Clock-skew allowance applied to ID-token `exp`, `iat` and `nbf`.
    pub id_token_clock_skew: Duration,
    /// How long an invite issued by a Workspace administrator stays acceptable.
    pub invite: Duration,
}

/// One allowlisted OIDC issuer and the single native client registered with it.
#[derive(Clone, Debug)]
pub struct IssuerConfig {
    /// The exact `iss` value, an `https://` URL.
    pub issuer: String,
    /// The client ID: the required audience and authorized party.
    pub client_id: String,
    /// The exact redirect URIs a login transaction may bind.
    pub redirect_uris: Vec<String>,
    /// The issuer's public signing keys. Every key needs a `kid`.
    pub jwks: JwkSet,
}

impl IssuerConfig {
    /// Whether this names the synthetic test issuer or carries a test key.
    pub fn is_test_issuer(&self) -> bool {
        self.issuer == TEST_ISSUER_URL
            || issuer_host(&self.issuer).is_some_and(|host| {
                let host = host.to_ascii_lowercase();
                host == "invalid" || host.ends_with(".invalid")
            })
            || self.jwks.keys.iter().any(|key| {
                key.common
                    .key_id
                    .as_deref()
                    .is_some_and(|kid| kid.starts_with(TEST_KEY_ID_PREFIX))
            })
    }
}

/// The host part of an `https://` or `http://` URL, without port or user info.
fn issuer_host(url: &str) -> Option<&str> {
    let rest = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))?;
    let authority = rest.split(['/', '?', '#']).next()?;
    let host_port = authority.rsplit('@').next()?;
    let host = match host_port.strip_prefix('[') {
        Some(v6) => v6.split(']').next()?,
        None => host_port.split(':').next()?,
    };
    (!host.is_empty()).then_some(host)
}

/// The HTTPS server identity: a certificate chain (leaf first) and its key.
pub struct TlsConfig {
    pub cert_chain: Vec<CertificateDer<'static>>,
    pub private_key: PrivateKeyDer<'static>,
}

impl Clone for TlsConfig {
    fn clone(&self) -> Self {
        Self {
            cert_chain: self.cert_chain.clone(),
            private_key: self.private_key.clone_key(),
        }
    }
}

impl fmt::Debug for TlsConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // Never print the private key.
        f.debug_struct("TlsConfig")
            .field("cert_chain_len", &self.cert_chain.len())
            .field("private_key", &"<redacted>")
            .finish()
    }
}

/// Splits a loopback IP-literal `http` redirect URI into host and path. Anything
/// with user info, a query, a fragment, another host or a malformed port is not
/// a loopback redirect.
fn loopback_redirect(uri: &str) -> Option<(&str, &str)> {
    let rest = uri.strip_prefix("http://")?;
    let slash = rest.find('/')?;
    let (authority, path) = rest.split_at(slash);
    if path.contains(['?', '#']) || authority.contains('@') {
        return None;
    }
    let (host, port) = match authority.strip_prefix('[') {
        Some(v6) => {
            let (host, after) = v6.split_once(']')?;
            let port = match after {
                "" => None,
                other => Some(other.strip_prefix(':')?),
            };
            (host, port)
        }
        None => match authority.split_once(':') {
            Some((host, port)) => (host, Some(port)),
            None => (authority, None),
        },
    };
    if host != "127.0.0.1" && host != "::1" {
        return None;
    }
    if let Some(port) = port {
        if port.is_empty() || port.len() > 5 || !port.bytes().all(|b| b.is_ascii_digit()) {
            return None;
        }
        match port.parse::<u16>() {
            Ok(0) | Err(_) => return None,
            Ok(_) => {}
        }
    }
    Some((host, path))
}

/// Whether `requested` matches the `registered` redirect URI: exactly, or, for a
/// loopback IP-literal registration, on any port with the same host and exact
/// path (RFC 8252 §7.3).
pub fn redirect_uri_matches(registered: &str, requested: &str) -> bool {
    if registered == requested {
        return true;
    }
    match (loopback_redirect(registered), loopback_redirect(requested)) {
        (Some(registered), Some(requested)) => registered == requested,
        _ => false,
    }
}

/// Whether `requested` matches any of the `registered` redirect URIs.
pub fn redirect_uri_allowed(registered: &[String], requested: &str) -> bool {
    registered
        .iter()
        .any(|candidate| redirect_uri_matches(candidate, requested))
}

/// The PostgreSQL connection settings.
#[derive(Clone)]
pub struct DatabaseConfig {
    pub connect: PgConnectOptions,
    pub max_connections: u32,
    /// How long a request waits for a connection before it is answered
    /// `dependency_unavailable`.
    pub acquire_timeout: Duration,
}

impl fmt::Debug for DatabaseConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // The connect options hold the database password; never print them.
        f.debug_struct("DatabaseConfig")
            .field("connect", &"<redacted>")
            .field("max_connections", &self.max_connections)
            .field("acquire_timeout", &self.acquire_timeout)
            .finish()
    }
}

#[derive(Clone, Debug)]
pub struct ServiceConfig {
    pub deployment: Deployment,
    /// The listener address. Must be loopback unless `tls` is configured.
    pub bind: SocketAddr,
    /// HTTPS termination. Without it the service speaks plain HTTP on loopback.
    pub tls: Option<TlsConfig>,
    pub issuers: Vec<IssuerConfig>,
    pub lifetimes: Lifetimes,
    pub database: DatabaseConfig,
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum ConfigError {
    #[error("issuer {issuer} is a synthetic test issuer, which this deployment refuses")]
    TestIssuerRefused { issuer: String },
    #[error("bind address {bind} is not loopback and no TLS is configured")]
    NonLoopbackBind { bind: SocketAddr },
    #[error("at least one issuer must be configured")]
    NoIssuers,
    #[error("issuer {issuer} is configured more than once")]
    DuplicateIssuer { issuer: String },
    #[error("issuer {issuer} is invalid: {reason}")]
    InvalidIssuer {
        issuer: String,
        reason: &'static str,
    },
    #[error("lifetime {name} is invalid: {reason}")]
    InvalidLifetime {
        name: &'static str,
        reason: &'static str,
    },
    #[error("TLS configuration is invalid: {0}")]
    InvalidTls(&'static str),
    #[error("database pool setting is invalid: {0}")]
    InvalidDatabase(&'static str),
}

impl ServiceConfig {
    /// Checks the configuration before anything is connected or bound.
    pub fn validate(&self) -> Result<(), ConfigError> {
        if !self.bind.ip().is_loopback() && self.tls.is_none() {
            return Err(ConfigError::NonLoopbackBind { bind: self.bind });
        }
        if let Some(tls) = &self.tls
            && tls.cert_chain.is_empty()
        {
            return Err(ConfigError::InvalidTls("a certificate chain is required"));
        }
        if self.issuers.is_empty() {
            return Err(ConfigError::NoIssuers);
        }
        for (index, issuer) in self.issuers.iter().enumerate() {
            if issuer.is_test_issuer() && !self.deployment.allows_test_issuer() {
                return Err(ConfigError::TestIssuerRefused {
                    issuer: issuer.issuer.clone(),
                });
            }
            if self.issuers[..index]
                .iter()
                .any(|earlier| earlier.issuer == issuer.issuer)
            {
                return Err(ConfigError::DuplicateIssuer {
                    issuer: issuer.issuer.clone(),
                });
            }
            let invalid = |reason| ConfigError::InvalidIssuer {
                issuer: issuer.issuer.clone(),
                reason,
            };
            if !issuer.issuer.starts_with("https://") || issuer_host(&issuer.issuer).is_none() {
                return Err(invalid("issuer must be an https URL"));
            }
            if issuer.client_id.is_empty() {
                return Err(invalid("client ID must not be empty"));
            }
            if issuer.redirect_uris.is_empty() || issuer.redirect_uris.iter().any(String::is_empty)
            {
                return Err(invalid("at least one non-empty redirect URI is required"));
            }
            if issuer.jwks.keys.is_empty() {
                return Err(invalid("at least one signing key is required"));
            }
        }
        self.lifetimes.validate()?;
        if self.database.max_connections == 0 {
            return Err(ConfigError::InvalidDatabase(
                "max_connections must be at least 1",
            ));
        }
        if self.database.acquire_timeout.is_zero() {
            return Err(ConfigError::InvalidDatabase(
                "acquire_timeout must be positive",
            ));
        }
        Ok(())
    }
}

impl Lifetimes {
    fn validate(&self) -> Result<(), ConfigError> {
        let invalid = |name, reason| ConfigError::InvalidLifetime { name, reason };
        for (name, value) in [
            ("login_transaction", self.login_transaction),
            ("access", self.access),
            ("refresh", self.refresh),
            ("session", self.session),
            ("invite", self.invite),
        ] {
            if value.is_zero() {
                return Err(invalid(name, "must be positive"));
            }
            if chrono::Duration::from_std(value).is_err() {
                return Err(invalid(name, "is too large"));
            }
        }
        if self.access > self.session {
            return Err(invalid("access", "must not exceed the session lifetime"));
        }
        if self.refresh > self.session {
            return Err(invalid("refresh", "must not exceed the session lifetime"));
        }
        if self.id_token_clock_skew > MAX_CLOCK_SKEW {
            return Err(invalid(
                "id_token_clock_skew",
                "must be at most five minutes",
            ));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn issuer_host_parses_common_forms() {
        assert_eq!(
            issuer_host("https://issuer.example.com"),
            Some("issuer.example.com")
        );
        assert_eq!(
            issuer_host("https://issuer.example.com:8443/tenant"),
            Some("issuer.example.com")
        );
        assert_eq!(issuer_host("https://user@h.invalid/"), Some("h.invalid"));
        assert_eq!(issuer_host("https://[::1]:9/"), Some("::1"));
        assert_eq!(issuer_host("ftp://x"), None);
        assert_eq!(issuer_host("https:///path"), None);
    }

    #[test]
    fn loopback_redirects_match_any_port_with_the_exact_path() {
        let registered = "http://127.0.0.1/callback";
        for requested in [
            "http://127.0.0.1/callback",
            "http://127.0.0.1:1/callback",
            "http://127.0.0.1:53682/callback",
            "http://127.0.0.1:65535/callback",
        ] {
            assert!(redirect_uri_matches(registered, requested), "{requested}");
        }
        assert!(redirect_uri_matches(
            "http://127.0.0.1:9/callback",
            "http://127.0.0.1:40000/callback"
        ));
        assert!(redirect_uri_matches(
            "http://[::1]/callback",
            "http://[::1]:40000/callback"
        ));
        for requested in [
            "http://127.0.0.1:53682/callback/",
            "http://127.0.0.1:53682/Callback",
            "http://127.0.0.1:53682/other",
            "http://127.0.0.1:53682/callback?x=1",
            "http://127.0.0.1:53682/callback#x",
            "http://127.0.0.1:0/callback",
            "http://127.0.0.1:65536/callback",
            "http://127.0.0.1:/callback",
            "http://127.0.0.1:+80/callback",
            "http://localhost:53682/callback",
            "http://[::1]:53682/callback",
            "http://user@127.0.0.1:53682/callback",
            "https://127.0.0.1:53682/callback",
            "http://127.0.0.2:53682/callback",
            "http://127.0.0.1:53682",
        ] {
            assert!(!redirect_uri_matches(registered, requested), "{requested}");
        }
        // A non-loopback registration matches exactly only.
        assert!(redirect_uri_matches(
            "https://app.example.com/cb",
            "https://app.example.com/cb"
        ));
        assert!(!redirect_uri_matches(
            "https://app.example.com/cb",
            "https://app.example.com:444/cb"
        ));
        assert!(!redirect_uri_matches(
            "http://localhost/callback",
            "http://localhost:5/callback"
        ));
    }

    #[test]
    fn test_issuer_detection_covers_url_host_and_key_ids() {
        let issuer = |url: &str, kid: Option<&str>| {
            let jwks: JwkSet = serde_json::from_value(serde_json::json!({
                "keys": [{
                    "kty": "EC", "crv": "P-256",
                    "x": "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",
                    "y": "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0",
                    "kid": kid,
                }]
            }))
            .expect("jwks");
            IssuerConfig {
                issuer: url.to_string(),
                client_id: "c".to_string(),
                redirect_uris: vec!["http://127.0.0.1/cb".to_string()],
                jwks,
            }
        };
        assert!(issuer(TEST_ISSUER_URL, Some("k")).is_test_issuer());
        assert!(issuer("https://other.INVALID/x", Some("k")).is_test_issuer());
        assert!(issuer("https://idp.example.com", Some("inquello-test-1")).is_test_issuer());
        assert!(!issuer("https://idp.example.com", Some("prod-key")).is_test_issuer());
    }
}
