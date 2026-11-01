//! The SC-1 ID-token validation adapter.
//!
//! The service validates every ID token itself and never trusts a claim a client
//! parsed. A token is accepted only when all of these hold:
//!
//! - the header names a `kid` of a configured key for the transaction's issuer,
//!   and its `alg` is the one that key supports (no `none`, no HMAC, no embedded
//!   or remote keys);
//! - the signature verifies;
//! - `iss` equals the transaction's issuer and `aud` contains its client ID;
//! - `azp`, when present, equals the client ID, and it is required when `aud`
//!   has more than one value;
//! - `exp` is in the future and `iat`/`nbf` are not in the future, using the
//!   service clock and the configured skew;
//! - `nonce` equals the login transaction's nonce;
//! - `sub` is present and non-empty.

use crate::config::IssuerConfig;
use chrono::DateTime;
use chrono::Utc;
use jsonwebtoken::Algorithm;
use jsonwebtoken::DecodingKey;
use jsonwebtoken::Validation;
use jsonwebtoken::jwk::AlgorithmParameters;
use jsonwebtoken::jwk::EllipticCurve;
use jsonwebtoken::jwk::Jwk;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;

/// The longest ID token accepted.
pub(crate) const MAX_ID_TOKEN_BYTES: usize = 16 * 1024;

/// The longest accepted `sub`, per OIDC Core.
const MAX_SUBJECT_BYTES: usize = 255;

struct TrustedKey {
    kid: String,
    algorithm: Algorithm,
    key: DecodingKey,
}

/// A configured issuer with its keys prepared for verification.
pub(crate) struct TrustedIssuer {
    pub(crate) issuer: String,
    pub(crate) client_id: String,
    pub(crate) redirect_uris: Vec<String>,
    keys: Vec<TrustedKey>,
    discovery: bool,
    rotating: tokio::sync::Mutex<RotatingKeys>,
    refresh_gate: tokio::sync::Semaphore,
}

/// The validated identity claims the service uses.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct IdentityClaims {
    pub(crate) subject: String,
    pub(crate) email: Option<String>,
    pub(crate) name: Option<String>,
    pub(crate) expires_at: DateTime<Utc>,
    /// Only a signed boolean true confers proof; display email never does.
    pub(crate) verified_email: Option<String>,
    pub(crate) issued_at: DateTime<Utc>,
}

/// Why a key could not be trusted at startup.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("issuer {issuer}: {reason}")]
pub struct KeyConfigError {
    pub issuer: String,
    pub reason: &'static str,
}

/// Why a token was rejected. Logged as a static reason; never sent to clients.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct TokenRejection(pub(crate) &'static str);

/// `aud` is either one string or an array. jsonwebtoken has already checked the
/// values; only the count matters here.
#[derive(Deserialize)]
#[serde(untagged)]
enum Audience {
    Many(Vec<String>),
    One(serde::de::IgnoredAny),
}

#[derive(Deserialize)]
struct RawClaims {
    sub: String,
    aud: Audience,
    #[serde(default)]
    azp: Option<String>,
    exp: i64,
    iat: i64,
    #[serde(default)]
    nbf: Option<i64>,
    #[serde(default)]
    nonce: Option<String>,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    email_verified: bool,
    #[serde(default)]
    name: Option<String>,
}

fn key_algorithm(jwk: &Jwk) -> Option<Algorithm> {
    let from_params = match &jwk.algorithm {
        AlgorithmParameters::EllipticCurve(params) => match params.curve {
            EllipticCurve::P256 => Algorithm::ES256,
            EllipticCurve::P384 => Algorithm::ES384,
            _ => return None,
        },
        AlgorithmParameters::RSA(_) => Algorithm::RS256,
        AlgorithmParameters::OctetKeyPair(params) => match params.curve {
            EllipticCurve::Ed25519 => Algorithm::EdDSA,
            _ => return None,
        },
        // Symmetric keys cannot authenticate an external issuer.
        AlgorithmParameters::OctetKey(_) => return None,
    };
    match jwk.common.key_algorithm {
        None => Some(from_params),
        Some(declared) => {
            let declared = Algorithm::from_str(&declared.to_string()).ok()?;
            let compatible = match &jwk.algorithm {
                AlgorithmParameters::RSA(_) => matches!(
                    declared,
                    Algorithm::RS256
                        | Algorithm::RS384
                        | Algorithm::RS512
                        | Algorithm::PS256
                        | Algorithm::PS384
                        | Algorithm::PS512
                ),
                _ => declared == from_params,
            };
            compatible.then_some(declared)
        }
    }
}

impl TrustedIssuer {
    pub(crate) fn from_config(config: &IssuerConfig) -> Result<Self, KeyConfigError> {
        let error = |reason| KeyConfigError {
            issuer: config.issuer.clone(),
            reason,
        };
        let mut keys = Vec::with_capacity(config.jwks.keys.len());
        for jwk in &config.jwks.keys {
            let kid = jwk
                .common
                .key_id
                .clone()
                .filter(|kid| !kid.is_empty())
                .ok_or_else(|| error("every signing key needs a kid"))?;
            if keys.iter().any(|key: &TrustedKey| key.kid == kid) {
                return Err(error("duplicate kid"));
            }
            let algorithm =
                key_algorithm(jwk).ok_or_else(|| error("unsupported or symmetric signing key"))?;
            let key = DecodingKey::from_jwk(jwk).map_err(|_| error("unreadable signing key"))?;
            keys.push(TrustedKey {
                kid,
                algorithm,
                key,
            });
        }
        Ok(Self {
            issuer: config.issuer.clone(),
            client_id: config.client_id.clone(),
            redirect_uris: config.redirect_uris.clone(),
            keys,
            discovery: config.jwks.keys.is_empty(),
            rotating: tokio::sync::Mutex::new(RotatingKeys::default()),
            refresh_gate: tokio::sync::Semaphore::new(1),
        })
    }

    /// Validates `token` for a login transaction with `expected_nonce`.
    pub(crate) fn validate(
        &self,
        token: &str,
        expected_nonce: &str,
        now: DateTime<Utc>,
        skew: Duration,
    ) -> Result<IdentityClaims, TokenRejection> {
        if token.is_empty() || token.len() > MAX_ID_TOKEN_BYTES {
            return Err(TokenRejection("token length out of range"));
        }
        let header =
            jsonwebtoken::decode_header(token).map_err(|_| TokenRejection("unreadable header"))?;
        let kid = header
            .kid
            .as_deref()
            .ok_or(TokenRejection("header has no kid"))?;
        let key = self
            .keys
            .iter()
            .find(|key| key.kid == kid)
            .ok_or(TokenRejection("unknown kid"))?;
        if header.alg != key.algorithm {
            return Err(TokenRejection("algorithm does not match the key"));
        }

        let mut validation = Validation::new(key.algorithm);
        validation.set_issuer(&[&self.issuer]);
        validation.set_audience(&[&self.client_id]);
        validation.set_required_spec_claims(&["exp", "iss", "aud", "sub"]);
        // Time claims are checked below against the service clock.
        validation.validate_exp = false;
        validation.validate_nbf = false;
        let claims = jsonwebtoken::decode::<RawClaims>(token, &key.key, &validation)
            .map_err(|error| {
                use jsonwebtoken::errors::ErrorKind;
                TokenRejection(match error.kind() {
                    ErrorKind::InvalidSignature => "invalid signature",
                    ErrorKind::InvalidIssuer => "wrong issuer",
                    ErrorKind::InvalidAudience => "wrong audience",
                    ErrorKind::MissingRequiredClaim(_) => "missing required claim",
                    ErrorKind::InvalidAlgorithm => "invalid algorithm",
                    _ => "malformed token",
                })
            })?
            .claims;

        let audiences = match &claims.aud {
            Audience::One(_) => 1,
            Audience::Many(values) => values.len(),
        };
        match claims.azp.as_deref() {
            Some(azp) if azp != self.client_id => {
                return Err(TokenRejection("wrong authorized party"));
            }
            None if audiences > 1 => {
                return Err(TokenRejection(
                    "authorized party required for several audiences",
                ));
            }
            _ => {}
        }

        let skew = i64::try_from(skew.as_secs()).unwrap_or(i64::MAX);
        let now_secs = now.timestamp();
        if claims.exp.saturating_add(skew) <= now_secs {
            return Err(TokenRejection("token expired"));
        }
        if claims.iat > now_secs.saturating_add(skew) {
            return Err(TokenRejection("token issued in the future"));
        }
        if claims
            .nbf
            .is_some_and(|nbf| nbf > now_secs.saturating_add(skew))
        {
            return Err(TokenRejection("token not yet valid"));
        }
        if claims.nonce.as_deref() != Some(expected_nonce) {
            return Err(TokenRejection("nonce does not match the login transaction"));
        }
        if claims.sub.is_empty() || claims.sub.len() > MAX_SUBJECT_BYTES {
            return Err(TokenRejection("subject out of range"));
        }
        let expires_at =
            DateTime::from_timestamp(claims.exp, 0).ok_or(TokenRejection("expiry out of range"))?;
        let issued_at = DateTime::from_timestamp(claims.iat, 0)
            .ok_or(TokenRejection("issued time out of range"))?;
        let verified_email = claims
            .email
            .as_deref()
            .filter(|_| claims.email_verified)
            .and_then(normalize_email);
        Ok(IdentityClaims {
            verified_email,
            issued_at,
            subject: claims.sub,
            email: claims.email,
            name: claims.name,
            expires_at,
        })
    }
}

/// Conservative mailbox matching: preserve local-part case; canonicalize only
/// the ASCII DNS domain. No plus/dot stripping or cross-issuer account linking.
pub(crate) fn normalize_email(value: &str) -> Option<String> {
    if value.len() > 254
        || !value.is_ascii()
        || value
            .bytes()
            .any(|b| b.is_ascii_whitespace() || b.is_ascii_control())
    {
        return None;
    }
    let (local, domain) = value.split_once('@')?;
    if local.is_empty()
        || local.len() > 64
        || domain.is_empty()
        || domain.contains('@')
        || !domain.contains('.')
        || domain.starts_with('.')
        || domain.ends_with('.')
        || !domain
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'-')
    {
        return None;
    }
    Some(format!("{local}@{}", domain.to_ascii_lowercase()))
}

// Five-minute hard revocation bound; unknown-key misses share a 30s refresh
// budget. A semaphore makes refresh single-flight across concurrent logins;
// the cache mutex is never held across network I/O.
#[derive(Default)]
struct RotatingKeys {
    issuer: Option<Box<TrustedIssuer>>,
    refreshed: Option<std::time::Instant>,
    attempted: Option<std::time::Instant>,
}

#[derive(Deserialize)]
struct Discovery {
    issuer: String,
    jwks_uri: String,
}

impl TrustedIssuer {
    pub(crate) async fn validate_current(
        &self,
        token: &str,
        nonce: &str,
        now: DateTime<Utc>,
        skew: Duration,
    ) -> Result<IdentityClaims, TokenRejection> {
        if !self.discovery {
            return self.validate(token, nonce, now, skew);
        }
        if token.is_empty() || token.len() > MAX_ID_TOKEN_BYTES {
            return Err(TokenRejection("token length out of range"));
        }
        self.validate_rotating(token, nonce, now, skew, || self.discover())
            .await
    }

    async fn validate_rotating<F, Fut>(
        &self,
        token: &str,
        nonce: &str,
        now: DateTime<Utc>,
        skew: Duration,
        refresh: F,
    ) -> Result<IdentityClaims, TokenRejection>
    where
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = Result<Self, TokenRejection>>,
    {
        // A semaphore serializes refresh work; cache guards never cross I/O.
        let _permit = self
            .refresh_gate
            .acquire()
            .await
            .map_err(|_| TokenRejection("issuer keys temporarily unavailable"))?;
        {
            let mut cache = self.rotating.lock().await;
            let fresh = cache
                .refreshed
                .is_some_and(|at| at.elapsed() < Duration::from_secs(300));
            if fresh && let Some(issuer) = &cache.issuer {
                match issuer.validate(token, nonce, now, skew) {
                    Err(TokenRejection("unknown kid")) => {}
                    outcome => return outcome,
                }
            }
            if cache
                .attempted
                .is_some_and(|at| at.elapsed() < Duration::from_secs(30))
            {
                return Err(TokenRejection("issuer keys temporarily unavailable"));
            }
            cache.attempted = Some(std::time::Instant::now());
        }
        let issuer = refresh().await?;
        let outcome = issuer.validate(token, nonce, now, skew);
        let mut cache = self.rotating.lock().await;
        cache.issuer = Some(Box::new(issuer));
        cache.refreshed = Some(std::time::Instant::now());
        outcome
    }

    async fn discover(&self) -> Result<Self, TokenRejection> {
        let reject = || TokenRejection("issuer discovery unavailable");
        let base = url::Url::parse(&self.issuer).map_err(|_| reject())?;
        if base.scheme() != "https"
            || !base.username().is_empty()
            || base.password().is_some()
            || base.query().is_some()
            || base.fragment().is_some()
        {
            return Err(reject());
        }
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(5))
            .build()
            .map_err(|_| reject())?;
        let discovery_url = format!(
            "{}/.well-known/openid-configuration",
            self.issuer.trim_end_matches('/')
        );
        let document: Discovery = bounded_json(&client, &discovery_url).await?;
        let keys_url = url::Url::parse(&document.jwks_uri).map_err(|_| reject())?;
        if document.issuer != self.issuer
            || keys_url.scheme() != "https"
            || keys_url.origin() != base.origin()
            || !keys_url.username().is_empty()
            || keys_url.password().is_some()
            || keys_url.fragment().is_some()
        {
            return Err(reject());
        }
        let jwks: jsonwebtoken::jwk::JwkSet = bounded_json(&client, keys_url.as_str()).await?;
        if jwks.keys.is_empty() || jwks.keys.len() > 16 {
            return Err(reject());
        }
        Self::from_config(&IssuerConfig {
            issuer: self.issuer.clone(),
            client_id: self.client_id.clone(),
            redirect_uris: self.redirect_uris.clone(),
            jwks,
        })
        .map_err(|_| reject())
    }
}

async fn bounded_json<T: serde::de::DeserializeOwned>(
    client: &reqwest::Client,
    url: &str,
) -> Result<T, TokenRejection> {
    let reject = || TokenRejection("issuer discovery unavailable");
    let mut response = client.get(url).send().await.map_err(|_| reject())?;
    if !response.status().is_success() || response.content_length().is_some_and(|n| n > 262_144) {
        return Err(reject());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| reject())? {
        if bytes.len() + chunk.len() > 262_144 {
            return Err(reject());
        }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes).map_err(|_| reject())
}

#[cfg(all(test, feature = "test-issuer"))]
mod onboarding_tests {
    use super::*;
    use crate::test_issuer::{TestIssuer, TokenFixture};
    #[test]
    fn verified_claim_is_explicit_and_normalization_is_not_account_linking() {
        assert_eq!(
            normalize_email("Theo@EXAMPLE.INVALID").as_deref(),
            Some("Theo@example.invalid")
        );
        assert_ne!(
            normalize_email("Theo@example.invalid"),
            normalize_email("theo@example.invalid")
        );
        for invalid in [
            "",
            "a@",
            "@example.invalid",
            "a@b@c.invalid",
            "a b@example.invalid",
            "a@.example.invalid",
        ] {
            assert_eq!(normalize_email(invalid), None);
        }
        let issuer = TestIssuer::new();
        let trusted = TrustedIssuer::from_config(
            &issuer.issuer_config("client", &["http://127.0.0.1/callback"]),
        )
        .unwrap_or_else(|_| panic!("keys"));
        let now = Utc::now();
        let mut fixture = TokenFixture::valid(&issuer, "client", "Theo", "nonce", now);
        let claims = trusted
            .validate(&issuer.sign(&fixture), "nonce", now, Duration::ZERO)
            .unwrap_or_else(|_| panic!("token"));
        assert!(claims.verified_email.is_none());
        fixture.email_verified = true;
        let claims = trusted
            .validate(&issuer.sign(&fixture), "nonce", now, Duration::ZERO)
            .unwrap_or_else(|_| panic!("token"));
        assert_eq!(
            claims.verified_email.as_deref(),
            Some("Theo@synthetic.invalid")
        );
        assert_eq!(claims.issued_at.timestamp(), fixture.issued_at.timestamp());
        assert!(
            trusted
                .validate(&issuer.sign(&fixture), "wrong", now, Duration::ZERO)
                .is_err()
        );
        let other_key = TestIssuer::new();
        assert!(
            trusted
                .validate(&other_key.sign(&fixture), "nonce", now, Duration::ZERO)
                .is_err()
        );
    }
}

#[cfg(all(test, feature = "test-issuer"))]
mod rotation_tests {
    use super::*;
    use crate::test_issuer::{TestIssuer, TokenFixture};
    use std::sync::atomic::{AtomicUsize, Ordering};
    fn prepared(issuer: &TestIssuer) -> TrustedIssuer {
        TrustedIssuer::from_config(&issuer.issuer_config("native", &["http://127.0.0.1/callback"]))
            .unwrap_or_else(|_| panic!("test keys"))
    }
    fn rotating(issuer: &TestIssuer) -> TrustedIssuer {
        let mut config = issuer.issuer_config("native", &["http://127.0.0.1/callback"]);
        config.jwks.keys.clear();
        TrustedIssuer::from_config(&config).unwrap_or_else(|_| panic!("rotating issuer"))
    }
    #[tokio::test]
    async fn rotates_unknown_keys_rate_limits_and_never_uses_expired_cache() {
        let first = TestIssuer::new();
        let second = TestIssuer::with_issuer(first.issuer());
        let authority = rotating(&first);
        let now = Utc::now();
        let a = first.sign(&TokenFixture::valid(&first, "native", "Maya", "nonce", now));
        let b = second.sign(&TokenFixture::valid(
            &second, "native", "Maya", "nonce", now,
        ));
        let fetches = AtomicUsize::new(0);
        let fetch_first = || async {
            fetches.fetch_add(1, Ordering::SeqCst);
            Ok(prepared(&first))
        };
        let fetch_second = || async {
            fetches.fetch_add(1, Ordering::SeqCst);
            Ok(prepared(&second))
        };
        let (one, two) = tokio::join!(
            authority.validate_rotating(&a, "nonce", now, Duration::ZERO, fetch_first),
            authority.validate_rotating(&a, "nonce", now, Duration::ZERO, fetch_first)
        );
        assert!(one.is_ok() && two.is_ok());
        assert_eq!(fetches.load(Ordering::SeqCst), 1);
        assert!(
            authority
                .validate_rotating(&b, "nonce", now, Duration::ZERO, fetch_second)
                .await
                .is_err()
        );
        assert_eq!(fetches.load(Ordering::SeqCst), 1);
        authority.rotating.lock().await.attempted =
            std::time::Instant::now().checked_sub(Duration::from_secs(31));
        assert!(
            authority
                .validate_rotating(&b, "nonce", now, Duration::ZERO, fetch_second)
                .await
                .is_ok()
        );
        assert_eq!(fetches.load(Ordering::SeqCst), 2);
        assert!(
            authority
                .validate_rotating(&a, "nonce", now, Duration::ZERO, fetch_first)
                .await
                .is_err()
        );
        // Invalid nonce/signature never cause a key fetch.
        assert!(
            authority
                .validate_rotating(&b, "wrong", now, Duration::ZERO, fetch_first)
                .await
                .is_err()
        );
        assert_eq!(fetches.load(Ordering::SeqCst), 2);
        {
            let mut cache = authority.rotating.lock().await;
            cache.refreshed = std::time::Instant::now().checked_sub(Duration::from_secs(301));
            cache.attempted = std::time::Instant::now().checked_sub(Duration::from_secs(31));
        }
        assert!(
            authority
                .validate_rotating(&b, "nonce", now, Duration::ZERO, || async {
                    Err(TokenRejection("issuer discovery unavailable"))
                })
                .await
                .is_err()
        );
        // An expired key stays unusable even though an immediate refresh is throttled.
        assert!(
            authority
                .validate_rotating(&b, "nonce", now, Duration::ZERO, fetch_second)
                .await
                .is_err()
        );
        assert_eq!(fetches.load(Ordering::SeqCst), 2);
    }
}
