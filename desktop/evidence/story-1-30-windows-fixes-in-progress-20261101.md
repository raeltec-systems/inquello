# Story 1.30 Windows fixes: work in progress

Story 1.30 and Epic 1 remain in progress. This records local, uncommitted work
following `71c7e2506dcc934a8826a2be85e9a90eb1a1b61b`; it is not acceptance
or negative-authorization evidence.

## Findings and changes

- Corrected protocol declarations and the resulting Rust compile failures,
  including explicit denial of unsupported Inquello authority requests in
  CLI/TUI clients. Fixture-only protocol support remains debug-feature gated.
- Fixed Windows path and line-ending assumptions, SQLx test query construction,
  and outdated fictional authority fixtures. The authority-fence tests now
  stub the native inspection response explicitly and retain the authorization
  assertions; they are not native inspector evidence.
- Made quiescent SQLite inspection tolerate the empty WAL/SHM family SQLite
  can create when opening a checkpointed database on Windows. Existing WALs
  remain subject to before/after comparison; new nonempty WALs are refused.
  Snapshot comparison cannot prove atomicity against transient external changes,
  and active WAL inspection may fail closed if SQLite changes SHM read marks.
- Replaced a retired public approval-policy override with the corresponding
  typed `UnlessTrusted` value, preserving the constrained policy.
- The POSIX mode assertions are conditional on non-Windows platforms; Windows
  ACL protection has not been verified. A Linux-only missing-keyring test is
  skipped on Windows: its D-Bus isolation does not isolate Credential Manager.
  Before that correction, the test created one synthetic test-key entry in
  Credential Manager; that matching entry was removed. No live credential or
  provider call was used.

## Verification and outstanding work

Follow-up fixes on 2026-11-01:

- Windows private-path handling now uses protected DACLs for the identity and
  provider vaults, runtime configuration, working-store directory and Task
  directories. Redirected ancestors and hard-linked private files are refused.
  Independent ACL inspection verifies both the allowed principals and that an
  added broad grant is detected and removed. Identity/provider smoke checks now
  inspect ACLs on Windows rather than treating POSIX mode bits as evidence.
- Electron cache, session, crash dumps, logs and temp paths are configured on
  D: before ready; smoke uses its own D: profile. A real filesystem test verifies
  all configured directories and child temp variables. Existing durable user
  profiles and keyring identities are preserved.
- These fixes pass 174 tests across five files, without skips
  (`private-paths-final.log`), plus both desktop storage tests
  (`desktop-storage.log`). Desktop build passes (`acl-storage-build.log`).
- Both native-to-main authorization callbacks are now wired in the older
  integration harnesses. Wiring context authorization alone was insufficient:
  task creation also asks for current Workspace policy.
- Organisation integration passes 7/7 with current-access denial when the
  service is unavailable. Draft movement no longer uses a fabricated thread ID;
  retained-thread binding/movement still requires native lifecycle witnesses.
- The sandbox log register now conservatively marks logs as potentially
  credential-bearing and excludes them from exports. Inquello sets an explicit
  retention environment value; the Windows log writer honors the existing
  until-owner-deletes policy instead of automatically pruning at 90 files.
  Register/environment unit checks pass (48/48 with organisation units).
  Rebuilt native logging and data round-trip verification remain pending.
- Desktop build passes after these changes. The WSL backend is being reconciled
  from the preserved recovery branch; no end-to-end isolation pass is claimed.
- A real mutation-before-rejection defect was found in generic thread
  attachment. The native endpoint now refuses caller-supplied bindings before
  mutation; Task start retains its separate journal-controlled binding path.
  A native regression is authored but still awaits the next build/test pass.
  The desktop organisation smoke now expects refusal and an unchanged draft;
  its main TypeScript check passes, but the Electron smoke has not run.
- Current-boot WSL disk/swap evidence was resealed from Hyper-V attachment
  events and guest SCSI identity. Seven real guest isolation probes pass;
  managed proxy, transfer, complete Task and navigation gates remain pending.

The historical results below describe their specific snapshots and are not a
claim that all checks pass on the continuing worktree.

- The default CLI and app-server build passed after the final typed-policy and
  fixture changes (`fix-default-after-policy.log`; offline, locked).
- Rust domain: 162 passed. Rust adapters: 110 passed, including the originally
  failing provenance cases and snapshot tests.
- Affected desktop tests: 7 files, 382 passed, 2 skipped on the latest run.
  TypeScript and desktop build passed earlier in this work.
- Latest full desktop run against the rebuilt default runtime: 1,540 passed,
  20 failed, 18 skipped (65 files passed, six failed, two skipped;
  `fix-full-current.log`). Three data-integration failures involve the
  quarantined log and one concerns the stale protocol stamp. The remaining
  failures are in organise, permissions, policy and tool-bounds integration;
  many report task-creation failures and one has a changed reviewer label.
  Their individual causes have not all been determined. A follow-up adding
  the production context callback to these four test harnesses still had
  16 failures and three passes (`fix-context-integration.log`); that unproven
  test adjustment was removed. Route integration
  separately passed 7/7 after correcting its fictional fixtures.
- The Windows sandbox writes command previews and error details into a log
  that is not classified by the data register. Its sensitivity, retention and
  export policy remain unresolved. It stays quarantined; tests with a temporary
  classification were not counted as passes for the current tree.
- The supported protocol generator refuses an uncommitted engine tree. Its
  generated bindings and tree stamp are stale; do not hand-edit them.
- The navigation driver selected and ran all 14 witnesses, but none passed the
  positive control. After fixing fixture configuration, a representative
  witness reached private thread creation and failed closed: the Windows
  restricted-token sandbox cannot enforce split filesystem read restrictions.
  No search/reopen or negative-authorization witness is proven. Strict folder
  isolation must not be bypassed; a supported isolated backend remains needed.
- `cargo fmt --all -- --check` fails on formatting differences across 119 files,
  including pre-existing fork code. A wholesale reformat was not applied.
- Windows/Electron acceptance, Windows ACL behavior, the full desktop suite,
  regenerated protocol, and cumulative Epic 1 acceptance remain unverified.

Raw local logs are under `D:/Projects/inquello/.tmp/story130-checks/`.
