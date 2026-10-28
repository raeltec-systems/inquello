# Deferred work

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-set-up-initial-inquello-fork.md`
  summary: Run the upstream Codex Rust and SDK tests for the imported `fork/` tree from this repository's own verification path, since `fork/.github/workflows` never triggers and assumes `codex-rs` at the repo root.
  evidence: Story 1.1 verified build plus version output only; no root `.github` exists, so any later change to `fork/` that compiles but breaks behaviour goes undetected. Line-ending sensitivity under core.autocrlf=true is untested. Belongs with the first story that modifies `fork/` (Story 1.2 or later).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-set-up-initial-inquello-fork.md`
  summary: Decide how to handle `fork/codex-rs/Cargo.lock`, which lists the 167 workspace crates at 0.0.0 while `Cargo.toml` says 0.165.0, so every cargo command rewrites it and `cargo build --locked` fails.
  evidence: Upstream state at `rust-v0.165.0`; editing it is an upstream change Story 1.1 forbids. Until decided, developers must restore the file after each build and CI cannot use `--locked`. Owner: architecture/implementation lead, before the first CI workflow or the first story that patches `fork/`.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-set-up-initial-inquello-fork.md`
  summary: Run one clean `cargo build -j 4 -p codex-cli -p codex-app-server` from an empty target directory to prove the fresh-clone build and record its duration.
  evidence: Unverified (maybe-false, medium if it fails). The recorded passing build was incremental on a run that crashed from out-of-memory; a clean build would settle whether fresh clones build as documented.
