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
- source_spec: `_bmad-output/implementation-artifacts/spec-1-10a-authenticate-identity-shared-service.md`
  summary: HTTPS termination for the shared service, with scoped test-client trust (SC-7), exercised end to end by the desktop in Story 1.10b.
  evidence: The 1.10a service serves plain HTTP on loopback only. `ServiceConfig::validate` refuses any non-loopback bind because the service has no TLS yet. SC-7 requires HTTPS with trust scoped to the test client, never a production trust-store change or a bypass of browser warnings. Add a TLS listener option and lift the loopback-only refusal only once that exists.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-10a-authenticate-identity-shared-service.md`
  summary: Decide how a client recovers a self-logout whose response was lost.
  evidence: An exact retry of a logout of a *different* session returns the recorded receipt. A retry of a logout of the caller's *own* session gets `unauthenticated`, because that session is now revoked and protected requests never fall back. A client that loses its own logout response should treat `unauthenticated` as "logged out", or look the receipt up from another live session of the same principal. Record the rule in the 1.10b client contract.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-10a-authenticate-identity-shared-service.md`
  summary: Fetch and rotate issuer signing keys (JWKS discovery) for a real issuer.
  evidence: 1.10a takes each issuer's JWKS as a static configuration input, which is enough for the in-process test issuer. A real issuer (OQ-16B) needs discovery, key rotation and cache rules that fail closed.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-10a-authenticate-identity-shared-service.md`
  summary: Add an expiry cleanup policy for consumed ID-token hashes, expired login transactions and closed session records.
  evidence: These rows are kept forever for now. A cleanup policy is a data-retention decision (SC-6) and must not be invented by code. `consumed_id_tokens.token_expires_at` already records when each row stops mattering for replay detection.
