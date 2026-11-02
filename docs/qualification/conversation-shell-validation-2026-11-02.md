# Conversation shell qualification — 2 November 2026

## Verified scope

The approved conversation shell at `9f62bbccc6eb5de57f86e92bebb398a605ed9906` completed an actual Electron journey against the existing native runtime and pinned, local synthetic transport. This is not live-provider acceptance or complete Epic acceptance.

- Initial Send and completed assistant answer.
- Follow-up in the retained conversation and completed answer.
- Visible streaming, explicit Stop, native cancellation, and Resume availability.
- Reader scroll-up preservation and explicit Jump to latest, with real overflow established at a smaller viewport.
- Reopen the saved conversation, explicitly Resume, and observe the completed answer.
- Four synthetic transport calls; zero invalid calls; all context checks matched; held response cancelled and not timed out.
- Fourteen actual Electron captures. Narrow reader-Jump and resumed-answer pixels inspected.
- Native exit code 0, not killed; fixture cleanup errors empty. No paid calls, real credentials or user-profile changes.

## Timing and test preconditions

An earlier exact-baseline observation missed the former 20-second first-acceptance threshold: acceptance occurred at **20,688 ms**, then the first answer completed. That failure is retained, not reclassified as a performance pass.

The functional first-start witness now permits at most 60 seconds while separately recording the 20-second expectation. This accommodates measured Windows isolation setup without changing native deadlines, authority checks, sandboxing or later journey gates. The passing current-shell run recorded **19,267 ms**, with both observations true. This is one sample, not a latency guarantee.

An intermediate scroll test incorrectly required a Jump button when the short retained transcript fitted entirely within the large viewport. The corrected test first establishes actual overflow at 900×700, verifies reader intent and Jump, then restores 1920×1200 before reopening. Product scrolling code was not changed to satisfy this test.

The fictional visual workspace is now named **Mupeta & Partners**. Synthetic issuer, transport and data classification remain unchanged.

## Reproducible local evidence

- Native engine tree: `4846abe8470db3c1ae45e26d71ad05980a41b348`.
- Runtime SHA-256: `57f5478c0624c4305de517c66a3541463a19d3b327c6f455b23db1148c3392c4`.
- Main typecheck and build passed; launcher syntax check passed.
- Passing launcher: `.tmp/shell-same-app-update-20261102-1032/validation-v7.status` and `visual-v7.log`.
- Fixture evidence: `.tmp/inquello-seeded-smoke-Pcnk1w/visual/`, including `smoke.stdout.log`, `synthetic-journey-state.json` and `captures/`.
- Earlier diagnostic: `.tmp/shell-ab-7f-20261102/observe60.status`; original scratch probe restored and original product hashes unchanged.

## Remaining distinctions

Real-provider onboarding and the simplified model-name picker remain separate work. Existing technical route settings shown in these captures are not the approved final auditor experience. Interrupted, uncommitted assistant fragments may disappear after Stop; retained prompts and completed answers were the durability assertions. No Auth0 organisation migration, paid model test or release was performed. Hosted Actions were not used as a gate; local checks and CodeRabbit review remain the agreed workflow.

## Follow-up reproduction contract

This UI-only evidence is pinned to commit `a38f13aa42d023d492fa44a760dfa4e5f5aaa74a` and its four-dispatch Messages fixture. Run the reproduction commands against that checkpoint. Later model-binding work has a separate five-dispatch Responses A/B journey and separate qualification evidence; it does not retroactively change the observations below.

The approved follow-up starts from `34706d5bf65da344b010ad11d4bd625cf2cfd3d7` and integrates the 20 files in the handoff manifest after rechecking each candidate SHA-256 and each normalized baseline Git blob. It changes the default navigation to 320px (64px rail plus 256px history), permits bounded resizing, removes duplicate branding, and adds the organization/team menu, confirmed signout and committed provider-control focus. The synthetic probe retains the full conversation journey and real-overflow/one-composer/menu bounds assertions.

The startup observation uses `performance.now()` immediately before the actual Send click. Every observed Task is checked against that same origin **after** reading it. An observation at 20,001ms fails the performance expectation; one at 60,001ms also fails the functional gate and cannot return an accepted Task. The functional gate remains 60 seconds and the performance expectation remains 20 seconds. Earlier failure observations above remain failures.

Prerequisites are the already-installed Rust 1.99.1 Windows toolchain, Node 24, pnpm 10.34.5, installed desktop dependencies/Electron and OpenSSL on PATH. The existing synthetic PostgreSQL 18 admin connection is supplied through `INQUELLO_TEST_DATABASE_URL` (or `INQUELLO_DEV_DATABASE_URL`) with CREATEDB permission; its value is deliberately excluded here. The tracked topology implementation, `engine/codex-rs/inquello-service/src/bin/inquello-dev-topology.rs`, creates a fresh database and drops only its owned run database on stdin EOF. No real pilot profile is used.

On this workstation `.tmp/story121-env.ps1` supplies that connection, workspace-contained TEMP/TMP/TMPDIR, and the installed Rust/Cargo homes at `D:\Toolchains\rustup` and `D:\Toolchains\cargo`. Reproduce from the repository root in PowerShell using that existing local environment; on another workstation supply equivalent installed-toolchain and synthetic-database settings first:

The workspace-contained temporary root holds the launcher's evidence and fixtures. Baseline Windows main-process behavior additionally gives each smoke launch a fresh disposable `D:\Inquello\tmp\inquello-smoke-<UUID>` Electron profile/runtime home. That existing storage topology is preserved; it is distinct from the real `inquello-auth0-pilot-20261102` profile and never resumes or resets it.

For reproduction without that untracked workstation script, set these equivalent non-secret values from the repository root, and separately supply the existing synthetic PostgreSQL admin connection through one of the two database variables above. The connection must target a test database, not a production database. Toolchain paths may be adjusted to an already-installed equivalent; do not install a missing toolchain as part of this run.

```powershell
$env:TEMP = Join-Path (Get-Location) '.tmp'
$env:TMP = $env:TEMP
$env:TMPDIR = $env:TEMP
$env:RUSTUP_HOME = 'D:\Toolchains\rustup'
$env:CARGO_HOME = 'D:\Toolchains\cargo'
$env:RUSTUP_TOOLCHAIN = '1.99.1-x86_64-pc-windows-msvc'
$env:CARGO_INCREMENTAL = '0'
```

```powershell
$ErrorActionPreference = 'Stop'
if (Test-Path .\.tmp\story121-env.ps1) { . .\.tmp\story121-env.ps1 }
if ($env:INQUELLO_TEST_DATABASE_URL -and $env:INQUELLO_DEV_DATABASE_URL) { throw 'Ambiguous database configuration: explicitly clear the unused database variable before running synthetic checks.' }
if (-not ($env:INQUELLO_TEST_DATABASE_URL -or $env:INQUELLO_DEV_DATABASE_URL)) { throw 'Supply exactly one existing synthetic PostgreSQL admin connection first.' }
if (-not ($env:RUSTUP_HOME -and $env:CARGO_HOME -and $env:RUSTUP_TOOLCHAIN)) { throw 'Supply the already-installed Rust toolchain environment first.' }
if (-not (Test-Path (Join-Path $env:RUSTUP_HOME "toolchains/$env:RUSTUP_TOOLCHAIN/bin/rustc.exe"))) { throw 'The required installed toolchain is missing; stop without installing it.' }
$env:RUSTUP_AUTO_INSTALL = '0'
$env:COREPACK_ENABLE_NETWORK = '0'
$env:PATH = 'C:\Program Files\Git\usr\bin;' + $env:PATH
Set-Location engine\codex-rs
cargo build --offline -j 4 -p codex-cli -p codex-app-server
# Existing fixture feature and topology, from the same unchanged engine tree:
cargo build --locked --offline -j 1 --config profile.dev.package.codex-core.debug=0 -p codex-cli -p codex-app-server --features codex-app-server/inference-fixtures
cargo build --locked --offline -j 4 -p inquello-service --bin inquello-dev-topology --features test-issuer
Set-Location ..\..\desktop
pnpm run build
pnpm exec vitest run --configLoader runner --maxWorkers=1 test/organise-shell.test.tsx test/settings-route.test.tsx test/shell-layout.test.tsx test/shell-refinement.test.tsx test/sidebar-followup.test.tsx test/design.test.ts test/conversation-presentation.test.tsx test/conversation-follow.test.tsx test/providers-block.test.tsx test/tasks-start.test.tsx test/tasks-lifecycle-shell.test.tsx test/smoke-startup.test.ts test/composer.test.tsx
Set-Location ..
$env:INQUELLO_APP_SERVER = Join-Path (Get-Location) 'engine/codex-rs/target/debug/codex-app-server.exe'
$env:INQUELLO_CODEX_CLI = Join-Path (Get-Location) 'engine/codex-rs/target/debug/codex.exe'
$env:INQUELLO_DEV_TOPOLOGY_BIN = Join-Path (Get-Location) 'engine/codex-rs/target/debug/inquello-dev-topology.exe'
node desktop/scripts/run-seeded-smoke.cjs --visual-only
```

Check each command's exit code before continuing. On Windows, the smoke launcher needs access to `Get-CimInstance Win32_Process` to establish and clean up the exact owned Electron process tree. Keep that guard enabled. The launcher prints its fresh workspace-contained evidence directory; inspect `visual/smoke.stdout.log`, `visual/smoke.stderr.log`, `visual/synthetic-journey-state.json`, and `visual/captures/manifest.json` plus the actual PNGs.

Fixture configuration is authored by tracked `desktop/scripts/run-seeded-smoke.cjs`: fictional workspace **Mupeta & Partners**, fresh scoped TLS CA/certificate, a pinned HTTPS endpoint at `127.0.0.1:<ephemeral port>/v1/messages`, three fixed fictional user prompts and four fixed assistant answers explicitly labelled synthetic. Request three holds its SSE response until native Stop; request four is allowed only after cancellation and explicit Resume. All requests must contain their expected retained context. The launcher requires four calls, zero invalid calls, all context matches true, held cancellation true, no held timeout, successful version handshake, a clean native exit and empty owned cleanup errors. The probe also checks 320px expanded navigation, the 64px rail, bounded footer menu, exactly one visible composer, the draft at the 544px minimum width, the 700px collapsed conversation and actual overflow before Jump at 900×700.

An initial native-build attempt used the default Rust home and failed sandbox access. Its elevated retry unexpectedly invoked rustup toolchain bootstrap/component downloads despite Cargo's `--offline`; it was immediately interrupted. We cannot claim that zero bytes were downloaded. No installation was allowed to continue. Subsequent build commands use the existing installed toolchain homes with `RUSTUP_AUTO_INSTALL=0` and Cargo `--offline`; no package installation is part of this qualification.

## Follow-up final results and inspectable evidence

Final evidence is summarized in [the sanitized qualification JSON](conversation-shell-followup-2026-11-02.json), including matched binary hashes, actual geometry, all 15 capture hashes and earlier unsuccessful observations. Four unedited fictional Electron captures are checked in for inspection: [home](conversation-shell-followup-2026-11-02/home.png), [organization/team menu](conversation-shell-followup-2026-11-02/organization-menu.png), [readable 900×700 composer](conversation-shell-followup-2026-11-02/readable-composer-900x700.png), and [completed explicit Resume](conversation-shell-followup-2026-11-02/resumed.png). Full local evidence is retained in `.tmp/inquello-seeded-smoke-sjqVr9/visual/` and can be regenerated with the commands above.

| Check | Final result |
| --- | --- |
| Required offline native CLI/app-server rebuild | PASS, 7m39s |
| Matched fixture-feature runtime and topology rebuilds | PASS, 8m00s and 13.12s; same unchanged engine tree and protocol version |
| Desktop build after final changes | PASS: main/renderer types, 21-category data policy and Vite |
| Full spec suite plus existing composer interactions | PASS, 289 tests in 13 files |
| After final probe refinement | PASS, 81 tests in shell-layout, conversation-follow, composer and smoke-startup |
| Actual full conversation journey | PASS: Send, completed follow-up, streaming, native Stop, reader preservation/Jump, reopen and explicit Resume |
| Transport/context and cleanup | Four local synthetic calls; zero invalid/live calls; four true context checks; held response cancelled, no timeout; native exit 0/not killed; cleanup errors empty |
| Final startup sample | 18,120.3ms; 20-second observation true and 60-second functional gate true |

Pixel review found and corrected a responsive regression: at 900px, the new 320px navigation leaves full history visible, and the composer actions could squeeze the `width:0` flex input nearly to zero. The input now has a readable flex basis and the composer wraps by available column width. The wide 1920px home remains inline: input **588.4×22px**, composer **960×64px**. The exact 544px home retains the three-line draft in a **414.4×65px** input. The saved Task at 900×700 has a **514.4×22px** input in a compact **548×89.6px** composer. Each actual geometry assertion requires one visible input, containment, no page overflow and a usable input width/height.

The Windows exact-minimum assertion initially failed because the native frame at 125% scaling rounds the viewport up by two CSS pixels. The visual callback now reuses the canonical layout probe's smoke-only temporary minimum-size release and restoration; the exact **544px** assertion is retained. No production window constraint or profile selection changed.

The reader witness now waits for the resized layout, then measures the same `.iq-task-progress` bottom-derived target that the presentation hook follows, alongside total thread overflow. It requires genuine conversation distance and an established live-edge position before moving upward. In the final 900×700 sample the thread height was **430px**, total overflow **328px**, conversation target **204.6px**, and initial scroll **204.8px**. The reader stayed at **0px** until explicit Jump; the latest retained prompt then became visible. The conditional 900×600 fallback was **not used**. It exists only when the conversation itself fits at 900×700; it retains the same distance, reader-preservation and Jump assertions in a readable viewport.

Earlier follow-up evidence is retained and is not reclassified by the final pass:

| Local root | Observation | Local calls / cleanup |
| --- | --- | --- |
| `inquello-seeded-smoke-DoNxjW` | Failed exact-minimum probe before the Windows DPI handling was reused | 0; native exit 0, clean cleanup |
| `inquello-seeded-smoke-9pcTWq` | Functional journey passed, but pixel review rejected the collapsed 900px input; startup 28,296.1ms missed 20 seconds | 4; native exit 0, clean cleanup |
| `inquello-seeded-smoke-DWpe0q` | Original completed-follow-up gate failed while dispatching, with no second transport/answer witness; startup 22,225.5ms missed 20 seconds | 1; native exit 0, clean cleanup |
| `inquello-seeded-smoke-pI17NR` | Follow-up and native Stop passed; reader/Jump probe failed before explicit resize/target preconditions; startup 20,001.3ms missed 20 seconds | 3; native exit 0, clean cleanup |

No later inference deadline was extended. The final startup pass is one sample, not a latency guarantee; the earlier follow-up timeout remains a qualification limit. Existing compiler/Vite warnings remain. Live-provider acceptance, simplified model selection and the broader Epic gates remain separate work.
