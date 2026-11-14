# Windows baseline, 5 November 2026

Source: feat/epic-1-secure-private-desktop at c407483170e93ad9bea0f2d1c36e9d32693b0c44. Engine/desktop source and lockfiles were unchanged throughout this baseline; preexisting planning/local edits were preserved. Installed WSL runtime still matches its Nov1 receipt, not the current source snapshot.

## Completed builds
- Default Windows CLI/app-server: passed, offline/locked, exact Cargo duration18m09s (engine-build-baseline-retry.log).
- Isolated topology: passed, offline/locked,1m46s (topology-build-baseline.log).
- External inference-fixture app-server: passed, offline/locked,15m38s; D:\Inquello\cache\fixture-20261105 (fixture-build-baseline.log).
- Desktop production build: passed after restoring already-approved locked markdown dependencies (desktop-build-baseline-restored.log). First build failed with missing modules; offline restore could not find their tarballs; frozen-lockfile npm restore succeeded with scripts disabled. No version or lockfile change. Bundle-size warning remains advisory, not suppressed.

## Full desktop suite
Command: pnpm test -- --maxWorkers=1, with local test database and D-backed process TEMP. Exact result: exit1;109 files passed,5 failed,4 skipped (118 total);2139 tests passed,5 failed,32 skipped (2176 total);1265.30s. Log: desktop-full-baseline.log. Run finished naturally; no interrupt executed.

Failures:
1. tool-bounds concurrent inspection:120000ms timeout.
2. tool-bounds standard reads/writes/network:180000ms timeout.
3. tool-bounds listed-destination proxy:120000ms timeout.
4. tool-bounds Full access: Windows PowerShell probe refused as unresolved/no matching command rule under No prompt.
5. permissions integration: resolved-program alias expected command-forbidden but returned ok.

Three suite setup errors (policy,capabilities,identity integration) followed PostgreSQL No space left on device. They account for11 skipped tests. Remaining21 conditional skips: data-operations2,data-import-boundaries3,dev-profile1,onboarding-smoke1,data-inspector-lifecycle7,permissions diagnostic1,quota diagnostic1,providers integration5. Skips are not passing acceptance evidence and must be resolved or explicitly qualified for their actual platform/fixture boundary. No skip/timeout/assertion was introduced or weakened.

Useful bounded passing evidence includes35 identity-session tests,22 sanitized-markdown tests,7 conversation-grouping tests,5 live-conversation tests,2 WSL backend and2 WSL data integration tests. These do not establish full Windows acceptance, current-source guest parity, actual real-provider behavior, or the final seeded smoke.

## Storage incident
PostgreSQL's shared native data directory is on C:. It reported exhaustion during isolated test topology migration. C: was about620MB free at inspection, then recovered to~8.4GB after natural completion, without cleanup. D: had~198GB free. No user database or unrelated process was changed. Root cause of all transient C: allocation is not established. Existing Docker is configured on D:, with cached PostgreSQL18.6; an independent fixture there is being assessed before another run.

## Still pending
Full seeded smoke, actual Windows visual inspection, focused failure reproduction and repair, current-source WSL runtime rebuild/qualification, native platform gates and separately authorized real-provider usefulness checks. No acceptance/status completion, commit, push or PR.


## Docker-backed Windows seeded smoke, completed 15:31 UTC
- Command: owned run-docker-verification.cjs driver with mode smoke and tag electron-restored; exact validated PostgreSQL18.6 container/volume resides in D-backed Docker storage. No shared database touched, no image download.
- Exit1, runtime889.85s. Log: seeded-smoke-baseline-docker-electron-restored.log. Synthetic phase folder: D:\Inquello\tmp\inquello-seeded-smoke-9IekDn.
- Normal phase: unchanged600s Electron deadline; primaryFailure electron-journey; owned cleanupErrors[]. Serial service sign-in sequence places it inside tool-bounds or its cleanup, not permissions/capabilities. Exact inner await remains unmeasured. Exception-path empty reports are not proof that all preceding probes failed or passed.
- Quota: PASS, exit0, expected quota report present, zero synthetic inference calls, runtime clean exit.
- Visual: FAIL, `Completed conversation follow-up did not render`; clean runtime/topology shutdown. Fixture accepted A calls2 and independent B calls1, no invalid calls, both A retained-context validations true. It did not reach held-third-turn Stop/Resume. Initial and failure screenshots were inspected on the actual Windows build; earlier answer and second user request/Running/Stop are present, second answer absent.
- Full18-check smoke therefore fails. No retries replace this baseline, no timeout or assertion was relaxed, and real-provider behavior remains untested.
- Application source/lockfiles were unchanged at this baseline boundary. Later Story1.26 diagnostic/candidate work is separate evidence; no commit or push.
