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
