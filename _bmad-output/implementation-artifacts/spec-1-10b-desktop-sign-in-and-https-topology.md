---
title: 'Story 1.10b: Sign in from the desktop over the HTTPS synthetic topology'
type: 'feature'
created: '2026-10-28'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'd2714b697603458018acd332f631b09530567e42'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-inquello-2026-10-26/shared-service-contract-proposal-2026-10-27.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-10a-authenticate-identity-shared-service.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-3-isolate-desktop-renderers-from-host-privilege.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The 1.10a service exists, but nothing signs a person in from the desktop. The service speaks only plain HTTP, and no runnable issuer offers real authorize and token endpoints. Credentials have no protected home on the desktop (SC-1, SC-7).

**Approach:** Complete Story 1.10 end to end on the synthetic topology:
- **HTTPS:** the service serves HTTPS using an ephemeral test CA (rcgen and tokio-rustls, both already locked).
- **Dev topology:** a dev binary gated by `test-issuer` runs the service together with a synthetic OIDC provider (`/authorize`, `/token`, discovery, JWKS).
- **Desktop main process:**
  - signs in with Authorization Code + PKCE S256, through the system browser and a loopback redirect;
  - holds credentials in the main process only, persisted solely through the OS-backed store;
  - exposes three named preload operations;
  - shows identity, shared-service availability and local private work as separate states.

**Owner decisions (2026-10-28):**
- **Scope:** one story covering the service HTTPS, the dev topology and the desktop flow. Story 1-10 is complete when this is done.
- **Keyring:** install gnome-keyring, libsecret and D-Bus on the cloud machine so the libsecret path is exercised. The code still fails closed when no OS-backed store exists.
- **Self-logout retry (resolves the 1.10a deferral):** `unauthenticated` on a retried self-logout means logged out.

## Boundaries & Constraints

**Always:**
- **PKCE and state:** a 43–128-character verifier, an S256 challenge, and a random one-use `state` with a 5-minute timeout. The loopback listener binds `127.0.0.1` on an ephemeral port, path `/callback`, and accepts exactly one matching callback. The service and issuer accept loopback redirect URIs on any port (RFC 8252 §7.3), with an exact path.
- **System browser:** opened through `shell.openExternal`, from a single main module (`identity/browser.ts`). There is no embedded login window. Tests inject an opener.
- **Token exchange and bootstrap:** the main process exchanges the code at the issuer's `/token`, then bootstraps at the service with the ID token and the transaction proof. The desktop never parses claims for authority. If a bootstrap response is lost, the desktop calls abandon and asks for a new sign-in.
- **HTTPS:** every request goes over HTTPS and trusts only the CA named in the dev config, using a per-request `ca` option. It never changes the system trust store, never sets `NODE_TLS_REJECT_UNAUTHORIZED`, and never skips verification. When TLS is configured the service may bind non-loopback addresses; plain HTTP stays loopback-only.
- **Credential storage:**
  - Credentials live only in the main process.
  - They persist only when `safeStorage` reports an OS-backed backend (Keychain, DPAPI, libsecret or KWallet). In that case they are written as an encrypted file with mode 0600 under `userData`.
  - With `basic_text`, `unknown` or no encryption, they stay in memory for that run and the status says the sign-in is not remembered.
  - They never reach the renderer, IPC, logs, URLs or the app-server environment.
- **Refresh:** serialized in main. Rotation replaces both credentials. On a reuse rejection or an uncertain outcome, the desktop discards the family, revokes it if still able, and requires sign-in.
- **Logout:** an SC-2 envelope whose `operation_id` is persisted until resolved. A retry reuses the same ID, and `unauthenticated` on a self-logout retry counts as logged out.
- **Preload operations:** `identity.getStatus()`, `identity.signIn()` and `identity.signOut()`, registered through the Story 1.3 registry with sender and payload validation. `getStatus` returns only:
  - `identity`: `signed-out`, `signing-in`, `signed-in` (with display name and issuer label) or `blocked` (with a reason);
  - `sharedService`: `available`, `unavailable` or `not-configured`;
  - `credentialStorage`: `os-backed` or `memory-only`;
  - `privateWork`: `local`.
- **Configuration:** a dev config file named by `INQUELLO_SERVICE_CONFIG`. Without it the shared service is `not-configured` and nothing is contacted.
- **Status display:** the specimen page shows an Account block built from Story 1.6–1.8 primitives, with sign-in and sign-out buttons. Shared availability and private local work are labelled separately.

**Never:**
- No embedded webview login and no client secret.
- No real issuer, vendor or deployment.
- No credential in renderer-visible state.
- No Workspace or membership UI (Story 1.11).
- No new npm or crates.io dependencies beyond those already locked; the apt installs are on the cloud machine only.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sign-in | Opener follows authorize, callback with the right state | `signed-in`; credentials stored per backend | N/A |
| Wrong state | Callback with a mismatched or replayed `state` | Rejected; still `signing-in` until timeout | Listener closes after timeout; `signed-out` |
| PKCE mismatch | Token request with a wrong verifier | Issuer rejects; `signed-out` | Reason shown without secrets |
| Untrusted cert | Service presents a certificate not from the configured CA | Request fails | `sharedService: unavailable` |
| OS store | libsecret available (keyring unlocked) | `os-backed`; file encrypted; sign-in survives restart | N/A |
| No OS store | Backend `basic_text` or unavailable | `memory-only`; nothing written to disk | N/A |
| Refresh reuse | Service rejects a rotated credential | Family discarded; `signed-out` | N/A |
| Service down | Topology stopped while signed in | `sharedService: unavailable`; private work still `local` | Shared work blocked |
| Self-logout lost | Logout committed, response lost, retry gets `unauthenticated` | `signed-out`; credentials cleared | N/A |
| Renderer probe | Renderer inspects `inquello.identity` results and globals | No token, proof or code anywhere | Smoke fails if found |

</frozen-after-approval>

## Code Map

- `engine/codex-rs/inquello-service/src/{server,config,routes,login,oidc,test_issuer}.rs` -- 1.10a service. Add the TLS listener, loopback-any-port redirect matching, and the `src/bin/inquello-dev-topology.rs` binary behind the `test-issuer` feature. The binary prints one JSON line with the service URL, issuer URL, CA path and client ID, and writes only the CA certificate to disk.
- `engine/codex-rs/inquello-protocol/` -- the wire types; desktop TypeScript mirrors must match them, checked by a test against the JSON fixtures.
- `desktop/src/main/security/{operations,policy,sender}.ts` -- the Story 1.3 operation registry; add the identity operations. `desktop/test/security.test.ts:530` scans for Electron `shell`; narrow it to allow only `src/main/identity/browser.ts`.
- `desktop/src/main/main.ts` and `smoke-probe.ts` -- wiring and the probe.
- `desktop/src/renderer/Specimen.tsx` -- add the Account block.

## Tasks & Acceptance

**Execution:**
- [x] `engine/codex-rs/inquello-service/` -- TLS listener, redirect matching, synthetic provider routes (`/authorize` auto-consents for a configured synthetic subject; `/token` checks PKCE, client ID, redirect and one-use codes), the dev topology binary, and tests for each.
- [x] `desktop/src/main/identity/` -- `pkce.ts`, `loopback.ts`, `browser.ts`, `service-client.ts` (HTTPS with the scoped CA), `vault.ts` (safeStorage with fail-closed backend detection), `session.ts` (sign-in, refresh, logout and status state machine) and `config.ts`.
- [x] `desktop/src/preload/preload.ts` and `desktop/src/main/security/operations.ts` -- the three identity operations.
- [x] `desktop/src/renderer/Specimen.tsx` -- the Account block.
- [x] `desktop/test/identity*.test.ts` -- unit tests for every matrix row with fakes. An integration test spawns the built dev topology and drives a full sign-in, refresh and logout with a headless HTTP opener.
- [x] `desktop/src/main/smoke-probe.ts` -- in smoke mode with `INQUELLO_SERVICE_CONFIG` set: sign in through the headless opener, assert `signed-in` with `os-backed` storage, confirm the encrypted file does not contain the access credential in plaintext, and confirm the renderer probe finds no secret.
- [x] `FORK-CUT.md` (Patch 4), `deferred-work.md` (close the HTTPS and self-logout items), `sprint-status.yaml` (1-10 to `review`).

**Acceptance Criteria:**
- Given the dev topology running and an unlocked gnome-keyring, when the smoke runs, then sign-in completes over HTTPS with scoped trust, the status shows `signed-in` and `os-backed`, no secret reaches the renderer, and the run exits 0.

### Review Findings

Review pass 2026-10-29, HEAD `ace1ca2`, using `bmad-code-review`. Full evidence, ranking and limitations: [completed-story review](reviews/2026-10-29-epic-1/report.md). Owner selected “Leave as action items” on 2026-10-29. All patch findings remain open; no implementation fixes applied. Review status and sprint tracking synchronized.

- [ ] [Review][Patch] R02: Failed refresh during logout is reported as confirmed server revocation [desktop/src/main/identity/session.ts:549] — BMAD high; likelihood Low; impact High; change risk Moderate — recommendation: Fix now.
- [ ] [Review][Patch] R04: A pending sign-in can recreate credentials after local removal [desktop/src/main/identity/session.ts:239] — BMAD medium; likelihood Low; impact Medium; change risk Moderate — recommendation: Fix now.
- [ ] [Review][Patch] R05: Vault write failure leaves rotated credentials stale on disk [desktop/src/main/identity/session.ts:613] — BMAD medium; likelihood Low; impact Medium; change risk Moderate — recommendation: Fix now.
- [ ] [Review][Patch] R09: Default refresh tests do not detect lost credential persistence [desktop/test/identity-session.test.ts:215] — BMAD medium; likelihood Medium; impact Medium; change risk Low — recommendation: Fix alongside R05.

#### Rejected

No formal findings rejected for this story in this pass. Exploratory limits and inherited deferrals are documented in the full report.

## Implementation Notes

- **Cloud machine (Linux, root):**
  - **PostgreSQL 18:** cluster `18 main` on port 5433, started with `pg_ctlcluster 18 main start` if it is down. Use `INQUELLO_TEST_DATABASE_URL=postgres://inquello_test:inquello_test@127.0.0.1:5433/inquello_test` (test-only role, `CREATEDB`).
  - **Installed packages:** gnome-keyring, libsecret-1-0, libsecret-tools and dbus. A working keyring session for the `smoke` user is `runuser -u smoke -- dbus-run-session -- sh -c 'echo -n testpw | gnome-keyring-daemon --unlock --components=secrets >/dev/null; <command>'`. Pass Electron `--password-store=gnome-libsecret`.
  - **Smoke:** build as root with `pnpm run build`, run `chmod -R o+rX dist`, then run as `smoke` under `xvfb-run` inside that D-Bus session. Never pass `--no-sandbox`. The dev topology binary must be readable and executable by `smoke` (`engine/codex-rs/target/debug`; make the path readable as needed), and any temp or CA dirs it writes must be readable by `smoke`.
  - **Cargo:** use `-j 4`. `Cargo.lock` changes only for new members or features.
  - **Engine stamp:** after committing the engine change, run `pnpm generate:protocol` in `desktop/` and amend the commit.
  - **Baseline:** 29 service and protocol tests, 54 domain and adapter tests and 382 desktop tests pass; the smoke exits 0.
- **Service (as built):**
  - `src/tls.rs`: rustls (aws-lc-rs, safe default versions, ALPN `http/1.1`) behind an axum `Listener` that handshakes off the accept loop with a 10 s timeout. `ServiceConfig.tls` enables it; `TlsConfig` redacts its key from `Debug`. An empty chain is refused.
  - `config::redirect_uri_matches`: exact match, or for a registered `http://127.0.0.1/...` or `http://[::1]/...` any port with the exact path (no query, fragment or user info). Login transactions bind the exact URI requested, and bootstrap still compares it exactly.
  - `src/test_provider.rs`: `/authorize` refuses an unknown client or unregistered redirect with a 400 and never redirects; other errors redirect with `error`, `state` and `iss`. `/token` takes only a form body, consumes the code on any presentation, refuses a `client_secret`, and checks client, exact redirect and the S256 verifier. Codes live 1 minute, ID tokens 5 minutes.
  - `inquello-dev-topology`: creates and later drops its own `inquello_dev_<uuid>` database from `INQUELLO_DEV_DATABASE_URL` or `INQUELLO_TEST_DATABASE_URL`, and writes only `ca.pem` (0644, in a fresh 0755 directory). It stops on SIGINT, SIGTERM or, with `--exit-on-stdin-eof`, stdin EOF. Its JSON line also carries `issuer_label`, which the desktop shows instead of anything from token claims.
- **Desktop (as built):**
  - `identity/config.ts` accepts exactly the topology line's five keys, https origins only, and a CA file that holds certificates and no key.
  - `identity/service-client.ts` passes `ca`, `rejectUnauthorized: true` and `agent: false` on every request. A transport failure records whether the request was fully sent, so a lost response is treated as an uncertain outcome. `identity/wire.ts` mirrors `inquello-protocol` with strict parsers; `test/identity-wire.test.ts` round-trips every fixture.
  - `identity/vault.ts`: OS-backed only for Keychain, DPAPI, `gnome_libsecret` or `kwallet*`; anything else, or any detection error, is `memory-only`. When OS-backed it writes `session.bin` (encrypted, 0600, atomic rename) and a `device-id` file in a 0700 `<userData>/identity` directory. The pending logout lives in the encrypted record.
  - `identity/session.ts`: `signIn` and `signOut` resolve with `{ ok, reason?, status }`, where `reason` is one of a fixed set of sentences. `getStatus` returns only the four published fields. While a logout is unresolved the identity is `blocked` and `getStatus` retries it. A refresh the service could not attempt (`dependency_unavailable`, or a request that never left) keeps the family; any other refresh failure discards and revokes it. A first-attempt `unauthenticated` logout refreshes once and resends the same envelope. A stale epoch or revision prepares one new operation, since the service rejected the old one without a mutation.
  - The operations rebuild every result field by field (`toRendererStatus`), so nothing else crosses IPC. `identity/browser.ts` is the only `shell` user, and it opens only `https:` URLs. `INQUELLO_SERVICE_CONFIG` is removed from the app-server environment.
  - The smoke probe presses the Account block's buttons. It searches what the renderer can see (identity results, DOM, string globals, web storage, cookie, URL) in main for every secret the session handled: access, refresh, proof, code, verifier, ID token, state and nonce. It also signs out and checks that the file is gone. The smoke clears `<userData>/identity` at start.
- **Results (2026-10-28):**
  - Engine: protocol 7 and service 32 tests pass (8 unit, 17 identity, 7 topology), and so do the 54 domain and adapter tests. Clippy (with and without `test-issuer`) and fmt are clean. `cargo build --locked` leaves `Cargo.lock` with only the five new dependency edges of `inquello-service`.
  - Desktop: both `tsc` checks are clean and 502 tests pass (382 earlier plus 120 new), including the integration suite against the built topology.
  - Smoke as `smoke` in a D-Bus session with gnome-keyring unlocked, `--password-store=gnome-libsecret` and `xvfb-run`: with the topology running, the `identity` line shows `ok: true`, `signed-in` and `os-backed`, the vault at mode 600 with no plaintext secret, 8 secrets checked and 0 renderer leaks. The run exits 0. Without `INQUELLO_SERVICE_CONFIG`, `identity` is `ok: true` with `not-configured`.
  - Step-04 review was skipped by owner rule.

## Verification

**Commands:**
- In `engine/codex-rs`, with `INQUELLO_TEST_DATABASE_URL` set: `cargo test -j 4 -p inquello-protocol -p inquello-service --features inquello-service/test-issuer`, clippy `-D warnings`, fmt, and `cargo build --locked` -- expected: pass, clean, no changes
- In `desktop/`: both `tsc` checks and `pnpm test`, including the integration test with the topology binary built -- expected: all pass
- Smoke as the `smoke` user: `dbus-run-session` with gnome-keyring unlocked and `--password-store=gnome-libsecret`, under `xvfb-run`, with the dev topology running -- expected: exit 0, identity `ok: true`
- After committing: `pnpm generate:protocol` -- expected: only the stamp hash changes
