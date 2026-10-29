---
title: 'Story 1.10a: Authenticate an Inquello identity independently of inference (shared service)'
type: 'feature'
created: '2026-10-28'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '9b8753c8efa276ae634401aea18dac0e0ecc34fe'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-inquello-2026-10-26/shared-service-contract-proposal-2026-10-27.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-4-keep-local-working-metadata-behind-domain-commands.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Inquello has no authority of its own. Without a service-held identity and session, provider sign-in or local caches could end up deciding product permissions (AD-6/7, AD-18/19, SC-1/2).

**Approach:** Build the shared-service half of Story 1.10 under the SC-7 synthetic topology. It has three parts:
- `inquello-protocol`: the SC-1/SC-2 wire schemas and conformance fixtures.
- `inquello-service`: an axum service with sqlx on PostgreSQL. It runs the login transaction, validates ID tokens and maps `(issuer, subject)` to a principal. Sessions use opaque access credentials and rotating refresh credentials with family replay revocation. Principal-scoped session commands carry durable SC-2 receipts.
- An in-process test OIDC issuer with ephemeral keys.

**Owner decisions (2026-10-28):**
- **Split:** this spec is 1.10a. Story 1.10b (desktop system-browser PKCE sign-in, OS credential store, preload operation, local-versus-shared availability display) follows; story 1-10 stays `in-progress` until both are done.
- **Database:** PostgreSQL 18, installed from apt.postgresql.org on the cloud machine.
- **Placement:** crates in `engine/codex-rs` using pinned libraries: axum, sqlx with the `postgres` feature, and jsonwebtoken.

## Boundaries & Constraints

**Always:**
- **Login transaction:** expiring and one-use, binding the nonce, issuer, client and redirect URI.
- **Bootstrap:** the service itself validates signature/key, `iss`, `aud`, `azp`, `exp` and the nonce, never trusting a client-parsed claim. It atomically consumes the transaction and creates the session. A replayed token or a mismatched transaction fails.
- **Principal identity:** a principal is keyed by `(issuer, subject)`. Email and name are mutable attributes, never link keys, so a matching email on a different subject gives a different principal.
- **Session record:** `session_id`, `principal_id`, `device_id`, subject reference, created and last-authenticated times, expiry, revoked time and refresh family.
- **Credential storage:** the service stores only SHA-256 hashes of credentials.
- **Refresh:** rotates atomically. Reusing a rotated refresh credential revokes the whole family. A bounded endpoint revokes a family. Refresh is never a receipt-replay command, and receipts never hold credentials.
- **Protected requests:** each one resolves the session, the principal and its revisions inside the request transaction, with locks ordered principal → session. Expired, revoked, unknown, disabled or unavailable all mean blocked, with no cached fallback.
- **SC-2 receipts:**
  - Envelopes carry `command_epoch`, `operation_id`, `expected_revision`, `schema_version` and `payload`.
  - The actor comes from credentials, never from the payload. The receipt key is `(principal_id, 'principal', principal_id, operation_id)` with a canonical request digest.
  - An exact retry returns the recorded outcome; the same key with a different payload conflicts; an old or unknown epoch is rejected.
  - Receipt, mutation and authorization are written in one transaction.
- **Errors:** use the SC-2 error kinds and never confirm whether an inaccessible resource exists.
- **Synthetic only:** the test issuer and its keys exist only behind the `test-issuer` cargo feature. Production config refuses a test issuer. Lifetimes are explicit config inputs.
- **Membership:** returned as displayable revisions from a fixture-seeded table, with no admin API (Story 1.11).

**Never:**
- No desktop changes.
- No real issuer, vendor or deployment.
- No email-based linking.
- No Workspace creation or invite APIs.
- No credentials in logs, receipts or errors.
- No new crates beyond those already in `Cargo.lock`; workspace entries may be added for crates already locked.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sign-in | Valid token for an open transaction | Session created; access and refresh issued; transaction consumed | N/A |
| Wrong issuer / audience / nonce | Token fails any check | No session; transaction not consumed for a retry | `unauthenticated` |
| Replayed token | Same token and transaction again | Rejected | `unauthenticated` |
| Email collision | New subject with an existing principal's email | New principal; nothing merged or disclosed | N/A |
| Refresh | Current refresh credential | New pair; old pair invalid | N/A |
| Family replay | Rotated refresh credential reused | Family revoked; all its sessions blocked | `unauthenticated`; requires sign-in |
| Expired / revoked session | Protected request | Blocked | `unauthenticated` |
| Receipt retry | Logout command, same op ID and payload, after commit | Same recorded outcome; no second mutation | N/A |
| Receipt conflict | Same op ID, different payload | Rejected | `version conflict` |
| Stale epoch | Old `command_epoch` | Rejected, never treated as fresh | `unsupported contract` |
| Authority unavailable | Database down during a protected request | Blocked | `dependency unavailable` |
| Test issuer in production | Production config naming the test issuer | Service refuses to start | Startup error |

</frozen-after-approval>

## Code Map

- `…/shared-service-contract-proposal-2026-10-27.md` §2 (SC-1), §3 (SC-2), §10 (SC-7) -- the governing contract.
- `engine/codex-rs/Cargo.toml` -- workspace pins: `axum` 0.8 (no default features; enable what is needed), `sqlx` (add the `postgres` feature in the service crate), `jsonwebtoken` 9.3.1, `sha2`, `base64`, `rand` 0.9, `uuid`, `serde_json` and `time`/`chrono`. `codex-rs/login` and `agent-identity` are reference uses of jsonwebtoken. Check `Cargo.lock` before choosing a key-generation crate (ring or aws-lc-rs via rustls).
- `engine/codex-rs/clippy.toml` -- forbids raw sqlx connects outside a shim; mirror the Story 1.4 shim pattern with `#![expect(clippy::disallowed_methods, …)]`.
- `engine/codex-rs/inquello-domain/` -- domain ports. Keep its dependency-direction test green: the service depends on the domain, never the reverse.

## Tasks & Acceptance

**Execution:**
- [x] `engine/codex-rs/inquello-protocol/` -- serde types for the login transaction, bootstrap, refresh, family revoke, session view, the SC-2 envelope, response and error kinds, plus JSON fixtures under `fixtures/` with round-trip tests.
- [x] `engine/codex-rs/inquello-service/` -- the config (refusing a test issuer outside the feature), the Postgres shim and migrations, the routes under `/v1`, the SC-1 validation adapter, session and refresh-family logic, and the receipt store.
- [x] `engine/codex-rs/inquello-service/src/test_issuer.rs` (feature `test-issuer`) -- ephemeral signing key, JWKS and deterministic token fixtures.
- [x] `engine/codex-rs/inquello-service/tests/` -- every matrix row against `INQUELLO_TEST_DATABASE_URL`. Each test gets an isolated schema or database, and the suite fails if the server version is below 18.
- [x] `engine/codex-rs/Cargo.toml`, `Cargo.lock` and `FORK-CUT.md` -- the new members, recorded as Patch 3.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- the Story 1.10b scope, plus the HTTPS termination with scoped test-client trust that 1.10b exercises end to end.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- keep 1-10 at `in-progress`.

**Acceptance Criteria:**
- Given PostgreSQL 18 and the test issuer, when `cargo test -p inquello-service --features test-issuer` runs, then every matrix row passes and no credential appears in any receipt, log line or error body (asserted).

### Review Findings

Review pass 2026-10-29, HEAD `ace1ca2`, using `bmad-code-review`. Full evidence, ranking and limitations: [completed-story review](reviews/2026-10-29-epic-1/report.md). Owner selected “Leave as action items” on 2026-10-29. All patch findings remain open; no implementation fixes applied. Review status and sprint tracking synchronized.

- [ ] [Review][Patch] R11: Expiry checks use time captured before database lock waits [engine/codex-rs/inquello-service/src/sessions.rs:303] — BMAD medium; likelihood Low; impact Medium; change risk Low–moderate — recommendation: Schedule before shared-service production use.

#### Rejected

No formal findings rejected for this story in this pass. Exploratory limits and inherited deferrals are documented in the full report.

## Design Notes

**Transport:** tests run the service on a loopback plain-HTTP listener. The service refuses a non-loopback bind without TLS configured. HTTPS termination and scoped client trust are deferred to 1.10b, where the desktop is the client.

## Implementation Notes

- **Cloud machine (Linux, root):** PostgreSQL 18.6 runs as cluster `18 main` on port 5433. The role and database `inquello_test` (password `inquello_test`, `CREATEDB`) are test-only, so the credential is fine to name in test docs. Use `INQUELLO_TEST_DATABASE_URL=postgres://inquello_test:inquello_test@127.0.0.1:5433/inquello_test`. If the cluster is down, start it with `pg_ctlcluster 18 main start`.
  - **Cargo:** use `-j 4`. `Cargo.lock` is committed and must be regenerated only by adding members and features; external crate versions do not change.
  - **Engine stamp:** after committing the engine change, run `pnpm generate:protocol` in `desktop/` and amend the commit; only `schema-stamp.json` should change.
  - **Baseline:** 54 domain and adapter tests pass; 382 desktop tests pass.
- **Keys and crates:** the test issuer signs ES256 with an ephemeral P-256 key from `ring` (already locked through `jsonwebtoken`/`rustls`; added as a workspace entry). Credentials and nonces use `rand` 0.9. `Cargo.lock` gains only the two new packages.
- **Bootstrap proof:** creating a login transaction returns a one-time `transaction_proof` (stored only as a SHA-256 hash). Bootstrap and abandon need it with the transaction ID, so the browser-visible nonce alone cannot complete or cancel a sign-in. `POST /v1/login/abandon` covers a lost bootstrap response (SC-1): it closes the transaction or revokes the session it created.
- **Token checks:** jsonwebtoken checks the signature, `iss`, `aud` and the required claims. The service checks the `kid`-to-key binding, the key's algorithm, `azp` (required when there are several audiences), `exp`/`iat`/`nbf` against the injected service clock with the configured skew, and the nonce. A hash of every accepted ID token is recorded so it cannot be used twice.
- **Logout:** `logout {session_id}` revokes any session of the caller's principal (its own or another device's) and its refresh family. A foreign or unknown session ID gets the same `denied` body. `authorization_epoch` is `null` for principal-scoped responses. A self-logout retry after commit gets `unauthenticated`, because the session is revoked and protected requests have no fallback; this is logged in `deferred-work.md` for the 1.10b client contract. The matrix's receipt-retry row is tested by logging out another device.
- **Errors:** malformed bodies get the fixed `unsupported_contract` body, because the axum `Json` extractor is not used and so no parser text is echoed. Every error body in the tests is asserted equal to the fixed body for its kind.
- **Authority unavailable:** the test sets `ALLOW_CONNECTIONS false` on its own database and terminates that database's backends, then checks that each protected route answers `dependency_unavailable` within the 2 s acquire timeout.
- **Leak checks:** `Harness::finish` records every credential, proof and ID token a test saw. It asserts that none of them appears in a receipt, an error body, any row of any service table, or the TRACE-level logs captured from all crates. A deliberate log injection was run once to confirm the check fails when it should. The service also refuses PostgreSQL older than 18 at startup.
- **Results (2026-10-28):** protocol 7 tests and service 22 tests (5 unit, 17 PostgreSQL 18 integration) pass. The 54 domain and adapter tests still pass. Clippy (with and without `test-issuer`) and fmt are clean. `cargo build --locked` leaves the tree clean. `pnpm generate:protocol` changed only `forkTreeHash` in the stamp, and all 382 desktop tests pass. Step-04 review was skipped by owner rule.

## Verification

**Commands (in `engine/codex-rs`, with `INQUELLO_TEST_DATABASE_URL=postgres://inquello_test:inquello_test@127.0.0.1:5433/inquello_test`):**
- `cargo test -j 4 -p inquello-protocol -p inquello-service --features inquello-service/test-issuer` -- expected: all pass
- `cargo test -j 4 -p inquello-domain -p inquello-adapters` -- expected: still pass
- `cargo clippy -j 4 -p inquello-protocol -p inquello-service --all-targets --features inquello-service/test-issuer -- -D warnings` and `cargo fmt -- --check` on both crates -- expected: clean
- `cargo build --locked -j 4 -p inquello-service`, then `git status --porcelain` -- expected: no changes
- In `desktop/`, after committing: `pnpm generate:protocol`, then `pnpm test` -- expected: only the stamp hash changes; all pass
