# Deferred work

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-set-up-initial-inquello-fork.md`
  summary: Run the upstream Codex Rust and SDK tests for the imported `engine/` tree (then `fork/`) from this repository's own verification path, since `engine/.github/workflows` never triggers and assumes `codex-rs` at the repo root.
  evidence: Story 1.1 verified build plus version output only; no root `.github` exists, so any later change to `engine/` that compiles but breaks behaviour goes undetected. Line-ending sensitivity under core.autocrlf=true is untested. Belongs with the first story that modifies `engine/` (Story 1.2 or later).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-set-up-initial-inquello-fork.md`
  summary: Decide how to handle `engine/codex-rs/Cargo.lock`, which lists the 167 workspace crates at 0.0.0 while `Cargo.toml` says 0.165.0, so every cargo command rewrites it and `cargo build --locked` fails.
  evidence: Upstream state at `rust-v0.165.0`; editing it is an upstream change Story 1.1 forbids. Until decided, developers must restore the file after each build and CI cannot use `--locked`. Owner: architecture/implementation lead, before the first CI workflow or the first story that patches `engine/`.
  status: closed by Story 1.4 (`spec-1-4-keep-local-working-metadata-behind-domain-commands.md`), 2026-10-28. The regenerated lock (0.165.0 workspace versions plus the two new Inquello crates) is committed; `cargo build --locked` passes. Recorded in `FORK-CUT.md` under "Inquello patches to `engine/`".
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-set-up-initial-inquello-fork.md`
  summary: Run one clean `cargo build -j 4 -p codex-cli -p codex-app-server` from an empty target directory to prove the fresh-clone build and record its duration.
  evidence: Unverified (maybe-false, medium if it fails). The recorded passing build was incremental on a run that crashed from out-of-memory; a clean build would settle whether fresh clones build as documented.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-run-packaged-runtime-over-desktop-transport.md`
  summary: Give the desktop a real runtime build identity so the version check and schema stamp detect a fork change or stale binary that keeps version 0.165.0.
  evidence: The handshake compares only the semver in `userAgent`; `generate-protocol.mjs` stamps `HEAD:engine` without proving the binaries in `target/debug` were built from it. Fixing it needs the runtime to report a build identity, which means a deliberate `engine/` change. Revisit with the first story that patches `engine/`.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-run-packaged-runtime-over-desktop-transport.md`
  summary: Kill the whole app-server process tree on Windows when the stop grace expires.
  evidence: `child.kill()` ends only `codex-app-server`; once tools, shells or MCP servers run (later stories), their processes would outlive Inquello. Use `taskkill /T /F` or a job object.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-run-packaged-runtime-over-desktop-transport.md`
  summary: Test the protocol generator's safety guards (dirty `engine/` refusal and generator/runtime version equality).
  evidence: No test runs `scripts/generate-protocol.mjs`; removing either guard would let the stamp misstate provenance unnoticed. Needs a git fixture and two fake `--version` binaries.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-keep-local-working-metadata-behind-domain-commands.md`
  summary: Extend the domain dependency-direction check beyond the host platform.
  evidence: `inquello-domain/tests/dependency_direction.rs` reads `cargo tree --offline` for the host only, because offline `cargo metadata` needs every platform's crate manifests (for example `alsa`, `js-sys`) that the local registry cache lacks. A forbidden crate pulled in only under another target's `cfg` would pass on this host. Switch to `cargo metadata` once CI can fetch the full registry.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-9-register-capability-limits-before-enablement.md`
  summary: C/E inventory items with no realising story (`deferred-unmet` rows in `engine/codex-rs/inquello-domain/register/inventory-map.json`). Each such item is unmet scope that stays disabled, never an approved scope reduction.
  evidence: At 2026-10-28 the range-aware map accounts for all 99 items (C01–C78, C54A, E01–E20) and none is `deferred-unmet`: 99 are `planned`, 0 `enabled`. `cargo test -p inquello-domain --test inventory_map` prints the current list; if a planning change leaves an item unrealised, list it here by ID. Items realised only by Increment 2 stories are `planned`, not delivered, and still need their own register entries and evidence before enablement.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-10a-authenticate-identity-shared-service.md`
  summary: Story 1.10b, the desktop half of Story 1.10. It covers system-browser Authorization Code + PKCE S256 sign-in, credential storage in the OS credential store, the preload operation, and showing local and shared availability separately. Story 1-10 stays `in-progress` until 1.10b is done.
  evidence: Owner split decision of 2026-10-28. Story 1.10a delivered only the service, protocol and test issuer (`engine/codex-rs/inquello-service`, `inquello-protocol`). No desktop code calls them yet, and nothing has exercised the browser or PKCE leg.
  status: closed by Story 1.10b (`spec-1-10b-desktop-sign-in-and-https-topology.md`), 2026-10-28. The desktop main process signs in with Authorization Code + PKCE S256 through the system browser and a loopback redirect, keeps credentials in main and persists them only through OS-backed `safeStorage`, exposes `identity.getStatus`, `identity.signIn` and `identity.signOut`, and the Account block shows identity, shared-service availability and local private work separately.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-10a-authenticate-identity-shared-service.md`
  summary: HTTPS termination for the shared service, with scoped test-client trust (SC-7), exercised end to end by the desktop in Story 1.10b.
  evidence: The 1.10a service serves plain HTTP on loopback only. `ServiceConfig::validate` refuses any non-loopback bind because the service has no TLS yet. SC-7 requires HTTPS with trust scoped to the test client, never a production trust-store change or a bypass of browser warnings. Add a TLS listener option and lift the loopback-only refusal only once that exists.
  status: closed by Story 1.10b, 2026-10-28. `ServiceConfig.tls` terminates HTTPS with rustls; a non-loopback bind is accepted only with TLS. The `inquello-dev-topology` binary serves the service and the synthetic issuer over HTTPS with an ephemeral test CA, and the desktop trusts only that CA through a per-request `ca` option (no trust-store change, no `NODE_TLS_REJECT_UNAUTHORIZED`). Recorded in `FORK-CUT.md` as Patch 4.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-10a-authenticate-identity-shared-service.md`
  summary: Decide how a client recovers a self-logout whose response was lost.
  evidence: An exact retry of a logout of a *different* session returns the recorded receipt. A retry of a logout of the caller's *own* session gets `unauthenticated`, because that session is now revoked and protected requests never fall back. A client that loses its own logout response should treat `unauthenticated` as "logged out", or look the receipt up from another live session of the same principal. Record the rule in the 1.10b client contract.
  status: closed by Story 1.10b, 2026-10-28 (owner decision): `unauthenticated` on a retried self-logout means logged out. The desktop persists the logout envelope (with its `operation_id`) until it resolves and retries with the same envelope (`desktop/src/main/identity/session.ts`).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-10a-authenticate-identity-shared-service.md`
  summary: Fetch and rotate issuer signing keys (JWKS discovery) for a real issuer.
  evidence: 1.10a takes each issuer's JWKS as a static configuration input, which is enough for the in-process test issuer. A real issuer (OQ-16B) needs discovery, key rotation and cache rules that fail closed.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-10a-authenticate-identity-shared-service.md`
  summary: Add an expiry cleanup policy for consumed ID-token hashes, expired login transactions and closed session records.
  evidence: These rows are kept forever for now. A cleanup policy is a data-retention decision (SC-6) and must not be invented by code. `consumed_id_tokens.token_expires_at` already records when each row stops mattering for replay detection.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-10b-desktop-sign-in-and-https-topology.md`
  summary: Verify the OS credential store's process and sandbox boundaries on macOS (Keychain) and Windows (DPAPI), and decide whether same-user subprocess access to the stored session is acceptable per host.
  evidence: Story 1.10b exercised only Linux libsecret (gnome-keyring) in the smoke run; macOS and Windows take the `os-backed` path from `safeStorage.isEncryptionAvailable()` without a run on those hosts. SC-1 says encryption or OS storage alone does not prove isolation from arbitrary same-user subprocesses and unsupported hosts stay gated. Belongs with the packaging/route-eligibility work for each host.
  progress (2026-10-28): the owner ran the 1.10b manual checks on Windows 11 (build 26100) against the HTTPS dev topology, and all passed:
  - real system-browser sign-in through `shell.openExternal`, PKCE and the loopback redirect, with the test CA trusted in the user root store only;
  - the DPAPI `os-backed` path detected, and sign-in surviving an app restart;
  - `%APPDATA%\Inquello\identity\session.bin` holding no readable credential;
  - sign-out writing the durable logout receipt;
  - shared service unavailable after the topology stopped, while private work stayed local.

  Still open: macOS Keychain has not been run, and the same-user subprocess isolation decision is still to be made on every host.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-10b-desktop-sign-in-and-https-topology.md`
  summary: Load real deployment TLS material (certificate chain and key from protected storage, rotation) for the shared service.
  evidence: `TlsConfig` takes in-memory DER material; only the ephemeral test CA (`test_tls.rs`, `test-issuer` feature) produces it today. A real deployment's key handling and rotation are OQ-16B decisions and must fail closed until supplied.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-11-enforce-internal-company-memberships.md`
  summary: Mirror the Story 1.11 Workspace wire types in the desktop (Story 1.14), including the optional `reason` on refusal bodies.
  evidence: The Workspace fixtures live in `engine/codex-rs/inquello-protocol/fixtures/workspace/` so the desktop's top-level fixture-coverage test is unchanged ("no desktop changes"). The desktop's `parseErrorBody` rejects unknown keys, so it would refuse a Workspace refusal body that carries `reason`; no desktop code calls a Workspace route yet. `GET /v1/memberships` keeps its shape but now lists one row per role binding of an active `internal_company` membership.
  status: closed by Story 1.14 (`spec-1-14-organise-workspaces-engagements-folders-tasks.md`), 2026-10-29. `desktop/src/main/identity/wire.ts` mirrors every Workspace type (views, roles, policy, invite acceptance, command envelopes, access checks) and `parseErrorBody` accepts the optional `reason` from the fixed deny-reason set; `test/identity-wire.test.ts` round-trips every fixture in `fixtures/workspace/`.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-11-enforce-internal-company-memberships.md`
  summary: Replace the fixture-only `resource_registrations` and `grants` tables with Epic 4's registration and grant-issuing commands, and decide where the authority learns a private Task's creator.
  evidence: Story 1.11 forbids a grant-issuing API, so access checks read seeded rows only. Private Tasks are local (desktop SQLite); the service knows a private Task's creator only through a registration row. Epic 4 (sharing) owns registration, grants and the SC-5 per-use rechecks.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-11-enforce-internal-company-memberships.md`
  summary: Add an expiry and retention policy for closed invites, operator receipts and Workspace events, and decide whether `update-policy` should also rebind members whose roles the new policy drops.
  evidence: Rows are kept forever for now (a data-retention decision under SC-6). A binding to a role the current policy no longer defines grants nothing (fail closed) but stays stored until an administrator changes that member's roles.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-14-organise-workspaces-engagements-folders-tasks.md`
  summary: Regenerate the Python SDK's protocol types (`engine/sdk/python`) for the new `inquello/*` methods.
  evidence: `app-server-protocol/scripts/write_schema_fixtures.py` ends with an `uv run ... update_sdk_artifacts.py` step. Story 1.14 regenerated the vendored schema fixtures and precomputed exports directly through `write_schema_fixtures_from_env`, without `uv` (not installed here, and the step is outside Inquello's build). The Python SDK is not used by Inquello; regenerate it if it ever is.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-14-organise-workspaces-engagements-folders-tasks.md`
  summary: Export the working store as a consistent snapshot.
  evidence: The `working-store` category is `included` in exports (owner decision), but `data.export` copies `working.sqlite` and its `-wal`/`-shm` files while the runtime holds them open. With no write during the copy the three files are consistent (the smoke round trip passes), but a write landing mid-copy could produce a torn snapshot. A runtime-side checkpoint or an `inquello/store/backup` method (SQLite `VACUUM INTO`) before copying would close this.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-14-organise-workspaces-engagements-folders-tasks.md`
  summary: Extend the working store's agent-writable roots beyond `CODEX_HOME` once Tasks run threads.
  evidence: The app-server opens the store refusing a path inside `CODEX_HOME` only. Before Story 1.25 no thread runs, so no other writable root exists; when threads start, their sandbox writable roots (cwd and extra roots) must also be passed, or the store location re-checked per thread.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-14-organise-workspaces-engagements-folders-tasks.md`
  summary: Decide what happens to local Engagements and private Tasks of a Workspace the principal no longer belongs to.
  evidence: While the shared service answers, the Sidebar lists only the Workspaces it returns, so a removed member's local Tasks for that Workspace are hidden but kept on the device (they remain in the working store and in exports). While the service is down, remembered Workspaces are listed. A retention or hand-back rule for these records is a data-policy decision (OQ-2), not one the code should invent.


## Deferred from: code review of spec-1-11-enforce-internal-company-memberships.md (2026-10-29)

- **D01: Administrator preservation counts disabled principals** — medium; likelihood Low, impact Medium. The query counts active memberships without joining principal status; admin.ts:317 does likewise. With two administrator memberships and one disabled principal, the only usable administrator can be removed/demoted while the predicate still passes. Disabled principal rows are represented in tests, but no supported production disable command exists in src; ordinary operator commands do not create this transition. This is a conditional lifecycle risk, not a reproduced current UI failure. Deferred because: Leave until the principal-disable lifecycle is implemented. Evidence to settle/resume: Add a PostgreSQL fixture with one active and one disabled admin, then test removal, demotion, policy update, disable and reenable concurrently. No database-backed reproduction was run here. See [review](reviews/2026-10-29-epic-1/report.md).
- **D02: Invite redemption checks grantor membership but not principal status** — medium; likelihood Low, impact High. A pending invite remains redeemable if its grantor’s membership stays active while the principal is disabled: the predicate checks membership and manage_membership only. The invitee is still authenticated and the invite remains bound to the exact issuer/subject; this does not let an arbitrary person redeem it. As with D01, disabling currently requires fixture/direct database manipulation rather than a supported user route. Deferred because: Leave until the principal-disable lifecycle is implemented. Evidence to settle/resume: Exercise redemption before/after grantor disable, removal and reenable, including a racing disable. Decide the lifecycle contract at that feature checkpoint; this review does not require a new account-disable feature. See [review](reviews/2026-10-29-epic-1/report.md).


## Deferred from: code review of spec-1-13-keep-provider-credentials-separate.md (2026-10-29)

- **D03: Claude action completion waits for an unrelated Codex status request** — maybe-false; likelihood Unknown, impact Medium (unverified). Every completed Claude action awaits getStatus, including Codex account/read. A never-resolving fake request would leave the UI waiting even after the key operation completed. The coupling is confirmed, but no indefinite account/read stall was demonstrated with the pinned shipped runtime; generic absent RPC deadlines were already rejected in Story 1.2 under its trust model. No actual provider key loss was shown. Deferred because: Leave unless a shipped-runtime stall is reproduced. Evidence to settle/resume: Reproduce with the shipped runtime and a real keyring failure, recording request completion/termination behavior; a deliberately hung fake alone does not establish production likelihood. See [review](reviews/2026-10-29-epic-1/report.md).


## Deferred from: spec-1-17-compose-plain-private-request.md (2026-10-29)

- source_spec: `_bmad-output/implementation-artifacts/spec-1-17-compose-plain-private-request.md`
  summary: Detect a change of principal for Composer draft clearing from a stable principal reference, not display name and issuer.
  evidence: The renderer is never given a principal ID, so the draft store detects a principal change from display name plus issuer, and clears all drafts on every sign-in or sign-out seen in the window. The gap is a session switch made in main between two principals with the same display name and issuer that the window does not observe. Resolve when main exposes an opaque per-principal fingerprint to the renderer (at latest when drafts gain real sends in Story 1.25).

- source_spec: `spec-1-22-configure-initial-processing-routes-without-silent-fallback.md`
  summary: Native locked build and genuine generated protocol remain an owner-run acceptance gate (unverified high impact).
  evidence: Cargo, complete Git checkout and matching runtime unavailable; authored RPC/dependency changes require real compilation, lock resolution and generation before acceptance.

- source_spec: `spec-1-26-follow-actual-basic-progress-and-truthful-results.md`
  summary: Validate cumulative plan update expectations during the auditor walkthrough; omission currently does not withdraw a step.
  evidence: Unverified medium usability claim only; tool contract explicitly describes cumulative updates and no reset/delete. Representative provider use will establish whether this needs a separately approved change.
- source_spec: `spec-1-26-follow-actual-basic-progress-and-truthful-results.md`
  summary: Measure upstream retained-history allocation under large command output on the complete native runtime.
  evidence: Projection sanitation and wire size are bounded, but upstream store allocations are outside that display bound. Actual resource harm was not established in this partial checkout; unverified medium risk requires native stress evidence.
