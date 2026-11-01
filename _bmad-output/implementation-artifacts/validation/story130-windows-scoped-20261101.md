# Story 1.30 — scoped Windows validation, 2026-11-01

The owner narrowed this continuation to blockers for the reviewed Story 1.30
candidate and authorized committing and pushing the existing epic branch.
This record supersedes earlier claims that the fourteen navigation witnesses
were unexecuted only where the results below provide actual execution evidence.
It does not accept Epic 1 or promote real-data eligibility.

## Scope and fixes

- Preserved the previously authorized Windows/WSL prerequisite work. No further
  guest rebuild, shared WSL restart, broad sandbox certification, full epic smoke,
  unrelated plugin suite or full desktop suite is part of this continuation.
- Retained-progress revision reads now supply the required update watermark,
  preserving update ordering and the bounded revision query.
- The Messages bridge emits a message item before its text deltas; completed
  blocks retain their ordering. Private one-shot tool schema selection and
  provider-default tier handling match the guarded execution contract.
- Concurrent Stop fixtures require an interrupted receipt from either caller,
  stable operation bindings, and an identical confirmed replay. Submission alone
  never counts as confirmed interruption.
- Legacy fixtures convert their actual retained paginated message events into
  legacy message events as well as updating the header/indexed mode. The former
  header-only conversion described a format the legacy reader does not consume.
- The deliberate admission-timeout fixture holds an already-running, validated
  guest until scoped cleanup. The bounded test keepalive cannot boot an inactive
  guest and does not grant Task authority.
- `run-seeded-smoke.cjs --navigation` selects real saved-navigation and layout
  probes without claiming the sixteen-report epic suite passed.
- The actual Electron journey exposed navigation saves waiting for unrelated
  sandbox inspection. Pin/archive now await the freshly authorized navigation
  tree without restarting inspection. The regression holds inspection unresolved
  and proves both changes complete, including removal from the Sidebar.

## Execution environment and commands

Windows, Rust 1.99.1, locked dependencies, one Cargo build job. TEMP/TMP/TMPDIR,
Cargo/Rustup homes, Electron profiles and caches remain on D:. The local fixture
database and fictional HTTPS service are used; no paid provider calls occur.

Native witness build:

```text
cargo test --config profile.test.package.codex-core.debug=0 --locked --offline -j1 -p codex-app-server --features inference-fixtures --test inquello_authorization_runtime --no-run
```

The built `inquello_authorization_runtime` executable is listed with
`search_ --list`; the maintained `run-navigation-native.cjs::verifySelection`
requires all fourteen names. It is executed with `search_ --nocapture
--test-threads=1` and `INQUELLO_FIXTURE_APP_SERVER_BIN` pointing to a copied,
matching debug fixture server so subsequent linking cannot lock the running
Windows executable. Test-only corrections are rerun by their affected selectors.

Matching CLI/runtime development build:

```text
cargo build --config profile.dev.package.codex-core.debug=0 --locked --offline -j1 -p codex-cli -p codex-app-server --features codex-app-server/inference-fixtures
```

This is a development fixture build, not release/package certification.
Protocol generation uses the supported `pnpm run generate:protocol` after a
clean native commit; generated files are never edited by hand.

## Results

All scoped gates below passed. Local logs are in
`D:/Projects/inquello/.tmp/story130-checks/`.

| Check | Measured result |
|---|---|
| Native fixture build | Exit 0; `navigation-final-build.log` |
| CLI and app-server build | Exit 0; `navigation-cli-build.log` |
| Rust formatting | Whole-workspace check passed before the final fixture edits; app-server formatting/check covers those subsequent edits |
| Native selection | All 14 required names selected; zero ignored cases |
| Native execution | Initial run: 10 passed / 4 failed. After correcting only the affected fixtures: both old-turn cases passed (2/2), both admission-timeout cases passed (2/2). All 14 distinct witnesses have passing execution evidence; this is an aggregate, not a fabricated single 14/14 run |
| Protocol generation | Exit 0; 816 files, engine tree `dc92ce78a16633deac77c99e9fe942557e9574b5`; generated content unchanged, stamp updated |
| Desktop typechecks/build | Both build and renderer TypeScript checks plus Vite build passed |
| Focused desktop and schema | 13 files / 417 tests passed; `navigation-focused-final.log` |
| Final navigation regression | Unresolved sandbox inspection regression passed; after the Shell fix, all 3 affected suites / 74 tests passed in `navigation-shell-final.log` |
| Actual Windows Electron | Exit 0, both required reports passed, no missing reports; `navigation-electron-final-4.log` |
| Diff whitespace | `git diff --check` passed |

Electron used the actual named bridges, native store and fictional HTTPS service.
It passed real Task menu pin/archive, native runtime restart persistence without
creating a model thread, separate Ctrl+K/Cmd+K and Escape checks, explicit archived
filter, fresh reopen/unarchive without provider credentials, sign-out disclosure
denial, responsive rail/minimum-width layout and theme checks. Initial focused
smoke failures are retained: missing fictional invitation setup, then the
navigation/inspection dependency corrected above. They are not counted as passes.

Full raw logs are retained locally rather than committing large RPC transcripts.
SHA-256 evidence identities:

```text
navigation-final-native.log 6c7efd02e3096997ff6ab9f0ce182e6a2fed6812ae97fad58af7634ce46bb164
navigation-old-turn-final.log 7886c54e96f8b37182e11f74c1d18312fc7af73614955e5b363961756e540fc5
navigation-admission-final.log 251fd24b65c571821feb003bbe0e04ff84ec0a51d1f886a9eeea748500bb5539
navigation-focused-final.log a83fac0aaf280333fc9e90e1cf4fe8d296f0f12dff8d5b75aaed5682c8fc5878
navigation-shell-final.log 8d800adf0b336b7bd8e6a6bfdf14bbde19481ad56f9bb05d3be78b0b373a265b
navigation-electron-final-4.log fe11a19d53e9b20f4adb0223a91c6c5613f785530dbd67adad37c4410f7c0a1a
```

## Remaining gates outside this scoped pass

- Cumulative Epic 1 owner acceptance, full manual Windows audit journey, IME
  behavior and live genuine-question usefulness remain separate from automated
  renderer/native fixtures. Live provider calls were not authorized or made.
- No complete current-tree full desktop suite, sixty-case native lifecycle
  matrix, sixteen-report epic smoke, release build, or freshly rebuilt exact-tree
  guest certification is claimed. Earlier results remain historical evidence.
- The installed guest receipt predates the final host changes. Existing isolation
  gates remain closed where they require a fresh exact-build receipt; search
  fixture success is not production eligibility.
- Previously rejected temporary-file cleanup was not retried. Retained fictional
  fixture directories remain on D:; user work and unrelated untracked files are
  preserved.
