# Inquello engine cut

Inquello's engine is our own fork of the public `openai/codex` repository: we modify and extend it. It lives under `engine/`, which was named `fork/` until 2026-10-28 (see "Directory rename" below).

This file records which upstream Codex revision Inquello is built on, how it was imported, how to set up the toolchain, and what the first build verification found. It is the record for Story 1.1 (AC 1.1.1 and AC 1.1.2).

## Selected cut

| Field | Value |
|---|---|
| Upstream repository | `https://github.com/openai/codex` (public) |
| Release tag | `rust-v0.165.0` |
| Tag object SHA | `e374836b2728d9b7aa981c2902649e640a2edaa8` |
| Commit SHA | `360319d8dee62d87e2d59fc0c21805d79519cfed` |
| Commit tree SHA | `307e4fa207fe563a11f3f7af09cee6fccd2d8376` |
| Commit date | 2026-10-27T15:19:19-03:00 (2026-10-27T18:19:19Z) |
| Tag date | 2026-10-27T15:19:20-03:00 (tagger Felipe Coury, message "Release 0.165.0") |
| Selected on | 2026-10-28 |
| Licence | Apache-2.0. Upstream `engine/LICENSE` and `engine/NOTICE` are kept unchanged. |

**Why this cut.** `rust-v0.165.0` was the newest non-prerelease release when we selected it. Its pins match the planned stack: Rust 1.99.1, edition 2024, pnpm 10.34.5 and TypeScript 5.9.2. A release tag also stays fixed, while `main` and the snapshots inspected during planning keep moving. Those planning snapshots are evidence only and were not used as the cut.

## Import method

The upstream tree was imported under `fork/` (now `engine/`) as a squashed git subtree:

```sh
git subtree add --prefix=fork --squash https://github.com/openai/codex rust-v0.165.0
```

This created two commits on `feat/1-1-codex-fork-setup`:

- `86c177429bbc13bc689650667d2ac9dca5e716cc` is the squash commit "Squashed 'fork/' content from commit 360319d8d". It carries the trailers `git-subtree-dir: fork` and `git-subtree-split: 360319d8dee62d87e2d59fc0c21805d79519cfed`.
- `5aceac53db54c6f1a4413a7dc909b38b8dfde345` is the merge commit that adds `fork/` to the Inquello history.

**Merge rule:** merge this branch into `main` with a true merge commit, never a squash or rebase merge. A squash or rebase merge would drop the subtree squash commit and every SHA cited here, which breaks `git subtree pull`.

We chose a squashed subtree over a submodule for four reasons. It matches the architecture seed layout (`fork/codex-rs/...` at the time, now `engine/codex-rs/...`, beside `desktop/`). It keeps one repository, so we don't host a separate fork. It keeps upstream history out of Inquello history. And it still supports upgrades. A submodule would need a separately hosted fork.

**Upgrade command** (for a later, deliberately selected cut):

```sh
git subtree pull --prefix=engine --squash https://github.com/openai/codex <new-tag>
```

### Directory rename (`fork/` to `engine/`, 2026-10-28)

The owner renamed `fork/` to `engine/` so the directory says what it holds: Inquello's modified copy of Codex. The rename commit moves the files only; their content and the tree hash `307e4fa207fe563a11f3f7af09cee6fccd2d8376` are unchanged.

`git subtree` finds the previous import by searching commit messages for `git-subtree-dir: <prefix>`, and the original squash commit says `fork`. So a marker commit follows the rename, titled "Rejoin engine/ subtree after rename from fork/". It is an empty merge commit whose second parent is the squash commit `86c177429bbc13bc689650667d2ac9dca5e716cc`, with these trailers:

```text
git-subtree-dir: engine
git-subtree-mainline: <the rename commit>
git-subtree-split: 360319d8dee62d87e2d59fc0c21805d79519cfed
```

git-subtree reads a commit carrying `git-subtree-mainline` as a rejoin and uses its second parent as the latest squash. So `git subtree pull --prefix=engine --squash` merges against the original squash commit exactly as it would have under `fork/`. The merge rule above keeps both commits in `main`'s history.

Earlier records (the Story 1.1–1.3 specs, the planning documents and "Build verification" below) still say `fork/`. They describe paths as they were at the time.

### Checking that `engine/` matches the imported cut

Run these from a fresh clone of this branch:

```sh
git log -1 --format=%B 86c177429bbc13bc689650667d2ac9dca5e716cc     # shows git-subtree-split: 360319d8dee62d87e2d59fc0c21805d79519cfed
git rev-parse 86c177429bbc13bc689650667d2ac9dca5e716cc^{tree}         # 307e4fa207fe563a11f3f7af09cee6fccd2d8376
git rev-parse 5aceac53db54c6f1a4413a7dc909b38b8dfde345:fork           # must print the same tree hash (fork/ as imported)
git rev-parse HEAD:engine                                             # same hash while engine/ is unpatched
git status --porcelain -- engine                                      # must print nothing (no uncommitted edits, e.g. an un-restored Cargo.lock)
git fetch https://github.com/openai/codex refs/tags/rust-v0.165.0
git rev-parse FETCH_HEAD                                              # tag object: e374836b2728d9b7aa981c2902649e640a2edaa8
git rev-parse FETCH_HEAD^{commit} FETCH_HEAD^{tree}                   # 360319d8dee62d87e2d59fc0c21805d79519cfed and 307e4fa207fe563a11f3f7af09cee6fccd2d8376
```

At import, all three tree hashes matched (`307e4fa207fe563a11f3f7af09cee6fccd2d8376`): the squash commit tree, `fork/` in the import merge commit, and the upstream commit's tree. So `fork/` is git tree-identical to upstream at the cut. "Tree-identical" means the committed content: this repository runs with `core.autocrlf=true` (set in the system gitconfig), so the files under `fork/` that the builds below used had CRLF line endings in the working copy.

Later stories may patch `engine/` on purpose. To review those patches against the imported cut, run `git diff 5aceac53db54c6f1a4413a7dc909b38b8dfde345:fork HEAD:engine`. Since Story 1.4, `HEAD:engine` no longer equals the imported tree hash; see "Inquello patches to `engine/`" below.

## Inquello patches to `engine/`

Each deliberate change to `engine/` is listed here. Upstream crates' code stays unedited unless an entry says otherwise.

### Patch 1: Inquello working-store crates (Story 1.4, 2026-10-28)

The first deliberate engine patch. It adds code beside upstream and changes no upstream crate's code.

- **New crates** in `engine/codex-rs/`:
  - `inquello-domain`: the rules, commands (`InitializeStore`, `get_store_info`) and ports (`WorkingStore`, `Clock`) for local working metadata. It depends only on `thiserror` and `uuid`; `inquello-domain/tests/dependency_direction.rs` fails if it reaches sqlx, tokio, any `codex-*` crate or `inquello-adapters`.
  - `inquello-adapters`: `SqliteWorkingStore` (sqlx SQLite, WAL, full sync, busy timeout, embedded migration `0001_store_info_and_receipts.sql`) and `SystemClock`. Its only SQLite connect calls live in `src/sqlite.rs`, which carries the `clippy::disallowed_methods` expectation the same way `state/src/sqlite.rs` does.
  - Neither crate has a `BUILD.bazel`; Bazel is not used in this repository.
- **Workspace manifest** `engine/codex-rs/Cargo.toml`: both crates added to `[workspace] members` and as `inquello-domain` / `inquello-adapters` path entries under `[workspace.dependencies]`. No external dependency or version pin changed; the crates use existing workspace pins only (`sqlx`, `sqlx-macros`, `thiserror`, `uuid` with its `v4` feature, and `tokio`, `tempfile`, `pretty_assertions` for tests).
- **Lockfile** `engine/codex-rs/Cargo.lock`: committed as cargo regenerates it. That adds the two new packages and rewrites the 167 upstream workspace members from `0.0.0` to `0.165.0` (deviation 4). No external package changed. `cargo build --locked` now succeeds, and builds no longer leave `Cargo.lock` dirty, so the `git checkout -- Cargo.lock` step in the setup script is no longer needed.

After a future `git subtree pull`, expect conflicts only in `Cargo.toml` members and `Cargo.lock`; regenerate the lock with cargo rather than merging it by hand.

## Toolchain setup (Windows, everything on D:)

The owner authorized these installs on 2026-10-28. Toolchains, caches and build output stay on D:. The Microsoft C++ build tools were already present and were not installed.

Run this block top to bottom in Windows PowerShell from any directory. Set `$Repo` to your clone first. The block stops at the first failure.

```powershell
$ErrorActionPreference = 'Stop'
$Repo = 'D:\Projects\inquello'          # root of your clone of this branch
$T    = 'D:\Toolchains'

# 0. Create the D: folders. Point this process at them before any install, and keep the Rust homes for future shells.
New-Item -ItemType Directory -Force "$T\rustup","$T\cargo","$T\downloads","$T\tmp","$T\npm-global","$T\npm-cache","$T\pnpm-store","$T\pnpm-cache" | Out-Null
$env:RUSTUP_HOME = "$T\rustup"; $env:CARGO_HOME = "$T\cargo"
$env:TMP = "$T\tmp"; $env:TEMP = "$T\tmp"
$env:npm_config_cache = "$T\npm-cache"   # nested npm runs (git-hosted deps) otherwise cache on C:
[Environment]::SetEnvironmentVariable('RUSTUP_HOME', "$T\rustup", 'User')
[Environment]::SetEnvironmentVariable('CARGO_HOME',  "$T\cargo",  'User')

# 1. Rust: download rustup-init, check it against the published SHA-256, install with no default toolchain.
$Base = 'https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe'
Invoke-WebRequest $Base -OutFile "$T\downloads\rustup-init.exe"
Invoke-WebRequest "$Base.sha256" -OutFile "$T\downloads\rustup-init.exe.sha256"
$Expected = ((Get-Content "$T\downloads\rustup-init.exe.sha256" -Raw).Trim() -split '\s+')[0]
$Actual   = (Get-FileHash "$T\downloads\rustup-init.exe" -Algorithm SHA256).Hash
if ($Actual -ne $Expected) { throw "rustup-init.exe SHA-256 mismatch: got $Actual, expected $Expected" }
& "$T\downloads\rustup-init.exe" -y --default-toolchain none --profile minimal
if ($LASTEXITCODE -ne 0) { throw "rustup-init failed ($LASTEXITCODE)" }
$env:Path = "$T\cargo\bin;$env:Path"   # rustup-init also adds this to the user PATH for future shells
Push-Location "$Repo\engine\codex-rs"
rustc --version                        # rust-toolchain.toml auto-installs 1.99.1 + clippy, rustfmt, rust-src
if ($LASTEXITCODE -ne 0) { throw "rustc failed ($LASTEXITCODE)" }
Pop-Location

# 2. pnpm 10.34.5, installed with npm into a prefix on D:, ahead of the corepack shim in C:\Program Files\nodejs.
npm install -g pnpm@10.34.5 --prefix "$T\npm-global" --cache "$T\npm-cache"
if ($LASTEXITCODE -ne 0) { throw "npm install pnpm failed ($LASTEXITCODE)" }
$env:Path = "$T\npm-global;$env:Path"
$PnpmSrc = (Get-Command pnpm).Source
if (-not $PnpmSrc.StartsWith("$T\npm-global", [StringComparison]::OrdinalIgnoreCase)) { throw "pnpm resolves to $PnpmSrc, not $T\npm-global" }
pnpm --version                         # expected 10.34.5

# 3. Rust build (see "Build verification" for results).
Push-Location "$Repo\engine\codex-rs"
cargo build -j 4 -p codex-cli -p codex-app-server
$code = $LASTEXITCODE
git checkout -- Cargo.lock             # discard cargo's workspace-version rewrite (deviation 4)
if ($code -ne 0) { throw "cargo build failed ($code)" }
Pop-Location

# 4. TypeScript install and SDK build.
Push-Location "$Repo\engine"
pnpm install --frozen-lockfile --store-dir "$T\pnpm-store" --cache-dir "$T\pnpm-cache"
if ($LASTEXITCODE -ne 0) { throw "pnpm install failed ($LASTEXITCODE)" }
pnpm --filter @openai/codex-sdk build
if ($LASTEXITCODE -ne 0) { throw "SDK build failed ($LASTEXITCODE)" }
Pop-Location
```

In the original run on 2026-10-28 these steps ran as separate commands rather than this single script, and `npm_config_cache` was not yet set (deviation 6). The script itself has not been run end to end. The outcomes of the original run are in "Build verification" below.

Recorded installs:

- rustup-init SHA-256 `00f139da614dced87d3c3d4121c43eebdac3c1bf8a5ee86b9d80dfd71c8d70fd`, which matches the official `.sha256`. It installed rustup 1.29.2 (d8c92c676 2026-10-21).
- The toolchain is `1.99.1-x86_64-pc-windows-msvc`, selected by the override in `engine/codex-rs/rust-toolchain.toml`. Components: cargo, clippy, rust-src, rust-std, rustc, rustfmt.

## Observed versions vs planned stack

| Item | Planned | Pinned at cut | Observed locally | Result |
|---|---|---|---|---|
| Rust | 1.99.1 | `fork/codex-rs/rust-toolchain.toml`: `channel = "1.99.1"` | `rustc 1.99.1 (58cf8f9c3 2026-10-13)`, `cargo 1.99.1 (5f94df478 2026-08-27)` | Match |
| Rust edition | 2024 | `fork/codex-rs/Cargo.toml`: `edition = "2024"` | n/a | Match |
| pnpm | 10.34.5 | `fork/package.json`: `packageManager: pnpm@10.34.5+sha512...`, `engines.pnpm >=10.34.5` | `10.34.5` | Match |
| TypeScript | 5.9.2 | `fork/pnpm-lock.yaml` (lockfile v9): `typescript@5.9.2` | `tsc` reports `Version 5.9.2` | Match |
| Node | Node bundled with Electron 45.0.0 | `fork/package.json`: `engines.node >=22` | `v24.22.0` | Matches. The Electron v45.0.0 release notes (https://github.com/electron/electron/releases/tag/v45.0.0) list Node `v24.22.0` under Stack Upgrades. |
| React | 19.3.1 | Not present upstream (no React dependency in any upstream `package.json` or `pnpm-lock.yaml`) | n/a | Not present upstream; added in a later story |
| Electron | 45.0.0 | Not present upstream | n/a | Not present upstream; added in a later story |
| SQLite (bundled through SQLx) | at least 3.51.3 (WAL-reset fix) | `sqlx =0.9.0` with `sqlite-bundled`; `libsqlite3-sys 0.37.0` in `Cargo.lock` | Read from `D:\Toolchains\cargo\registry\src\index.crates.io-1949cf8c6b5b557f\libsqlite3-sys-0.37.0\sqlite3\sqlite3.h`: `SQLITE_VERSION "3.51.3"`, `SQLITE_SOURCE_ID "2026-03-13 10:38:09 737ae4a34738ffa0c3ff7f9bb18df914dd1cad163f28fd6b6e114a344fe6d618"` | Meets the 3.51.3 floor exactly |

## Deviations from the planned setup

1. **rustup profile `minimal`.** We ran `rustup-init` with `--profile minimal` as well as `--default-toolchain none`, so no docs component is downloaded. The pinned components (clippy, rustfmt, rust-src) still come from `rust-toolchain.toml`. Reason: less disk use and fewer downloads.
2. **pnpm installed into a D: prefix.** We used `npm install -g ... --prefix D:\Toolchains\npm-global --cache D:\Toolchains\npm-cache` instead of the default global prefix, which is `C:\Users\<user>\AppData\Roaming\npm`. Reason: keep toolchains off C:, which had about 6.2 GB free. On this machine the `pnpm` on the machine PATH is the corepack shim in `C:\Program Files\nodejs`. It comes before the user PATH, so a build shell has to put `D:\Toolchains\npm-global` first. We didn't change the persistent PATH for pnpm.
3. **Build-time locations on D:.** Each build shell sets `TMP`/`TEMP` to `D:\Toolchains\tmp`, and pnpm runs with `--store-dir D:\Toolchains\pnpm-store --cache-dir D:\Toolchains\pnpm-cache`. These are per-process settings only. Reason: disk pressure on C:.
4. **`cargo build` rewrites `fork/codex-rs/Cargo.lock`.** At the release tag, `Cargo.toml` sets the workspace version to `0.165.0`, but the committed `Cargo.lock` lists all 167 workspace member crates at `0.0.0`. The upstream release pipeline bumps versions at build time. A plain `cargo build` therefore rewrites those 167 `version = "0.0.0"` lines to `version = "0.165.0"`. No external dependency changes; the diff is exactly those 167 lines. Upstream files must stay unedited, so we discard the rewrite after building (`git checkout -- fork/codex-rs/Cargo.lock`) and don't commit it. `cargo build --locked` would refuse to build for the same reason. Whether to commit a synced lockfile is a later decision.
5. **`cargo build -j 4`.** The first attempt used the default parallelism (16 jobs on this 16-thread, 32 GB host) and failed after 7m44s with `memory allocation of 1048576 bytes failed`. rustc then crashed (`0xc0000409 STATUS_STACK_BUFFER_OVERRUN`), and the dependents of the crashed `codex-core` reported follow-on `E0463 can't find crate` errors. This was resource exhaustion, not a compile error at the cut: the pagefile is on C:, which is nearly full, and other processes were holding memory. A rerun with `-j 4` and no source changes succeeded. Use `-j 4`, or set `CARGO_BUILD_JOBS=4`, on hosts with this memory profile.
6. **Some writes still reached C:.** About 62 MB went into `C:\Users\<user>\AppData\Local\npm-cache`. pnpm runs a nested `npm install` to prepare the git-hosted dependency `@modelcontextprotocol/conformance`, and that npm process doesn't inherit `--cache-dir`. Setting `npm_config_cache` before the install (see setup) should avoid this, but nobody has re-tested it yet. The toolchain itself and the cargo target dir wrote nothing to C:. No `C:\Users\<user>\.cargo` or `.rustup` was created.

## Build verification (AC 1.1.2)

All commands ran on 2026-10-28 on Windows Server 2025 (x86_64-pc-windows-msvc), with Node v24.22.0 and the existing MSVC build tools. No upstream file was patched.

| Step | Command (cwd) | Outcome |
|---|---|---|
| Toolchain selection | `rustc --version` (`fork/codex-rs`) | `rustc 1.99.1 (58cf8f9c3 2026-10-13)`, auto-installed from `rust-toolchain.toml` |
| Rust build, attempt 1 | `cargo build -p codex-cli -p codex-app-server` (`fork/codex-rs`) | Failed with exit 101 after 7m44s: out of memory at 16 jobs (see deviation 5) |
| Rust build, attempt 2 | `cargo build -j 4 -p codex-cli -p codex-app-server` (`fork/codex-rs`) | Exit 0. `Finished dev profile [unoptimized + debuginfo] target(s) in 3m 20s` (incremental on attempt 1) |
| CLI binary | `fork\codex-rs\target\debug\codex.exe --version` | `codex-cli 0.165.0`, exit 0 |
| App-server binary | `fork\codex-rs\target\debug\codex-app-server.exe --help` / `--version` | Help printed, exit 0. `codex-app-server 0.165.0`, exit 0 |
| JS install | `pnpm install --frozen-lockfile --store-dir D:\Toolchains\pnpm-store --cache-dir D:\Toolchains\pnpm-cache` (`fork`) | Exit 0. `Lockfile is up to date, resolution step is skipped`, 549 packages, `Done in 59.2s using pnpm v10.34.5`. The lockfile was honoured unchanged. |
| SDK build | `pnpm --filter @openai/codex-sdk build` (`fork`) | Exit 0. tsup 8.5.0 built `dist/index.js` (16.87 KB) and `dist/index.d.ts` (10.40 KB) |
| TypeScript version | `pnpm --filter @openai/codex-sdk exec tsc --version` (`fork`) | `Version 5.9.2` |
| Upstream untouched | `git rev-parse 5aceac53db54c6f1a4413a7dc909b38b8dfde345:fork` and `git status --porcelain -- fork` after the builds (with `Cargo.lock` restored) | `307e4fa207fe563a11f3f7af09cee6fccd2d8376`, same as the squash commit tree; porcelain output empty |

Build output and disk use:

- The upstream `.gitignore` files cover build output (`target/`, `node_modules/`, `dist/`), and `git status` shows none of it.
- `fork/codex-rs/target` is about 22.5 GB on D:.
- `D:\Toolchains` (rustup, cargo, pnpm store, caches) is about 2.1 GB.
- Free space on C: went from 6,670,249,984 to 6,576,173,056 bytes, a drop of about 94 MB. About 62 MB of that is the nested npm cache (deviation 6). The rest is unrelated system and tooling activity.

AC 1.1.2 status: both binaries build and report a version, and the SDK build exits 0.
