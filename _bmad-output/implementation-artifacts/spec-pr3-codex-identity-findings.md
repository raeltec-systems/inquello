---
title: 'Fix two identity-session findings from the Codex review of pull request 3'
type: 'bugfix'
created: '2026-11-10'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
baseline_commit: '0f17ddca70e10e1ad2387c9f3a7ad0aca33d7c2e'
context:
  - '{project-root}/docs/verification.md'
---

<frozen-after-approval reason="human-owned intent — standing rule in CLAUDE.md: respond to review comments left on the epic pull request">

## Intent

**Problem:** The Codex review of raeltec-systems/inquello#3 at `f965f60ae6` left two findings in `desktop/src/main/identity/session.ts`. (1) On a sign-out retry, a refused access credential was taken as proof that the earlier attempt had committed, so an expired credential plus an unavailable refresh reported a successful sign-out while the server session and refresh family stayed alive. (2) Cancelling a sign-in that was waiting for the browser cleared only its token; its loopback listener stayed bound to the fixed callback port until the callback or the timeout, so a new sign-in failed with "callback port already in use".

**Approach:** On a refused credential, let a refresh decide whether the family is alive before confirming a sign-out, and keep the pending operation when that cannot be verified. Close the active loopback listener when a sign-in is cancelled, and never open one for an attempt that is already cancelled.

</frozen-after-approval>

## Implementation Notes

- **Finding 1 (P1), confirmed by reading the code and reproduced.** `attemptLogout` no longer finishes the sign-out on `unauthenticated` just because the operation was marked sent. It refreshes once: a live family yields a fresh credential and the same envelope is sent again; a revoked family is refused, discarded and its revocation sent, which confirms the sign-out; if the refresh cannot be attempted, or a freshly refreshed credential is refused again, the operation stays pending with its ID. A retry keeps `sent: true`; a first attempt still resets it. A `refreshed` parameter bounds the recursion to one refresh per attempt.
- **Finding 2 (P2), confirmed and reproduced.** `IdentitySession` keeps the active sign-in's listener; `cancelSignIn` closes it. `runSignIn` checks for cancellation after issuer discovery and again after the listener starts, and reports `cancelled` instead of an issuer refusal when its own listener was closed by a cancellation.
- **Behaviour changes to know about.** A sign-out retry that used to report success immediately on a refused credential now makes one refresh request first. A cancelled sign-in now ends at once with the "cancelled" reason; before, it ended at the callback timeout with "timed out" or when a late callback arrived.
- **Tests.** Two regression tests in `desktop/test/identity-session.test.ts`, using the real loopback listener and vault with the existing fakes. Both fail on the previous code (the second by timing out on "port already in use") and pass now. The 50 existing identity session tests pass unchanged.
- **After review pass 1.** A sign-in cancelled while its login transaction is being created is now abandoned before the browser opens. The first-attempt or retry answer is carried across the one refresh, so a first attempt is never recorded as possibly sent. Three more regression tests: a refreshed credential refused again (one refresh, one resend, sign-out stays pending, service shown as available), and cancellation during issuer discovery and during login-transaction creation (no browser, port free afterwards). The sign-in cancellation tests live in the "local removal during a sign-in" section and share a `freePort()` helper. The existing lost-response test now also asserts that the refused retry is settled by exactly one refresh.
- **Full desktop suite at `f023bc1ae6` (2026-11-10, 23 minutes): 2,280 passed, 3 failed, 21 skipped.** All three failures are timeouts in Linux-sandbox integration tests: two in `tool-bounds-integration` (120 s and 180 s) and one in `permissions-integration` (180 s), plus that file's clean-up reporting the guest unavailable. No identity, onboarding or shell test failed. The sandbox was abnormally slow at the time: `tool-bounds-integration` run alone just before passed 7 of 7 but took 307 s, against seconds earlier in the day. The Linux guest shares one WSL virtual machine with Docker; during the run another project's Postgres container was using about 78% CPU and a Supabase container was in a restart loop. Those belong to other projects and were not touched. The same suite passed 2,270 with no failure earlier the same day, before these changes. Cause is consistent with host load but was not proved by a re-run on a quiet machine. Logs: `.tmp/epic1-offline-pass-20261109/final-full-vitest.log`, `review-toolbounds.log`.

## Review Triage Log

### Pass 1 — 2026-11-10

Layers: edge-case hunter and verification-gap on Sonnet. The blind hunter ran on Haiku and failed three times to return its report, so that layer was re-run on Sonnet against the patched diff. Verdicts are the coordinating session's.

| ID | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|
| VG1 | Cancel during discovery or listener start-up untested | medium | Filed pre-verified: deleting either new guard failed no test. | patch: two-case test |
| VG2 | Refused-again-after-refresh branch untested | medium | Filed pre-verified: dropping the one-refresh guard failed no test. | patch: test asserts one refresh, two sends, pending |
| VG-o1, EC3 | First attempt recorded as possibly sent after the refresh | low | The recursive call re-read `sent`, which its caller had just set. No behaviour depends on it now, but it contradicted the comment. | patch: original answer passed through |
| EC1 | Browser opens for a sign-in cancelled during transaction creation | medium | No `cancelled()` check between `createLoginTransaction` and `openBrowser`; the listener is already closed, so the browser would return to a dead port. | patch: abandon before opening the browser |
| EC2 | Cancelled attempt may report "port occupied" | low | Needs an occupied port and a cancellation in the same instant. | reject: unlikely, adds a branch |
| EC4, BH5 | Service shown "available" while sign-out is pending | false | The service answered and refused; the pending sign-out is shown by the blocked identity state. Comment added. | reject |
| EC5, BH8 | Free-port probe can race; probe duplicated | low | Race is negligible; duplication was real. | patch for the duplication only: `freePort()` helper |
| BH1 | No test for the revoked-family path | false | The existing "self-logout lost" test drives exactly that path and passes; it now also asserts the single refresh. | reject |
| BH2 | No way out of a permanently refused sign-out | false | `forgetLocally()` removes the session locally without server confirmation and is exposed through local data removal. | reject |
| BH3 | Persisted `sent` flag not asserted | low | Nothing reads the flag except this function's own bookkeeping. | reject |
| BH4 | Four positional parameters on `attemptLogout` | low | Private method with two internal recursive call sites. | reject |
| BH6 | Cancellation during browser open or code exchange untested | false | Checks after the callback, the exchange and bootstrap predate this change, and the R04 tests cover a late result. | reject |
| BH7 | Listener close contract unverified | false | `loopback.ts` documents and implements "a pending callback rejects with closed"; the new port-release test passes through it. | reject |
| BH9 | New sign-in tests sat in the sign-out section | low | True. | patch: moved |
| BH10 | Stubs not restored on failure | false | `world()` builds fresh fakes per test. | reject |

## Verification

**Commands (from `desktop/`):**
- `pnpm exec tsc -p tsconfig.json --noEmit` -- expected: exit 0
- `pnpm exec vitest run --configLoader runner test/identity-session.test.ts` -- expected: 55 passed
- `pnpm test` -- expected: no failure caused by this change
