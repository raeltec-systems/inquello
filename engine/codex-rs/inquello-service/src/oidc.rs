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
}

/// The validated identity claims the service uses.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct IdentityClaims {
    pub(crate) subject: String,
    pub(crate) email: Option<String>,
    pub(crate) name: Option<String>,
    pub(crate) expires_at: DateTime<Utc>,
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
        Ok(IdentityClaims {
            subject: claims.sub,
            email: claims.email,
            name: claims.name,
            expires_at,
        })
    }
}
