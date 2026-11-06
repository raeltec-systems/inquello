# Verified progress and navigation checkpoint, 2026-11-06

This checkpoint preserves the current Epic 1 branch and fixes private-task progress observation and Windows policy/navigation responsiveness. It does not mark Epic 1 complete.

## Changes

- Keep read-only execution-policy observations bounded and independently responsive, while retaining fresh principal, workspace, runtime and revision checks.
- Retry only the precisely identified stale-progress read and coalesce renderer hydration without replaying effects or suppressing current questions.
- Reconstruct usage through observation without mutating task execution state.
- Reuse exact per-task sandbox probes with bounded caching. Navigation reads current policy without eagerly preparing storage or executing sandbox probes.
- Prepare Windows private paths asynchronously with the same protected ACL and post-wait authority checks. Explicit permissions and actual execution retain full admission checks.
- Show policy metadata while sandbox preparation is pending, label unchecked sandbox state truthfully, and fence delayed dialog/navigation replies.
- Correct integration fixture authority binding and guest-path setup without weakening original assertions or deadlines.

## Verification

All product-source hashes were checked unchanged between the complete smoke, desktop suite, native build/test and this checkpoint. No temporary smoke instrumentation remains.

- Production desktop build: passed, including both TypeScript build configurations and data-policy validation.
- Focused policy/navigation regression set: 208 passed, no failures or skips. New responsiveness and stale-dialog regressions were also observed failing before the relevant fixes.
- Full desktop suite: 2,232 passed, zero failures; 22 existing platform/opt-in skips. 116 files passed and 4 files skipped. Duration: 1,117.71 seconds. Skips are disclosed, not counted as passes.
- Complete seeded Electron smoke: all 18 required reports passed. Composer navigation, Permissions and visual conversation passed with original assertions and deadlines. Every phase had clean cleanup.
- Visual fixture: five valid local synthetic calls, zero invalid calls. Live, narrow interrupted/Resume and resumed-conversation captures were inspected and readable.
- Linux source-matched builds: sandbox/CLI and debug inference-fixtures app-server passed offline and locked. No runtime installation or activation.
- Focused retained publication/question/progress fixture: 1 passed, no failures/ignored tests; 12 name-filtered cases. Duration: 13.89 seconds.
- Full Messages retained-runtime target: 13 passed, no failures/ignored/filtered cases. Duration: 88.06 seconds.
- git diff --check: passed. Supported protocol generation and stamp were already synchronized with unchanged engine tree ad6f5f50f420d433730c7f54482236a56ecbb474.

## Evidence identity

- Pre-checkpoint HEAD: bb970352399d693a962d9d9b9c7c5ddcbb24a464.
- Frozen engine/desktop source archive SHA-256: c7cc44396822ac8b3d9a2e6c6436d5fbbb7510aeea5660764c2b56aae24c805d.
- Linux fixture app-server SHA-256: 499a952caa723e3c3de47564f4c7ae97776de8bb21de205653827aa6a5f9861f.
- Local evidence files in this directory: candidate-two-phase-verification-20261106.json, two-phase-final-verification-20261106.json, desktop-full-docker-policy-two-phase-direct-final-20261106.log, seeded-smoke-baseline-docker-policy-two-phase-20261106.log, and retained-runtime-gates-20261106.log.
- Windows synthetic captures: D:\Inquello\tmp\inquello-seeded-smoke-0EK1W1\visual\captures.

## Remaining scope

Real-provider and auditor-usefulness acceptance, tools/connections setup and the other existing Epic 1 gates remain separate. No real credentials, paid inference or real audit records were used. There is no merge, deployment, new dependency, sandbox bypass, test/deadline weakening or automatic story completion in this checkpoint.
