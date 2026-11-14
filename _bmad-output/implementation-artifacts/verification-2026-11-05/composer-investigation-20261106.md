# Composer navigation investigation, 2026-11-06

## Established evidence
The full desktop candidate suite passed 2,214 tests with no failures and 22 pre-existing platform/opt-in skips (115 executed files, 4 skipped files). Evidence: desktop-full-docker-policyfixed-20261106.log. This preceded the sandbox-probe cache change below, so a new full run is still required.

Three complete seeded smoke runs each passed 17 of 18 reports. Only Composer failed; quota and visual conversation passed, and every cleanup error list was empty. First two smoke-only runtimes were 613.52 and 627.05 seconds. The third enclosing process was 643.49 seconds including its preceding 30-test/build checks. Logs: seeded-smoke-baseline-docker-{complete-candidate,composer-diagnostics,composer-latency}-20261106.log.

The first failure did not retain per-step timings. Later diagnostic probes preserve every assertion and the original five-second navigation deadline. Task links were present and clicked, but a requested navigation did not finish before that deadline. The most detailed run recorded a successful native/main reopen response after 7,033 ms. Fresh service and context authority reads generally took 30–50 ms. Separate main event-loop stalls were also observed (roughly 0.6–1.7 seconds), consistent with synchronous Windows path/ACL work; their individual call sites have not been proved. Do not claim that all delay was caused by service access or ACL calls.

The native protocol places task reopen and tools/exec in the same global Inquello serialization queue. The existing Windows sandbox probe cache held only the last Task/policy/profile key. Consequently A → B → A and interleaved pending A/B/A reads dispatch redundant probes. The new focused regression reproduces that deterministically; the probe-cache defect is established, while its contribution to the complete smoke failure must still be verified by the controlled rerun.

## Current candidate
Only the additional probe-cache portion of desktop/src/main/policy/service.ts is new in this investigation; preserve that file's earlier Story 1.26 changes. The candidate retains at most 32 exact probe promises, scoped to principal, Task, current policy and runtime profile, and clears them when runtime identity changes. It preserves taskContext's fresh authority and transfer checks. The last observed probe remains the Capability Contract source. No native serialization, permission, execution or timeout rule was changed.

New desktop/test/policy-sandbox-cache.test.ts is a synthetic Windows-backend unit harness, not OS-isolation evidence. Before the fix: 4 failed / 2 passed. After: all 6 pass, including pending exact-probe reuse, runtime/policy/principal invalidation, fresh-authority refusals, signed-out state, interrupted transfers and bounded eviction. Together with policy, permissions, tool-bounds and Composer regressions: 118 passed / 0 failed / 0 skipped. Desktop production build passed. Evidence: policy-sandbox-cache-{before,after,build}-20261106.log.

Scoped diagnostic wrappers in smoke-probe.ts record only stage names, elapsed times, outcomes and event-loop lag. No credentials, response bodies or draft contents are captured. They restore original methods and clear their timer in finally. The first timing build failed because the identity wiring requires identity.session.withAccess; this was corrected. Later build and 30 focused tests passed. The simpler DOM timing evidence remains useful; remove temporary method wrappers after diagnosis and rerun the final checks.

## Active run and remaining gates
Full smoke after the cache fix is active in PowerShell PID 2200, started about 05:53 UTC. Log: seeded-smoke-baseline-docker-sandbox-cache-after-20261106.log. Inspect outcome before another smoke/test process or modifying the candidate. All owned database and guest fixtures remain as described in docker-recovery-20261106.md.

Approved local checkpoint bb97035239 contains the native tracing test fix, its FORK-CUT note and supported generated schema stamp. Engine tree ad6f5f50f420d433730c7f54482236a56ecbb474; generation produced 816 files with unchanged generated content. No push or PR.

Remaining: resolve Composer with unchanged criteria; remove temporary diagnostic wrappers and rebuild; run Linux retained-runtime fixture, the final complete desktop suite, and all 18 smoke reports. The prepared run-retained-runtime-20261106.py has not been executed. It freezes/stages current sources and builds/tests offline in the existing owned guest target without installation or runtime activation. Verify its commands and disk headroom before running. Do not mark Story 1.26 or Epic 1 complete on the current evidence.


## 2026-11-06 asynchronous ACL follow-up

The cache candidate full smoke completed in 641.82 seconds with 16 of 18 reports passing. Composer first navigation timed out after 5,038 ms; main recorded a 1,433 ms event-loop stall before a 4,598 ms reopen. The new policy failure was also renderer readiness: the Permissions dialog contained only its title at the deadline, while the independent backend thread settings remained bounded Standard and Full access was correctly refused. Both failures remain open pending rerun.

The Windows private-directory helper synchronously spawned PowerShell three times for every Task policy read. Added an asynchronous helper using the exact same protected DACL (current user, SYSTEM and Administrators). The batched form creates and protects each parent before creating its child, and checks redirected ancestors again inside PowerShell after the asynchronous boundary. Task context checks principal and runtime immediately after folder preparation and before further runtime requests. Existing synchronous APIs remain available for other callers.

The responsiveness regression failed against the synchronous negative control (one failure, five passes). The initial three-process async version passed actual ACL/responsiveness tests but exposed the existing one-second permission-harness readiness deadline. Rather than altering that deadline, the three protections were batched into one async process. All 119 tests across seven affected files then passed, no failures or skips, in 41.18 seconds. The complete desktop production build passed. Logs: private-paths-async-before-20261106.log, private-paths-async-after-20261106.log, private-paths-async-batched-20261106.log, private-paths-async-build-20261106.log.

Current full smoke: run-docker-verification.cjs smoke async-acl-after-20261106, PID 14812. No concurrent builds/tests during smoke. Temporary main-process Composer timing wrappers remain for diagnosis and must be removed before final verification. No push or PR has occurred.


## 2026-11-06 read-only navigation policy candidate
- Stage diagnostic smoke completed with 16/18 reports; Composer and visual-conversation failed. Normal phase completed (no deadline failure); quota passed. Log: seeded-smoke-baseline-docker-policy-stages-20261106.log.
- Timing isolated eager Task storage preparation and sandbox probing on navigation. One policy read took 13.481 s (Task context 5.689 s including WSL transition 4.036 s, then sandbox probe 7.792 s); previous read took 25.986 s. Native task/reopen and tools/exec share the global Inquello queue. No assertion or deadline was changed.
- Candidate adds read-only PolicyService.inspectTask and a strictly validated optional inspectionOnly:true metadata request. It still fetches current authority/effective policy, reports sandbox not-checked truthfully, and does not create Task folders, transfer storage, or run a probe. Explicit Permissions and execution retain full checks. Shell sequence guard prevents stale inspection overwriting a newer dialog read.
- All temporary smoke instrumentation restored to the original backup before this candidate verification.
- Initial focused tests: 206 passed; build caught missing main routing adapter, corrected before smoke. Final focused checks/build queued, then unchanged full smoke. No push.
- Invariants: inspection cannot admit tools or alter authority; fresh policy required on every read; actual execution retains storage/transfer/sandbox checks; stale renderer replies cannot replace newer policy. Focused finite race/negative tests are used rather than a formal proof, with real Electron smoke as integration evidence.
