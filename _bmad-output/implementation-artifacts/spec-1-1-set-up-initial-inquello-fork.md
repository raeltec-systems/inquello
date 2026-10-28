---
title: 'Story 1.1: Set up the initial Inquello fork from the selected public Codex cut'
type: 'chore'
created: '2026-10-28'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'e57a15d2cb067217be550aa9f97e14d327d8a25c'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Inquello has planning but no code. Every runtime-dependent story needs an identified, reproducible public Codex foundation with a verified toolchain, and the inspected planning revisions are evidence only, not a chosen cut.

**Approach:** Select upstream release `rust-v0.165.0` (commit `360319d8dee62d87e2d59fc0c21805d79519cfed`, 2026-10-27) as the delivery cut, import it into this repository under `fork/` with a squashed git subtree, install the pinned toolchain on drive D:, verify the Rust and TypeScript builds, and record the cut, reasons, setup commands and results in `FORK-CUT.md`.

**Owner authorization (2026-10-28):** clone public `openai/codex`, install rustup with Rust 1.99.1 and update pnpm to 10.34.5; toolchains and build output stay on D:; work on a feature branch.

## Boundaries & Constraints

**Always:** Keep upstream content byte-identical under `fork/` at the cut; keep upstream `LICENSE` and `NOTICE` (Apache-2.0). Put `RUSTUP_HOME`, `CARGO_HOME` and all build output on D:. Record every deviation from the planned stack with its reason. Record the full canonical commit SHA verbatim.

**Never:** No Inquello code, crates, Electron or React scaffolding in this story (later stories). No edits to upstream files. No credentials, API calls or live inference. No Microsoft C++ build tools install; they are already present. No push or merge to `main`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Clean import | Clean tree on feature branch | `fork/` holds upstream tree at the cut; one squash commit plus one merge commit | N/A |
| Toolchain auto-select | `cargo` run inside `fork/codex-rs` | `rust-toolchain.toml` selects 1.99.1 with clippy, rustfmt, rust-src | If download fails, stop and record; do not substitute another version |
| Disk pressure | C: low on space | No toolchain or target writes to C: | Fail fast, report free space |
| Frozen install | `pnpm install --frozen-lockfile` in `fork/` | Lockfile honoured, TypeScript resolves to 5.9.2 | Lockfile mismatch is a failure, not an update |
| Build failure | Compile error at the cut | Recorded in `FORK-CUT.md` with crate and error; story not marked done | No upstream patching in this story |

</frozen-after-approval>

## Code Map

- `fork/` -- new; upstream tree at the cut. Pins: `fork/codex-rs/Cargo.toml` (edition 2024), `fork/codex-rs/rust-toolchain.toml` (1.99.1), `fork/package.json` (`pnpm@10.34.5`, node >=22), `fork/pnpm-lock.yaml` (v9, TypeScript 5.9.2).
- Build targets: packages `codex-cli` (bin `codex`) and `codex-app-server`, which later stories embed over stdio; TypeScript target `fork/sdk/typescript` (`@openai/codex-sdk`, `tsup`).
- SQLite: workspace pins `sqlx =0.9.0`; record the bundled SQLite version resolved in `Cargo.lock` against the 3.51.3 WAL-reset floor.
- `FORK-CUT.md` -- new at repo root; the AC 1.1.1 record.
- `.gitignore` -- upstream ignores under `fork/` cover `target/` and `node_modules/`; edit only if build output shows as untracked.
- Planning documents stay untouched apart from this spec and sprint status.

## Tasks & Acceptance

**Execution:**
- [x] `fork/` -- `git subtree add --prefix=fork --squash https://github.com/openai/codex rust-v0.165.0` -- reproducible import that supports later `git subtree pull` upgrades
- [x] toolchain -- set user `RUSTUP_HOME=D:\Toolchains\rustup` and `CARGO_HOME=D:\Toolchains\cargo`, run official `rustup-init.exe` with `--default-toolchain none`, let the pin install 1.99.1; `npm install -g pnpm@10.34.5` -- authorized installs, kept off C:
- [x] build -- `cargo build -p codex-cli -p codex-app-server` in `fork/codex-rs`; `pnpm install --frozen-lockfile` and `pnpm --filter @openai/codex-sdk build` in `fork/` -- AC 1.1.2 build verification
- [x] `FORK-CUT.md` -- record cut (tag, tag-object SHA, commit SHA, date, reason), import method and upgrade command, licence, setup commands, observed versions vs planned stack with deviations, build commands and outcomes, resolved SQLite version -- AC 1.1.1 and 1.1.2 record
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- advance story 1-1 status through the workflow -- tracking

**Acceptance Criteria:**
- Given a fresh clone of this branch, when a developer follows `FORK-CUT.md`, then the same upstream commit is checked out under `fork/` and the same toolchain versions are selected.
- Given the cut, when versions are compared, then Rust 1.99.1, edition 2024, pnpm 10.34.5 and TypeScript 5.9.2 match, and React 19.3.1 and Electron 45.0.0 are recorded as not present upstream, with local Node 24.22.0 matching Electron 45's bundled Node.
- Given the toolchain, when both builds run, then both binaries report a version and the SDK build exits 0, or failures are recorded and the story stays open.

## Implementation Notes

- Import: squash `86c177429bbc13bc689650667d2ac9dca5e716cc` (`git-subtree-split: 360319d8dee62d87e2d59fc0c21805d79519cfed`) and merge `5aceac53db54c6f1a4413a7dc909b38b8dfde345`. The tree `307e4fa207fe563a11f3f7af09cee6fccd2d8376` is identical for the squash commit, `HEAD:fork` and the upstream commit.
- The commits were authored as `raeltec-systems <israel.muyoba@raeltec.com>` through per-command `GIT_AUTHOR_*`/`GIT_COMMITTER_*`, because this repo has no git identity configured. No git config was changed.
- pnpm 10.34.5 went into the npm prefix `D:\Toolchains\npm-global` to stay off C:. The corepack shim in `C:\Program Files\nodejs` comes first on PATH, so build shells prepend that prefix.
- Cargo rewrites the 167 workspace-member versions in `Cargo.lock` from 0.0.0 to 0.165.0 (the upstream release pipeline bumps them). The rewrite was discarded after the build and not committed.
- The first `cargo build` hit out-of-memory at 16 jobs (the pagefile is on a nearly full C:). It succeeded with `-j 4` and no source changes.
- The bundled SQLite is 3.51.3 (`libsqlite3-sys 0.37.0`), which meets the floor.
- All deviations are recorded in `FORK-CUT.md`.

## Spec Change Log

## Review Triage Log

Pass 1 (2026-10-28). Layers: verification-gap (VG), blind-hunter (BH), edge-case-hunter (EC). No intent_gap or bad_spec entries.

| Finding | Verdict | Evidence | Route |
|---|---|---|---|
| VG-1 upstream tests/CI never run (`fork/.github` inert, no test command recorded) | medium | Pre-verified gap; no root `.github`; workflows assume `codex-rs` at repo root. Upstream tests may also be line-ending sensitive (core.autocrlf=true). | defer D1 |
| VG-2 `Cargo.lock` lists workspace crates at 0.0.0; builds dirty it, `--locked` fails | medium | Confirmed by implementation record; upstream state at the cut, not caused by this story; committing a fix edits upstream, which the intent forbids. | defer D2 |
| VG-3 no tests or Inquello code in diff; sprint values valid | false | Observation, not a defect; story is import plus build. | reject |
| BH-1 / EC-1 `SetEnvironmentVariable(...,'User')` does not set the running shell, so rustup-init as written installs to C: | medium | .NET User-scope env does not update `$env:`; recorded commands differ from what produced D: homes. | patch P1 |
| BH-2 / EC-2 / EC-3 download and tmp directories never created | medium | `Invoke-WebRequest -OutFile` into a missing folder fails on a fresh machine. | patch P1 |
| BH-2 / EC-4 rustup-init hash check only a comment | medium | No `Get-FileHash` comparison in the block. | patch P1 |
| BH-2 / EC-5 TMP/TEMP/npm cache set after installs | low | Lines 76-77 follow lines 62-72. | patch P1 |
| EC-6 repeated relative `cd fork\codex-rs` | low | Second `cd` fails from inside `fork\codex-rs`; later steps work only by accident. | patch P1 |
| EC-7 no exit-code checks after cargo/pnpm | low | A failed build would not stop the block. | patch P1 |
| EC-12 corepack pnpm shim can shadow 10.34.5 | low | Recorded in deviation 2; no check in block. | patch P1 |
| BH-3 integrity check uses `HEAD:fork`, which breaks once `fork/` is patched | medium | Epic plans minimal core changes; check should name the import merge commit. | patch P2 |
| EC-9 `HEAD:fork` misses uncommitted `fork/` edits | medium | `rev-parse` reads the committed tree only; an un-restored `Cargo.lock` would pass. | patch P2 |
| BH-4 / EC-10 no merge rule; squash or rebase merge loses the subtree split commit and cited SHAs | medium | `git subtree pull` finds the prior split by its trailer commit in history. | patch P3 |
| BH-5 / EC-11 tag-object SHA recorded but never checked | low | Verification compares commit and tree only; fix is one line. | patch P4 |
| BH-6 "byte-identical" claim with core.autocrlf=true | low | Working copy has CRLF (3 CR bytes in `rust-toolchain.toml`); tree hashes match, bytes on disk do not. | patch P5 |
| BH-7 successful build was incremental on a crashed one; no clean build | maybe-false | Crash was OOM, not code; a clean `-j 4` build from empty `target/` would settle it. Medium if a clean build fails. | defer D3 |
| BH-8 persist `-j 4` in a repo-root `.cargo/config.toml` | low | Cause is this host's full C: pagefile; persisting would throttle every other machine; already documented. | reject |
| BH-9 Cargo.lock decision has no owner | medium | Same root as VG-2. | defer D2 |
| BH-10 / EC-13 `npm_config_cache` fix claimed but not re-tested | low | The recorded run is the one that wrote 62 MB to C:. | patch P6 |
| BH-11 Node 24.22.0 match has no source | low | Source exists in architecture technology evidence (Electron 45.0.0 release notes); not cited in `FORK-CUT.md`. | patch P7 |
| BH-12a spec Verification commands are machine-specific | low | Fix edits this build's spec. | reject |
| BH-12b SQLite header path not named | low | Version evidence cannot be re-checked without the path. | patch P8 |
| BH-13 commit identity used without authorization | false | All prior repo commits use `raeltec-systems <israel.muyoba@raeltec.com>`; the approved spec specifies the squash and merge commits; no git config changed. | reject |
| BH-14 `in-review` vs `review` labels disagree | false | Spec template and sprint file define separate vocabularies; both values are legal in their own file. | reject |
| EC-8 later cargo commands rewrite lockfile and OOM | medium | Lockfile part shares root with VG-2; job-count part as BH-8. | defer D2 |

## Design Notes

**Why `rust-v0.165.0`:** newest non-prerelease release; its pins match the planned stack exactly; a tag is stable, unlike moving `main` or the planning evidence snapshots.

**Why squashed subtree under `fork/`:** matches the architecture seed layout (`fork/codex-rs/…`, later `desktop/`), keeps one repository with no external fork to host, keeps upstream history out of Inquello history, and still allows `git subtree pull --prefix=fork --squash <url> <tag>` upgrades. A submodule would need a separately hosted fork.

## Verification

**Commands:**
- `rustc --version` in `fork/codex-rs` -- expected: `rustc 1.99.1`
- `D:\Projects\inquello\fork\codex-rs\target\debug\codex.exe --version` and `codex-app-server.exe --help` -- expected: run and exit 0
- `pnpm --version` -- expected: `10.34.5`
- `git rev-parse <squash-commit>^{tree}` equals `git rev-parse HEAD:fork` -- expected: identical tree hashes (upstream untouched)
- `Get-PSDrive C` before and after -- expected: no material C: growth from toolchain or target
