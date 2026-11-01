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
