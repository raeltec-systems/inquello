# Merged-/usr executable identity repair, 2026-11-05

Work remains active; not acceptance, no commit/push/PR.

## Reproduction and candidate
Exact installed-runtime regression desktop/scripts/wsl/probe-program-identity.py fails before repair: sandboxed fs/canonicalize returns /usr/bin/curl vs /bin/curl and /usr/bin/dash vs /bin/dash. Log program-identity-before.log; cleanup erased:true. This explains native bare curl unresolved and /bin/sh forbid missing /usr/bin/sh. Both outer guest-broker.py and inner linux-sandbox bwrap.rs independently bind merged-/usr aliases as directories.

Candidate preserves only direct /bin,/sbin,/lib,/lib64 links to their matching /usr target, only when /usr is already readable. No new mount target/read grant or rule shortcut. Rust adds exact-recognition negative tests and mount/deny regression. Two files plus bwrap_tests.rs and new maintained probe. Rustfmt passed, stable warns imports_granularity unavailable. No installed runtime mutation yet.

Native test helper repair in inquello_processor_tests.rs: real WslTasks transition plus ownership-checked erase, cleared Node environment and D-only temp, all three bounded fixture callers retain Linux argv/assertions. Initial missing-folder request alone uses native noop. Test source released before freeze.

Desktop resolved-program fixture now creates exact guest Task alias/trick links through policy-mediated ln and removes them through exact rm in finally before snapshot-based assertions/cleanup. Missing-program path is guest-local. Non-Windows fixture behavior/assertions/180s limit unchanged. This desktop-only fixture edit occurred after guest snapshot; does not affect compiled guest code.

## Active commands
- PID31228: python build-merged-usr.py. Guest snapshot 49332d5a00998439416fd8b2d356c3caad9f4f7191889d4970b220b9b2d8ab98, normalized manifest .tmp/wsl-source-<sha>.json. Frozen source staged through existing digest-checked transport. Offline locked -j4, no incremental/debug, reused owned /opt/inquello/build/offline-20261105-1752/target. Runs full linux-sandbox --lib tests before helper/CLI build. Log merged-usr-guest-build.log. Receipt separate merged-usr-build-receipt.json. No old receipt overwrite.
- PID9608: run-native-merged-usr.ps1. Windows default-target full app-server --lib inquello tests, then standard CLI/app-server build only if tests pass. Offline locked -j4, debug0/incremental0 D-only toolchain/temp. Log merged-usr-native-lib.log and (if reached) merged-usr-native-build.log. These tests still encounter the old installed guest until activation; rerun affected runtime tests after activation.

Check live process/log state before any duplicate commands. Unrelated user processes are preserved.

## Prepared next step, NOT RUN
activate-merged-usr.py reads exact successful build receipt, prechecks source payload hashes, old metadata and quiescence, backs up all old binaries/scripts/manifest to unique D: folder and verifies hashes, then uses exact in-memory adaptation of existing installer. Ownership/modes unchanged, no shared restart/configuration/access change. Rechecks installed hashes/metadata and host receipt. Do not run until guest build succeeds and native guest tests have finished. Recheck storage/preflight independently before activation. Script has not been executed or validated end-to-end. Inspect errors/partial outcomes before retry.

Then actual program identity probe, existing isolation/executor/runtime matrix, full native tests, desktop affected integration witnesses. Full desktop suite and all18 seeded smoke, native retained fixture/protocol/core progress/fmt/check/clippy and supported generation still remain. No broad acceptance claims or skips.

## Recovery continuation
Verified no prior Inquello build/test sessions remained. Windows standard CLI/app-server build finished successfully (merged-usr-native-build.log). Prior native run remains 163 passed, 3 failed against old installed guest.
Final frozen archive 87a50bf6654c32b6eb703e825a40e31f28c734274133f85733201969350c4f41 digest and every manifest file checked against current source (binary raw hashes; normalized text hashes); all match. Corrected Linux regression explicitly tests /usr/bin directory denial and ordering after the /usr bind and /bin symlink. Started build-merged-usr-final.py, Windows PID 28208; inspect live state before retry. Log merged-usr-final-guest-build.log, not the earlier failing merged-usr-guest-build.log. No runtime activation yet.
Fresh live storage observations and guest preflight passed: merged-usr-live-storage-proof.log and merged-usr-guest-preflight.log. Proof boot remains f9f45cea-9ed4-4f9b-b932-c5ad14dbaba7, D-backed capped disk and swap checked against HCS. No shared restart or configuration change. Dedicated distro process initialization did not imply VM boot changed.
Three apparent dirty app-server files (inquello_tasks.rs, thread_lifecycle.rs, thread_processor.rs) still have no substantive diff. Index unchanged. No source edits, download, commit, push or PR in recovery.

## Activated repaired runtime
Final build PID28208 exited0; full Linux sandbox161passed/0failed/0ignored/0filtered, helpers and CLI built offline locked. Full cargo fmt --all --check passed (recovered-fmt-check.log).
activate-merged-usr-final.py PID19348 exited0. Source87a50bf6654c32b6eb703e825a40e31f28c734274133f85733201969350c4f41 installed; exact hashes/ownership/modes and host receipt verified in merged-usr-activation-verified.json. Recoverable backup D:\Inquello\backups\runtime-before-merged-usr-20261105-213345. No shared restart/configuration/access change.
Actual canonical-program identity regression passes with cleanup erased:true (program-identity-after.log). Installed isolation7, executor3 and runtime matrix13 all pass (merged-usr-isolation.log, merged-usr-executor.log, merged-usr-runtime-matrix.log). No model calls.
Native rerun PID1852 uses existing run-native-merged-usr.ps1 with only evidence names changed to merged-usr-after-native-lib.log / merged-usr-after-native-build.log. Standard build follows only if native tests pass. Check process before retry. All broader story acceptance gates still open.

## Local checkpoint, generated protocol, and environment interruption
Native Inquello lib166passed/0failed/0ignored/417name-filtered after repaired activation; standard CLI/app-server build passed. Local-only checkpoint b645a25033 contains exactly six verified resolver/sandbox/probe files. No push. Content-identical engine files were index-refreshed with git add after diff--exit-code checks; no content reverted. Engine clean. Supported generator passed816files, unchanged generated content, engine tree a5596c70ca65c1398ad60211950b24f587970505. Only schema-stamp.json changes. Production desktop build passed; fixture Windows app-server build passed (recovered-production-build.log, recovered-fixture-build.log).
Desktop two-file integrations interrupted by environment: owned PG connections closed at21:46:51UTC; Docker Linux API pipe disappeared, Docker backend and vmmemWSL absent. Logs end21:46:45 with no cause established. Outcome1passed/6failed/7setup-skipped, not acceptance; desktop-full-docker-merged-usr-after.log. No Docker/WSL restart performed. Parent notified; shared Docker launch may auto-start unrelated containers and needs approval/safe scope established. Once restored, validate exact owned PG identity, refresh storage proof for any changed boot, and rerun integrations/full suite/all18smoke.
Windows-only native check batch PID33412 now active: protocol progress, core progress/publisher/question filters, app-server progress tests, cargo check, all-targets clippy; all offline locked-j4. Logs recovered-{protocol-progress,core-progress,core-publisher,core-question,app-progress,native-check,native-clippy}.log. Check live state before duplicate commands. No other build active. Linux retained fixture still outstanding; full desktop/smoke blocked by absent shared Docker.
