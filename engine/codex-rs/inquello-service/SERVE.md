# Explicit loopback HTTPS service

`inquello-service serve --config ABSOLUTE_PRIVATE_JSON [--exit-on-stdin-eof]`

This maintained entry uses the ordinary service library in `Deployment::Production`, with exact real-issuer discovery/JWKS validation and delivery disabled. It does not require the test-issuer feature, create a database, seed memberships, link accounts, or generate/install certificates. It never uses inherited database defaults: the named environment variable must contain a complete PostgreSQL URL with explicit host, user and database. Provision a dedicated empty database and tightly permissioned files/profile first. Do not reuse an unknown running topology.

The JSON schema is strict, including nested objects and duplicate fields. All fields below are required. The lifetimes are explicit operator policy inputs, not product promises. Example values are for a bounded development pilot:

```json
{
  "bind": "127.0.0.1:0",
  "database_env": "INQUELLO_PILOT_DATABASE_URL",
  "tls": {
    "cert_chain_path": "D:\\owned-pilot\\service-chain.pem",
    "private_key_path": "D:\\owned-pilot\\service-key.pem"
  },
  "issuer": {
    "issuer": "https://inquello-dev.uk.auth0.com/",
    "client_id": "lUsBSlvk4B7HGotQQfILudjs7WeKRFU9",
    "redirect_uri": "http://127.0.0.1:43821/callback"
  },
  "lifetimes": {
    "login_transaction_seconds": 600,
    "access_seconds": 900,
    "refresh_seconds": 3600,
    "session_seconds": 86400,
    "id_token_clock_skew_seconds": 60,
    "invite_seconds": 604800
  }
}
```

The Domain/ClientID above are public Native development-app metadata, not credentials. This example alone is not activation or live signup evidence. The selected bind must be exactly 127.0.0.1 and either an explicit unprivileged port or explicit port0. Read the actual selected service URL from readiness output. The callback must be the registered unprivileged fixed port and `/callback`; no occupied-port fallback. Issuer must be an exact public HTTPS URL with no userinfo/query/fragment; localhost, IP literals and `.invalid` issuers are refused. The library retains its normal RFC8252 loopback registration semantics; desktop Auth0 config pins the fixed callback.

Use existing local OpenSSL only under operator authorization to issue service TLS from a fresh scoped CA. Give the isolated desktop config the CA **certificate** via `ca_path`, and select `identity_profile: auth0`, `issuer_trust: system`, `callback_port: 43821`. Keep the service private key out of desktop config and renderer. Never change OS trust or use the synthetic issuer as a real-account bridge. Apply restrictive user-only ACLs to the config/key/database-environment launcher; file reads are bounded and reject nonregular/symlink files, but this entry does not provision Windows ACLs.

Readiness is one public JSON line: `service_url`, `deployment: production`, `delivery: not_configured`. Errors use fixed categories, never private paths, database URL, keys or raw parse errors. SIGINT/Ctrl+C (also SIGTERM on Unix) or explicit stdin EOF stops this service; shutdown has a15-second bound. The owning runner must record terminal status and remove ONLY its own disposable database and local TLS/profile when appropriate. The service never drops an operator-supplied database or stops another process. Delivery needs a separate explicitly configured worker; no email vendor secret is read here.

Start with zero memberships. First workspace, invitations and acceptance must use the normal application UI. Actual browser-session account switching, hosted signup/recovery, verified email and fixed callback still need observed Auth0 pilot qualification. Local Inquello logout does not clear the Auth0 browser session.
