//! The synthetic OIDC provider for the SC-7 dev topology. Compiled only with the
//! `test-issuer` feature.
//!
//! It serves a real authorization-code flow over HTTPS for one public native
//! client, signing ID tokens with a [`TestIssuer`]'s ephemeral key:
//!
//! - `GET /.well-known/openid-configuration` and `GET /jwks`: discovery and the
//!   public signing key.
//! - `GET /authorize`: checks the client and redirect URI first (a failure there
//!   never redirects), then `response_type=code`, the `openid` scope, a `state`,
//!   a `nonce` and an S256 PKCE challenge. It auto-consents for the configured
//!   synthetic subject and redirects to the loopback callback with a one-use
//!   code, the `state` and `iss` (RFC 9207).
//! - `POST /token`: a form-encoded `authorization_code` grant. Any presentation
//!   consumes the code. The client ID, the exact redirect URI of the
//!   authorization request and the PKCE verifier (43–128 unreserved characters
//!   whose S256 hash equals the challenge) must all match. No client secret is
//!   accepted.
//!
//! Registered redirect URIs match like the service's: exactly, or on any port
//! for a loopback IP literal with the exact path (RFC 8252 §7.3). Codes, tokens
//! and verifiers are never logged. Nothing here is a real issuer.

use crate::clock::Clock;
use crate::config::IssuerConfig;
use crate::config::TlsConfig;
use crate::config::redirect_uri_allowed;
use crate::server::RunningService;
use crate::server::StartError;
use crate::server::serve;
use crate::server::tls_server_config;
use crate::test_issuer::TestIssuer;
use crate::test_issuer::TokenFixture;
use axum::Json;
use axum::Router;
use axum::body::Bytes;
use axum::extract::RawQuery;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::http::HeaderValue;
use axum::http::StatusCode;
use axum::http::header::CACHE_CONTROL;
use axum::http::header::CONTENT_TYPE;
use axum::http::header::LOCATION;
use axum::http::header::PRAGMA;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::routing::get;
use axum::routing::post;
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use chrono::DateTime;
use chrono::TimeDelta;
use chrono::Utc;
use serde_json::json;
use sha2::Digest;
use sha2::Sha256;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::sync::Mutex;

/// The longest `state` or `nonce` accepted.
const MAX_PARAMETER_BYTES: usize = 512;

/// The scope the token response reports.
const GRANTED_SCOPE: &str = "openid profile email";

/// Who the provider signs in and for which client.
#[derive(Clone, Debug)]
pub struct ProviderSettings {
    /// The single registered public native client.
    pub client_id: String,
    /// Its registered redirect URIs.
    pub redirect_uris: Vec<String>,
    /// The synthetic subject every authorization auto-consents for.
    pub subject: String,
    pub email: Option<String>,
    pub name: Option<String>,
    /// How long an authorization code stays redeemable.
    pub code_lifetime: TimeDelta,
    /// How long an issued ID token is valid.
    pub id_token_lifetime: TimeDelta,
}

struct PendingCode {
    client_id: String,
    redirect_uri: String,
    code_challenge: String,
    nonce: String,
    expires_at: DateTime<Utc>,
}

struct Provider {
    issuer: Arc<TestIssuer>,
    settings: ProviderSettings,
    clock: Arc<dyn Clock>,
    codes: Mutex<HashMap<String, PendingCode>>,
}

/// A running synthetic provider.
pub struct RunningProvider {
    service: RunningService,
    issuer: Arc<TestIssuer>,
    settings: ProviderSettings,
}

impl RunningProvider {
    /// The issuer URL, `https://<addr>`; also the `iss` of every ID token.
    pub fn issuer_url(&self) -> &str {
        self.issuer.issuer()
    }

    pub fn local_addr(&self) -> SocketAddr {
        self.service.local_addr()
    }

    /// The allowlist entry the service needs for this provider and its client.
    pub fn issuer_config(&self) -> IssuerConfig {
        let redirect_uris: Vec<&str> = self
            .settings
            .redirect_uris
            .iter()
            .map(String::as_str)
            .collect();
        self.issuer
            .issuer_config(&self.settings.client_id, &redirect_uris)
    }

    pub async fn shutdown(self) {
        self.service.shutdown().await;
    }
}

/// Binds `bind`, names the issuer `https://<bound address>`, and serves the
/// provider over HTTPS with `tls`.
pub async fn start_provider(
    bind: SocketAddr,
    tls: &TlsConfig,
    settings: ProviderSettings,
    clock: Arc<dyn Clock>,
) -> Result<RunningProvider, StartError> {
    let tls_config = tls_server_config(Some(tls))?;
    let listener = tokio::net::TcpListener::bind(bind).await?;
    let issuer = Arc::new(TestIssuer::with_issuer(&format!(
        "https://{}",
        listener.local_addr()?
    )));
    let provider = Arc::new(Provider {
        issuer: Arc::clone(&issuer),
        settings: settings.clone(),
        clock,
        codes: Mutex::new(HashMap::new()),
    });
    let router = Router::new()
        .route("/.well-known/openid-configuration", get(discovery))
        .route("/jwks", get(jwks))
        .route("/authorize", get(authorize))
        .route("/token", post(token))
        .layer(axum::middleware::map_response(no_store))
        .with_state(provider);
    let service = serve(listener, tls_config, router)?;
    tracing::info!(
        issuer = issuer.issuer(),
        "synthetic OIDC provider listening"
    );
    Ok(RunningProvider {
        service,
        issuer,
        settings,
    })
}

async fn no_store(mut response: Response) -> Response {
    let headers = response.headers_mut();
    headers.insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert(PRAGMA, HeaderValue::from_static("no-cache"));
    response
}

type SharedProvider = State<Arc<Provider>>;

async fn discovery(State(provider): SharedProvider) -> Response {
    let issuer = provider.issuer.issuer();
    Json(json!({
        "issuer": issuer,
        "authorization_endpoint": format!("{issuer}/authorize"),
        "token_endpoint": format!("{issuer}/token"),
        "jwks_uri": format!("{issuer}/jwks"),
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code"],
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": ["ES256"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none"],
        "scopes_supported": ["openid", "profile", "email"],
        "authorization_response_iss_parameter_supported": true,
    }))
    .into_response()
}

async fn jwks(State(provider): SharedProvider) -> Response {
    Json(provider.issuer.jwks()).into_response()
}

/// Parses form or query parameters, refusing any parameter given twice.
fn parameters(raw: &[u8]) -> Option<HashMap<String, String>> {
    let mut out = HashMap::new();
    for (key, value) in url::form_urlencoded::parse(raw) {
        if out.insert(key.into_owned(), value.into_owned()).is_some() {
            return None;
        }
    }
    Some(out)
}

fn random_token() -> String {
    let mut bytes = [0_u8; 32];
    rand::fill(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

/// An S256 challenge or verifier hash: 43 base64url characters.
fn is_s256_challenge(value: &str) -> bool {
    value.len() == 43
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

/// RFC 7636 §4.1: 43–128 characters of `[A-Za-z0-9-._~]`.
fn is_code_verifier(value: &str) -> bool {
    (43..=128).contains(&value.len())
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'.' | b'_' | b'~'))
}

fn s256(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

/// An authorization error that cannot be redirected: the client or redirect
/// URI is not trusted, so the browser stays on the provider.
fn authorize_refused(reason: &'static str) -> Response {
    tracing::info!(reason, "authorization request refused");
    (
        StatusCode::BAD_REQUEST,
        [(CONTENT_TYPE, "text/plain; charset=utf-8")],
        "The synthetic identity provider refused this sign-in request.",
    )
        .into_response()
}

fn redirect(redirect_uri: &str, params: &[(&str, &str)]) -> Response {
    let mut query = url::form_urlencoded::Serializer::new(String::new());
    for (key, value) in params {
        query.append_pair(key, value);
    }
    let location = format!("{redirect_uri}?{}", query.finish());
    match HeaderValue::from_str(&location) {
        Ok(location) => (StatusCode::FOUND, [(LOCATION, location)]).into_response(),
        Err(_) => authorize_refused("redirect location not representable"),
    }
}

async fn authorize(State(provider): SharedProvider, RawQuery(query): RawQuery) -> Response {
    let Some(params) = parameters(query.unwrap_or_default().as_bytes()) else {
        return authorize_refused("duplicate parameter");
    };
    let get = |name: &str| params.get(name).map(String::as_str);
    let settings = &provider.settings;
    if get("client_id") != Some(settings.client_id.as_str()) {
        return authorize_refused("unknown client");
    }
    let Some(redirect_uri) = get("redirect_uri") else {
        return authorize_refused("missing redirect URI");
    };
    if !redirect_uri_allowed(&settings.redirect_uris, redirect_uri) {
        return authorize_refused("redirect URI not registered");
    }

    // From here on errors go back to the (registered) client.
    let issuer = provider.issuer.issuer();
    let state = get("state").unwrap_or_default();
    let fail = |error: &str| {
        tracing::info!(error, "authorization request rejected");
        let mut params = vec![("error", error), ("iss", issuer)];
        if !state.is_empty() {
            params.push(("state", state));
        }
        redirect(redirect_uri, &params)
    };
    if get("response_type") != Some("code") {
        return fail("unsupported_response_type");
    }
    if !get("scope")
        .unwrap_or_default()
        .split(' ')
        .any(|scope| scope == "openid")
    {
        return fail("invalid_scope");
    }
    if state.is_empty() || state.len() > MAX_PARAMETER_BYTES {
        return fail("invalid_request");
    }
    let nonce = get("nonce").unwrap_or_default();
    if nonce.is_empty() || nonce.len() > MAX_PARAMETER_BYTES {
        return fail("invalid_request");
    }
    if get("code_challenge_method") != Some("S256") {
        return fail("invalid_request");
    }
    let Some(code_challenge) = get("code_challenge").filter(|c| is_s256_challenge(c)) else {
        return fail("invalid_request");
    };

    let now = provider.clock.now();
    let code = random_token();
    {
        let mut codes = match provider.codes.lock() {
            Ok(codes) => codes,
            Err(poisoned) => poisoned.into_inner(),
        };
        codes.retain(|_, pending| pending.expires_at > now);
        codes.insert(
            code.clone(),
            PendingCode {
                client_id: settings.client_id.clone(),
                redirect_uri: redirect_uri.to_string(),
                code_challenge: code_challenge.to_string(),
                nonce: nonce.to_string(),
                expires_at: now + settings.code_lifetime,
            },
        );
    }
    tracing::info!("authorization code issued for the synthetic subject");
    redirect(
        redirect_uri,
        &[("code", &code), ("state", state), ("iss", issuer)],
    )
}

fn token_error(status: StatusCode, error: &'static str) -> Response {
    tracing::info!(error, "token request rejected");
    (status, Json(json!({ "error": error }))).into_response()
}

async fn token(State(provider): SharedProvider, headers: HeaderMap, body: Bytes) -> Response {
    let form = headers
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(';').next())
        .is_some_and(|mime| {
            mime.trim()
                .eq_ignore_ascii_case("application/x-www-form-urlencoded")
        });
    if !form {
        return token_error(StatusCode::BAD_REQUEST, "invalid_request");
    }
    let Some(params) = parameters(&body) else {
        return token_error(StatusCode::BAD_REQUEST, "invalid_request");
    };
    let get = |name: &str| params.get(name).map(String::as_str);
    if get("grant_type") != Some("authorization_code") {
        return token_error(StatusCode::BAD_REQUEST, "unsupported_grant_type");
    }
    let settings = &provider.settings;
    if get("client_id") != Some(settings.client_id.as_str()) || params.contains_key("client_secret")
    {
        return token_error(StatusCode::UNAUTHORIZED, "invalid_client");
    }
    let Some(code) = get("code") else {
        return token_error(StatusCode::BAD_REQUEST, "invalid_request");
    };

    let now = provider.clock.now();
    // Any presentation consumes the code, so it can be redeemed at most once.
    let pending = {
        let mut codes = match provider.codes.lock() {
            Ok(codes) => codes,
            Err(poisoned) => poisoned.into_inner(),
        };
        codes.remove(code)
    };
    let Some(pending) = pending.filter(|pending| pending.expires_at > now) else {
        return token_error(StatusCode::BAD_REQUEST, "invalid_grant");
    };
    if pending.client_id != settings.client_id
        || get("redirect_uri") != Some(pending.redirect_uri.as_str())
    {
        return token_error(StatusCode::BAD_REQUEST, "invalid_grant");
    }
    let verified = get("code_verifier")
        .filter(|verifier| is_code_verifier(verifier))
        .is_some_and(|verifier| s256(verifier) == pending.code_challenge);
    if !verified {
        return token_error(StatusCode::BAD_REQUEST, "invalid_grant");
    }

    let mut fixture = TokenFixture::valid(
        &provider.issuer,
        &settings.client_id,
        &settings.subject,
        &pending.nonce,
        now,
    )
    .expiring_at(now + settings.id_token_lifetime);
    fixture.email = settings.email.clone();
    fixture.name = settings.name.clone();
    let id_token = provider.issuer.sign(&fixture);
    tracing::info!("ID token issued for the synthetic subject");
    Json(json!({
        "access_token": random_token(),
        "token_type": "Bearer",
        "expires_in": settings.id_token_lifetime.num_seconds(),
        "id_token": id_token,
        "scope": GRANTED_SCOPE,
    }))
    .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pkce_shapes_follow_rfc_7636() {
        // RFC 7636 Appendix B.
        assert_eq!(
            s256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
        assert!(is_s256_challenge(
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        ));
        assert!(!is_s256_challenge("short"));
        assert!(!is_s256_challenge(
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw+cM"
        ));
        assert!(is_code_verifier(&"a".repeat(43)));
        assert!(is_code_verifier(&"a~._-".repeat(26)[..128]));
        assert!(!is_code_verifier(&"a".repeat(42)));
        assert!(!is_code_verifier(&"a".repeat(129)));
        assert!(!is_code_verifier(&format!("{}!", "a".repeat(43))));
    }

    #[test]
    fn duplicate_parameters_are_refused() {
        assert!(parameters(b"a=1&b=2").is_some());
        assert!(parameters(b"a=1&a=2").is_none());
    }
}
