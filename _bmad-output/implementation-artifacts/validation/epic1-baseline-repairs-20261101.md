# Epic 1 baseline and validation repairs — 2026-11-01
Owner approved moving from validation into fixes, prioritizing the familiar conversational baseline. This repairs the existing Story1.25/1.26/1.29/1.30 behavior; it is not approval for broad redesign, release, live inference or real-data enablement.

## Approved repair scope
- Explicit ordinary follow-up on the same completed conversation using the existing freshly authorized retained continuation path; no blank/automatic restart, replacement thread or permission widening.
- Fix duplicate lifecycle claim cleanup so a losing caller cannot overwrite a dispatched/terminal receipt.
- Correct the native admission-timeout witness's correlation to its target operation without relaxing the actual two-second deadline.
- Restore authorized progress publications into indexed retained history and allow bounded non-effect publications alongside one-shot evidence commands.
- Diagnose remaining native policy/cache and Electron journeys; fix product defects separately from harness sequencing.
- Resolve strict adapter lint findings while retaining the SQLite connection shim and security invariants.

## Verification
Targeted domain/adapter/native/renderer regressions, fresh native builds, matching supported protocol generation, full native matrix and desktop suite, full synthetic Electron smoke, independent focused review, then owner desktop screenshot/interaction review. Existing failed logs remain preserved under .tmp/epic1-validation-20261101.
## Repair checkpoint (12:31 UTC)
- Domain and adapter regression suite: 279 passed, zero failed; includes duplicate-claim receipt and explicit completed-follow-up tests.
- Strict clippy: domain, adapters, protocol and service, all targets, test-issuer feature, -D warnings: passed.
- Desktop production build: TypeScript, renderer typecheck, data-policy check and Vite output passed.
- Focused independent review found no must-fix issue in receipt CAS, current-authority publication or explicit continuation patches.
- Fresh CLI/app-server rebuild and strengthened native witnesses are in progress. This checkpoint is not Epic acceptance.
- Messages warm-policy transition remains unresolved: trusted late permissions fragments cannot be blindly reordered into a provider system prefix. Existing strict refusal is preserved.
- Full native/desktop/Electron reruns and owner visual review remain pending. No guest-certification or real-data eligibility claim.

All changes stay on feat/epic-1-secure-private-desktop with regular local commits. No push, deployment, new installs, live provider calls, guest/shared WSL restart, or eligibility promotion is authorized.

## Settings and smoke checkpoint (12:49 UTC)
- Fresh CLI/app-server build passed. Supported protocol regeneration produced 816 files against engine tree a1615ba23d01ff3a695bed746bd7cd032b7c8fd9.
- Added token-counted settings transitions, principal/runtime/generation fences, immediate prior-scope clearing and settled refresh. Data-deletion identity callbacks use the same transition discipline.
- Corrected smoke readiness for a retained-but-hidden Shell; bounds and sign-out private-DOM assertions remain strict.
- Synthetic smoke now selects the bundled static model catalog on every runtime start. Missing, malformed or empty catalog fails closed; normal and packaged launches are unchanged. This prevents the remote model-discovery request seen in the original synthetic smoke log.
- Focused desktop regression: 289 tests across 8 files passed, including explicit follow-up, current-scope settings, security bridge, static catalog and data-identity transition cases. The first run exposed a missing explicit event-channel allowlist entry in its security assertion; the named channel was added and the complete focused set rerun.
- Independent review found the alternate data-identity callback gap, now repaired; no other must-fix issue found in reviewed settings/static-catalog paths.
- Full desktop validation and the rebuilt native 62-case inventory remain in progress; these checks do not establish Epic acceptance.

## Runtime checkpoint (13:03 UTC)
- Focused native: completed follow-up 2/2, Stop during steering 2/2, peer-private lifecycle 2/2, progress continuity 2/2 passed. Both cache cases still fail: running command is emitted as a transient notification but absent from the durable index used by progress. Do not count cache as passed.
- Broad desktop run (log historically named desktop-targeted.log because the pnpm separator did not apply the intended filter) completed with 1,617 passing tests and 18 platform skips. One suite failed in its afterAll WSL cleanup hook; no test assertion failed. A separately explicit focused run passed 289 tests, including the new data-identity file not present when broad discovery began.
- Cleanup diagnosis: discoverScopes performs ACL mutation on all profile directories before ownership filtering. A parallel vanished profile caused FileNotFound. Fix under implementation: discovery must be read-only and exact selected-scope validation must fail closed. No manual ACL widening/deletion is being used.
- First repaired Electron run completed all 16 reports: 7 passed, 9 failed (organise, states, shell-layout, composer, policy, tool-bounds, permissions, capabilities, environments). Handshake passed; external model-refresh matches were zero. UI stale observations and authority refresh latency remain open.
- A fresh isolated Electron attempt was started after other checks ended, then deliberately stopped (verified owned wrapper PID 24520 and descendants only) as soon as the broad ACL mutation bug was confirmed; no acceptance result is claimed for that aborted run. Existing profiles/services were not manually altered. Its artifacts remain preserved.
- Next: verify scoped discovery repair, isolated Electron rerun, and bounded current-run live command projection/cache coverage. Full native inventory and visual owner review remain pending.

## Scoped cleanup repair (13:12 UTC)
- WSL profile discovery is now read-only; exact forScope lookup no longer re-enumerates peers. Selected scope ownership/privacy and redirect/hardlink checks remain fail-closed.
- Locator reads use an 8 KiB + 1 byte bounded buffer with pre/open/post identity, size and modification checks; overflow/replacement is rejected.
- 19 mocked scope/race/corruption cases passed; fresh desktop production build passed.
- Real WSL integration rerun passed both execution-boundary/OS-transition tests and its cleanup hook (60 seconds), including the existing 13-case executor boundary matrix. No manual profile deletion or ACL repair was performed.
- This repairs the failed broad-run cleanup hook; the broad suite still requires a final rerun at the completed candidate. Native live-progress repair remains in development.
