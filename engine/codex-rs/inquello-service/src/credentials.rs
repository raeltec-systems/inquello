//! Opaque credentials: generation and the SHA-256 hashes the service stores.
//!
//! The service never stores a raw credential. Lookups hash the presented value and
//! compare hashes, so a database read cannot reveal a usable credential.

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use inquello_protocol::login::Credential;
use sha2::Digest;
use sha2::Sha256;

/// The longest credential string the service will hash; anything longer is
/// rejected without touching the database.
pub(crate) const MAX_CREDENTIAL_BYTES: usize = 512;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum CredentialKind {
    Access,
    Refresh,
    TransactionProof,
}

impl CredentialKind {
    fn prefix(self) -> &'static str {
        match self {
            CredentialKind::Access => "iqa_",
            CredentialKind::Refresh => "iqr_",
            CredentialKind::TransactionProof => "iqp_",
        }
    }

    pub(crate) fn as_str(self) -> &'static str {
        match self {
            CredentialKind::Access => "access",
            CredentialKind::Refresh => "refresh",
            CredentialKind::TransactionProof => "transaction_proof",
        }
    }
}

/// 256 random bits, URL-safe base64.
fn random_token() -> String {
    let mut bytes = [0_u8; 32];
    rand::fill(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

/// A new credential with a recognizable prefix (which helps secret scanners).
pub(crate) fn generate(kind: CredentialKind) -> Credential {
    Credential::new(format!("{}{}", kind.prefix(), random_token()))
}

/// A new login-transaction nonce.
pub(crate) fn nonce() -> String {
    random_token()
}

/// SHA-256 of the exact bytes.
pub(crate) fn hash(secret: &str) -> Vec<u8> {
    Sha256::digest(secret.as_bytes()).to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn credentials_are_prefixed_unique_and_hash_to_32_bytes() {
        let a = generate(CredentialKind::Access);
        let b = generate(CredentialKind::Access);
        assert!(a.expose().starts_with("iqa_"));
        assert!(
            generate(CredentialKind::Refresh)
                .expose()
                .starts_with("iqr_")
        );
        assert_ne!(a, b);
        assert_eq!(hash(a.expose()).len(), 32);
        assert!(a.expose().len() <= MAX_CREDENTIAL_BYTES);
    }
}
