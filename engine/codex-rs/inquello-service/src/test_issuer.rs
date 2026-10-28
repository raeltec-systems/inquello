//! The synthetic OIDC test issuer (SC-7). Compiled only with the `test-issuer`
//! feature.
//!
//! Each [`TestIssuer`] generates an ephemeral P-256 signing key in memory when it
//! is created; the key is never written anywhere and dies with the value. Tokens
//! are ES256 JWTs whose claims come from a [`TokenFixture`]: the claim set is a
//! deterministic function of the fixture's fields, and helper constructors give
//! the standard valid and invalid variants used by the conformance tests. Nothing
//! produced here is evidence that a real issuer integration works.

use crate::config::IssuerConfig;
use crate::config::TEST_ISSUER_URL;
use crate::config::TEST_KEY_ID_PREFIX;
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use chrono::DateTime;
use chrono::TimeDelta;
use chrono::Utc;
use jsonwebtoken::Algorithm;
use jsonwebtoken::EncodingKey;
use jsonwebtoken::Header;
use jsonwebtoken::jwk::AlgorithmParameters;
use jsonwebtoken::jwk::CommonParameters;
use jsonwebtoken::jwk::EllipticCurve;
use jsonwebtoken::jwk::EllipticCurveKeyParameters;
use jsonwebtoken::jwk::EllipticCurveKeyType;
use jsonwebtoken::jwk::Jwk;
use jsonwebtoken::jwk::JwkSet;
use jsonwebtoken::jwk::KeyAlgorithm;
use jsonwebtoken::jwk::PublicKeyUse;
use ring::rand::SystemRandom;
use ring::signature::ECDSA_P256_SHA256_FIXED_SIGNING;
use ring::signature::EcdsaKeyPair;
use ring::signature::KeyPair;
use serde_json::Map;
use serde_json::Value;
use serde_json::json;
use std::fmt;

/// An in-process OIDC issuer with an ephemeral ES256 key.
pub struct TestIssuer {
    issuer: String,
    kid: String,
    encoding_key: EncodingKey,
    jwk: Jwk,
}

impl fmt::Debug for TestIssuer {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("TestIssuer")
            .field("issuer", &self.issuer)
            .field("kid", &self.kid)
            .finish_non_exhaustive()
    }
}

impl TestIssuer {
    /// The synthetic issuer at [`TEST_ISSUER_URL`] with a fresh key.
    pub fn new() -> Self {
        Self::with_issuer(TEST_ISSUER_URL)
    }

    /// A synthetic issuer at another (test-only) URL, for example a second issuer
    /// or one whose key the service does not trust.
    pub fn with_issuer(issuer: &str) -> Self {
        let rng = SystemRandom::new();
        let pkcs8 = EcdsaKeyPair::generate_pkcs8(&ECDSA_P256_SHA256_FIXED_SIGNING, &rng)
            .unwrap_or_else(|_| panic!("generate an ephemeral P-256 key"));
        let pair = EcdsaKeyPair::from_pkcs8(&ECDSA_P256_SHA256_FIXED_SIGNING, pkcs8.as_ref(), &rng)
            .unwrap_or_else(|_| panic!("load the ephemeral P-256 key"));
        // Uncompressed SEC1 point: 0x04 || x (32 bytes) || y (32 bytes).
        let public = pair.public_key().as_ref();
        let (x, y) = public[1..].split_at(32);
        let kid = format!("{TEST_KEY_ID_PREFIX}{}", uuid::Uuid::new_v4().simple());
        let jwk = Jwk {
            common: CommonParameters {
                public_key_use: Some(PublicKeyUse::Signature),
                key_algorithm: Some(KeyAlgorithm::ES256),
                key_id: Some(kid.clone()),
                ..CommonParameters::default()
            },
            algorithm: AlgorithmParameters::EllipticCurve(EllipticCurveKeyParameters {
                key_type: EllipticCurveKeyType::EC,
                curve: EllipticCurve::P256,
                x: URL_SAFE_NO_PAD.encode(x),
                y: URL_SAFE_NO_PAD.encode(y),
            }),
        };
        Self {
            issuer: issuer.to_string(),
            kid,
            encoding_key: EncodingKey::from_ec_der(pkcs8.as_ref()),
            jwk,
        }
    }

    pub fn issuer(&self) -> &str {
        &self.issuer
    }

    pub fn kid(&self) -> &str {
        &self.kid
    }

    /// The public JWKS a relying party trusts for this issuer.
    pub fn jwks(&self) -> JwkSet {
        JwkSet {
            keys: vec![self.jwk.clone()],
        }
    }

    /// An allowlist entry for this issuer and one native client.
    pub fn issuer_config(&self, client_id: &str, redirect_uris: &[&str]) -> IssuerConfig {
        IssuerConfig {
            issuer: self.issuer.clone(),
            client_id: client_id.to_string(),
            redirect_uris: redirect_uris.iter().map(ToString::to_string).collect(),
            jwks: self.jwks(),
        }
    }

    /// Signs `fixture`'s claims with this issuer's key and `kid`.
    pub fn sign(&self, fixture: &TokenFixture) -> String {
        let mut header = Header::new(Algorithm::ES256);
        header.kid = Some(self.kid.clone());
        self.sign_with_header(&header, fixture)
    }

    /// Signs with an explicit header (for example a wrong or missing `kid`).
    pub fn sign_with_header(&self, header: &Header, fixture: &TokenFixture) -> String {
        jsonwebtoken::encode(header, &fixture.claims(), &self.encoding_key)
            .unwrap_or_else(|error| panic!("sign a test token: {error}"))
    }
}

impl Default for TestIssuer {
    fn default() -> Self {
        Self::new()
    }
}

/// The claims of one test ID token. [`TokenFixture::claims`] is deterministic.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TokenFixture {
    pub issuer: String,
    pub subject: String,
    pub audience: Vec<String>,
    pub authorized_party: Option<String>,
    pub nonce: Option<String>,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub email: Option<String>,
    pub name: Option<String>,
}

impl TokenFixture {
    /// A token the service should accept: issued now, valid for five minutes,
    /// audience and authorized party set to `client_id`, with `nonce`.
    pub fn valid(
        issuer: &TestIssuer,
        client_id: &str,
        subject: &str,
        nonce: &str,
        now: DateTime<Utc>,
    ) -> Self {
        Self {
            issuer: issuer.issuer().to_string(),
            subject: subject.to_string(),
            audience: vec![client_id.to_string()],
            authorized_party: Some(client_id.to_string()),
            nonce: Some(nonce.to_string()),
            issued_at: now,
            expires_at: now + TimeDelta::minutes(5),
            email: Some(format!("{subject}@synthetic.invalid")),
            name: Some(format!("Synthetic {subject}")),
        }
    }

    pub fn with_issuer(mut self, issuer: &str) -> Self {
        self.issuer = issuer.to_string();
        self
    }

    pub fn with_audience(mut self, audience: &[&str]) -> Self {
        self.audience = audience.iter().map(ToString::to_string).collect();
        self
    }

    pub fn with_authorized_party(mut self, azp: Option<&str>) -> Self {
        self.authorized_party = azp.map(ToString::to_string);
        self
    }

    pub fn with_nonce(mut self, nonce: Option<&str>) -> Self {
        self.nonce = nonce.map(ToString::to_string);
        self
    }

    pub fn with_email(mut self, email: Option<&str>) -> Self {
        self.email = email.map(ToString::to_string);
        self
    }

    pub fn expiring_at(mut self, expires_at: DateTime<Utc>) -> Self {
        self.expires_at = expires_at;
        self
    }

    /// The JWT claim set.
    pub fn claims(&self) -> Value {
        let mut claims = Map::new();
        claims.insert("iss".to_string(), json!(self.issuer));
        claims.insert("sub".to_string(), json!(self.subject));
        claims.insert(
            "aud".to_string(),
            match self.audience.as_slice() {
                [single] => json!(single),
                many => json!(many),
            },
        );
        if let Some(azp) = &self.authorized_party {
            claims.insert("azp".to_string(), json!(azp));
        }
        if let Some(nonce) = &self.nonce {
            claims.insert("nonce".to_string(), json!(nonce));
        }
        claims.insert("iat".to_string(), json!(self.issued_at.timestamp()));
        claims.insert("exp".to_string(), json!(self.expires_at.timestamp()));
        if let Some(email) = &self.email {
            claims.insert("email".to_string(), json!(email));
        }
        if let Some(name) = &self.name {
            claims.insert("name".to_string(), json!(name));
        }
        Value::Object(claims)
    }
}
