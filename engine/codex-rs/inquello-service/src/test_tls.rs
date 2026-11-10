//! An ephemeral test certificate authority for the SC-7 synthetic topology.
//! Compiled only with the `test-issuer` feature.
//!
//! Each [`TestCertificateAuthority`] generates a fresh P-256 CA key in memory and
//! issues short-lived server certificates for loopback names. The keys are never
//! written anywhere; only the CA *certificate* is meant to leave the process, so
//! a client can trust exactly this CA for one run (scoped trust). Nothing here is
//! a production certificate or evidence that a real deployment's TLS works.

use crate::config::TlsConfig;
use rcgen::BasicConstraints;
use rcgen::CertificateParams;
use rcgen::CertifiedIssuer;
use rcgen::DistinguishedName;
use rcgen::DnType;
use rcgen::ExtendedKeyUsagePurpose;
use rcgen::IsCa;
use rcgen::KeyPair;
use rcgen::KeyUsagePurpose;
use rcgen::PKCS_ECDSA_P256_SHA256;
use rustls::pki_types::CertificateDer;
use rustls::pki_types::PrivatePkcs8KeyDer;
use std::fmt;
use time::Duration;
use time::OffsetDateTime;

/// The names every synthetic server certificate covers.
pub const LOOPBACK_NAMES: [&str; 3] = ["127.0.0.1", "::1", "localhost"];

/// How long issued certificates (and the CA) stay valid.
const VALIDITY: Duration = Duration::days(2);

/// An in-memory CA with an ephemeral key.
pub struct TestCertificateAuthority {
    issuer: CertifiedIssuer<'static, KeyPair>,
}

impl fmt::Debug for TestCertificateAuthority {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("TestCertificateAuthority")
            .finish_non_exhaustive()
    }
}

fn validity(params: &mut CertificateParams) {
    let now = OffsetDateTime::now_utc();
    params.not_before = now - Duration::hours(1);
    params.not_after = now + VALIDITY;
}

impl TestCertificateAuthority {
    /// A new CA named `common_name`, for example "Inquello synthetic test CA".
    pub fn new(common_name: &str) -> Self {
        let mut params = CertificateParams::default();
        params.is_ca = IsCa::Ca(BasicConstraints::Constrained(0));
        params.key_usages = vec![KeyUsagePurpose::KeyCertSign, KeyUsagePurpose::CrlSign];
        let mut name = DistinguishedName::new();
        name.push(DnType::CommonName, common_name);
        params.distinguished_name = name;
        validity(&mut params);
        let key = KeyPair::generate_for(&PKCS_ECDSA_P256_SHA256)
            .unwrap_or_else(|error| panic!("generate the test CA key: {error}"));
        let issuer = CertifiedIssuer::self_signed(params, key)
            .unwrap_or_else(|error| panic!("self-sign the test CA: {error}"));
        Self { issuer }
    }

    /// The CA certificate in PEM form: the only material a client needs.
    pub fn ca_pem(&self) -> String {
        self.issuer.pem()
    }

    /// The CA certificate in DER form.
    pub fn ca_der(&self) -> CertificateDer<'static> {
        self.issuer.der().clone()
    }

    /// A server identity for `names` (IP literals become IP SANs), issued by
    /// this CA with a fresh key.
    pub fn server_tls(&self, names: &[&str]) -> TlsConfig {
        let mut params =
            CertificateParams::new(names.iter().map(ToString::to_string).collect::<Vec<_>>())
                .unwrap_or_else(|error| panic!("server certificate names: {error}"));
        params.extended_key_usages = vec![ExtendedKeyUsagePurpose::ServerAuth];
        params.key_usages = vec![KeyUsagePurpose::DigitalSignature];
        let mut name = DistinguishedName::new();
        name.push(DnType::CommonName, "Inquello synthetic server");
        params.distinguished_name = name;
        validity(&mut params);
        let key = KeyPair::generate_for(&PKCS_ECDSA_P256_SHA256)
            .unwrap_or_else(|error| panic!("generate the server key: {error}"));
        let certificate = params
            .signed_by(&key, &self.issuer)
            .unwrap_or_else(|error| panic!("issue the server certificate: {error}"));
        TlsConfig {
            cert_chain: vec![certificate.der().clone()],
            private_key: PrivatePkcs8KeyDer::from(key.serialize_der()).into(),
        }
    }

    /// A server identity for [`LOOPBACK_NAMES`].
    pub fn loopback_server_tls(&self) -> TlsConfig {
        self.server_tls(&LOOPBACK_NAMES)
    }
}
