# Docker recovery, 2026-11-06

Docker Desktop was started after the owner approved the pending restart request. Server version 29.9.2 became responsive. No unrelated containers were stopped, removed, or reconfigured; their existing restart policies ran automatically.

The prior --rm Inquello container was absent. The matching labeled volume, exact cached PostgreSQL 18.6 image and private password file remained. Restored only inquello-epic1-verify-20261105-d778fa3f, preserving its volume and loopback-only 127.0.0.1:55318 binding. No image pull. New container ID: 596af27ffa4a0ae93f197ffe5fae2fab55bcb1d69758d886161fac73746e6760. Original ownership receipt was backed up; both current and backup receipt privacy are verified. Authenticated read-only prerequisites returned PostgreSQL18.6, expected fixture database, and CREATEDB permission. Credentials were not printed.

The first recovery script completed database restoration but failed its final backup-privacy assertion. A separate check confirmed the current receipt stayed private and only the newly copied metadata backup needed the existing restrictPrivateFile helper. That was corrected; no container recreation was repeated.

Refreshed current-boot WSL storage proof using the existing checked script, with the previous proof backed up. D-backed 128 GiB guest disk and 4 GiB swap confirmed from live HCS events. New boot ID d3113a9b-7ede-4a87-a9e3-6f1489bcaf8b. Evidence: recovered-storage-proof-20261106.log.

The exact pending two-file integration run resumed at 03:32 UTC, PowerShell PID 28548, using run-policy-fixture-integrations.cjs and the ownership receipt. Log: desktop-full-docker-restored-20261106.log. Inspect process and log before any retry or other Vitest process. Full suite and all18 smoke still pending. No source edits, commits or pushes in this recovery.

Recovered native gates finished before restart: protocol progress4, core progress1, publisher1, question1, app progress47 passed; cargo check passed. All-targets clippy failed on two eprintln! calls in inquello_processor_tests.rs at lines1336 and1359. These are not accepted or waived; repair and rerun remain pending.

## Restored checks and lint correction
The complete two-file integration rerun finished exit0 at03:42UTC:14passed,0failed,0skipped,575.61seconds. Both former sandbox/network failures and resolved-program/alias rules passed with original assertions and time limits.

The two direct stderr prints in the Windows-only native fixture were replaced by scoped tracing test output, using existing tracing dependencies and no lint suppression. All original diagnostic text, assertions, time limits, cleanup and panic behavior remain. Only inquello_processor_tests.rs changed under engine. Validation batch PID27224 runs fmt, all-targets app-server clippy, full166-test Inquello native lib, then default CLI/app-server build, stopping on any failure. Evidence names lintfix-*-20261106.log. No source commit or push yet; inspect batch outcome before further builds/tests.

## Lint verification and checkpoint approval gate
Validation batch27224 completed exit0: formatting, all-targets app-server Clippy,166matching native tests(0failed/ignored;417name-filtered), and standard Windows CLI/app-server build passed. Scoped tracing setup/cleanup diagnostics are present in the native log. FORK-CUT.md has a short uncommitted record of the test-only change.

Auto-review denied the proposed local git commit/amend plus supported protocol-generation chain because explicit user authorization for the commit was missing. The command did not execute; index confirmed empty afterward. Parent asked the owner for approval. Do not retry committing/amending until new approval is received. Do not bypass the generator's dirty-engine guard.

Independent current-source fixture-engine and production desktop builds are running in PID35220, logs lintfix-fixture-build-20261106.log and lintfix-desktop-build-20261106.log. These are candidate checks; committed-tree protocol synchronization remains pending. No push or PR.

## Full candidate suite and corrected policy fixture
The complete115-file execution finished at04:27UTC with2212passed,1failed,22source-conditioned skips(4entire files skipped). The single failure was policy-integration's Full access journey, where the raw runtime effective-policy request returned Private work unavailable. The full file reproduced unchanged:1passed/1failed. New regression then proved the fixture's independent identity reader saw permissive revision1 while the test expected stricter read-only revision2(1failed,2name-filtered).

Corrected only desktop/test/policy-integration.test.ts by binding its existing synthetic stricter-policy overlay to the same SharedServiceClient used by IdentitySession and PolicyService, after the real authenticated membership GET. Added regression verifies the fresh revision and foreign-membership rejection, resetting fixture state in finally. Original assertions and time limits unchanged; no production permission behavior altered. Complete corrected file passes3/3,0skipped,59.76s. Evidence desktop-full-docker-policy-{before,regression-before,after}-20261106.log.

The22skips are pre-existing conditions:14Unix/Linux-only cases,6GNOME-keyring cases,2opt-in diagnostic-only runtime witnesses. They are not counted as passed or silently accepted.

All18-phase seeded smoke is now running using run-docker-verification.cjs smoke complete-candidate-20261106. Full-suite rerun remains after that. Commit approval is still pending. No commit, amendment, push or PR occurred in this recovery.


## Current verification and approval, 2026-11-06
The full seeded smoke completed with 17 of 18 reports passing. Only Composer failed: the initial Task A did not open with its Composer within the existing probe. Later draft assertions cascaded after that early return. Both Tasks opened after sign-out/sign-in. Normal phase passed 15 of 16, quota passed, and visual conversation passed with 5 local synthetic calls and zero invalid calls. All cleanup error lists were empty. Evidence: seeded-smoke-baseline-docker-complete-candidate-20261106.log and D:\Inquello\tmp\inquello-seeded-smoke-vYL7Ga. The cause remains unproven; no assertion or deadline has been weakened.

Full desktop suite rerun is active in PID 14360, direct installed Vitest without file filters. Log: desktop-full-docker-policyfixed-20261106.log. The corrected policy integration file has passed all 3 tests inside this run. Check process and final output before another test process or source edits.

The owner approved the narrow local native-diagnostics checkpoint, then explicitly clarified branch-specific commit and push authorization. Full suite and complete smoke remain required before any push, and the one-PR-per-epic rule remains. No commit or push has yet occurred in this recovery. Once the active suite ends, make the narrow verified engine/FORK-CUT checkpoint, run supported protocol generation, and continue the Composer diagnosis and remaining Linux retained-runtime fixture gate. Do not treat this candidate as acceptance.
