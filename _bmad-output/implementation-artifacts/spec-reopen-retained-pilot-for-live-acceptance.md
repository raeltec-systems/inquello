---
title: 'Reopen the retained pilot for current-build acceptance'
type: 'chore'
created: '2026-11-09'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'daf2dbae7ff1bc229c0bbc012cb9bc89cb09a7e3'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/verification.md'
  - '{project-root}/desktop/AUTH0-PILOT.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-30-find-and-reopen-only-permitted-saved-work.md'
---

<frozen-after-approval reason="human-owned intent — draft pending owner approval">

## Intent

**Problem:** Actual acceptance needs the current app. The retained pilot's CA/server certificates expired on November 9 at 06:33:15 UTC. Its shortcut selects the November 3 delivery; the default service executable also predates the checkpoint.

**Approach:** Renew certificates with existing keys and a seven-day lifetime, prepare matched artifacts, and reopen the same profile for account/provider/model inspection. Request live-inference authorization separately.

## Boundaries & Constraints

**Always:** Preserve the Epic 1 branch and local work; run `9f9d996b-255c-47f8-9fa2-4fc004cfab03`; root `D:\Inquello\tmp\inquello-auth0-pilot-20261102`; database identity; ports 45443/43821; workspace, conversations, drafts, credential references and consent. Verify ownership before mutation/launch. Use installed tools offline, at most four build jobs, private backups and effective TLS/policy/qualification checks. Approval authorizes existing-key local signing and same-profile startup.

**Never:** Reset/seed profiles or databases; restore old user data; print/export secrets; change Auth0, membership or provider consent; install/download; bypass security or qualification; enable Private Task external integrations; relabel old artifacts. No paid inference, external OAuth grants, real audit-data transmission, automatic Epic completion, next epic, push, PR, merge or deployment.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected behavior | Failure handling |
| --- | --- | --- | --- |
| Owned, quiescent pilot | Matching receipts and database context | Private backup, staged renewal and same-profile resume | Abort before mutation on any mismatch |
| Stale/foreign owner or occupied port | Ownership unresolved | No duplicate launch or process kill | Report exact ownership blocker |
| Expired local TLS | Existing key identities and loopback SAN verified | Seven-day CA/server renewal; same keys, subjects, constraints and IP SAN | Verify staged chain before activation; retain original certificate/receipt files |
| Interrupted activation | Incomplete local certificate/receipt replacement | Refuse launch pending reconciliation | Restore only operation-owned TLS/receipt files from its new backup, never user data |
| Provider or route unavailable | Normal app refuses readiness | Preserve truthful refusal and current authority | Record defect/blocker; no consent or qualification bypass |

</frozen-after-approval>

## Code Map

- `desktop/scripts/run-auth0-pilot.cjs`: reuse strict resume, manifest checks, database context and owned lifecycle unchanged.
- `.tmp/model-choice-v5-retained-{preflight.cjs,resume.ps1}`: historical November 3 references; do not overwrite or launch.
- `desktop/src/protocol/schema-stamp.json`: verify engine tree and generated content against selected runtime.
- `.tmp/epic1-live-acceptance-20261109/`: operation scripts/evidence; completed recovery is preserved.
- `desktop/src/renderer/Shell/Shell.tsx`: existing explicit `refreshWorkspace`/`recoverNavigation` action and `loadTree` handling. Partial successful trees with unavailable Tasks currently hide recovery when no Task is open.
- `desktop/test/navigation-recovery-shell.test.tsx` and existing navigation/organise/bootstrap suites: recovery gating, denial, races, draft retention and no automatic execution.

## Tasks & Acceptance

**Execution:**
- [x] New operation scripts: validate private root, receipts, ACLs, database context, ownership, disk space and public key/certificate identities. Back up current profile/database privately; no keyring export.
- [x] New operation scripts: first exercise mismatch, expired-chain and interrupted-activation refusals on disposable fixtures. Stage renewal with installed OpenSSL; verify chain/SAN/constraints/validity. Retain originals privately; activate certificates and update only `pilot.json`'s CA digest. Journal hashes/recovery state without key contents.
- [x] New operation scripts: rebuild default CLI/app-server/service offline, verify protocol, build desktop and create an exact manifest accepted by the unchanged pilot validator. Stop on unexpected source drift or missing qualification.
- [x] New hidden launch wrapper: fresh preflight, same-profile normal resume and sanitized readiness/ownership evidence; visible ordinary app window.
- [ ] Actual UI: inspect Account, AI connections, Models, Usage, Back/keyboard navigation and saved work/draft continuity. Avoid credential Check if it might invoke paid inference. User performs needed sign-in/secret entry. Record defects and the specific live-call request separately.
- [ ] Under existing approved Story 1.30, repair the observed renderer recovery gap: expose existing explicit Refresh workspace for partial unavailable-Task trees with no open Task. Retain authorized rows and drafts; never reveal withheld titles or recover automatically. Reuse existing fresh-authority recovery without main/native/security/credential changes. Reproduce before the fix, cover keyboard activation, refused recovery, current identity/Workspace fences, repeat-click suppression, successful fresh reads and zero Task start/resume/turn calls. Build and exercise the actual saved-profile recovery without inference; if recovery reveals a deeper refusal, retain it and diagnose rather than bypassing it.

**Acceptance Criteria:**
- Given the preserved pilot, when recovery succeeds, then ordinary Inquello opens on identified current artifacts with valid scoped TLS and the same saved workspace/profile.
- Given navigation through Settings and back, when controls are inspected, then observed readiness/failures remain truthful and saved work/drafts persist.
- Given no paid-call authorization, when recovery finishes, then zero model prompts were sent and live-provider/Epic acceptance remains explicitly pending.

## Implementation Notes

Owner approved continuation on 2026-11-09: reopen the same saved profile on the current build, inspect account/provider/model experience, preserve local work, and stop before paid calls. Frozen intent is approved and locked. This operational task has no new sprint story key.

Recovery and signed-out UI/navigation inspection passed. Authenticated provider/model and saved-work/draft continuity remain pending direct user sign-in; status remains in-progress. App/runner are left alive, with zero model prompts sent. See [dated handoff](handoff/HANDOFF-2026-11-09-retained-pilot-current-build.md) for exact artifacts, evidence and preserved failures. No product source change, sprint change, commit or push was performed.

Authenticated inspection subsequently confirmed the preserved account, Raeltec workspace, allowed OpenAI consent and connected OS-keyring credential after explicit status refresh. Both saved Tasks still exist, but native saved-read sessions are absent after restart. Partial tree success with title-free unavailable IDs hides the existing recovery action. Story 1.30's frozen, already-approved contract explicitly requires usable authorized reopening without automatic Resume, provider dependence or weaker access checks; its November 1 continuation records owner authorization. The original request also directs fixing observed defects. The narrow renderer repair above is implementation within that approved story, not a new feature or frozen-intent amendment. The Models page's indistinguishable rev1/rev2 entries are recorded separately, without altering or deleting bindings.

Do not rerun completed private backup/TLS activation or launch a duplicate. Keep the healthy runner alive. Capture exact changed-source/desktop artifact provenance after the repair; the November 7 source freeze then remains historical, not a pass for changed renderer source. Coordinate actual UI checks through the primary agent; do not dispatch any model request.

Later on 2026-11-09 the earlier runner was found cleanly stopped; the repaired candidate was relaunched once through the preflight-gated wrapper and the owner pressed Refresh workspace in the actual app. Saved chats remained unavailable. Diagnosis from source and build outputs: the Story 1.28 real-data gate requires reviewed negative-authorization evidence for the exact running build, and the register's evidence is bound to the 2026-11-03 build digest, not the current one. The refusal is retained, not bypassed. The owner chose to defer re-qualification of the current build to the end of Epic 1 (it needs a multi-hour software-evidence run, independent review, a register edit under `engine/` and probably fresh workspace approval; no paid provider call). Saved-history reopening on the current build stays blocked on that. The two remaining tasks stay unchecked and status stays in-progress. Details are in the dated handoff.

## Spec Change Log

## Verification

- `node _bmad-output/implementation-artifacts/verification-2026-11-05/freeze-provider-recovery-final-20261107.cjs check`: passed during inspection; 11,036 files unchanged at the full baseline commit.
- New scripts' disposable-fixture checks must pass the matrix before touching the retained pilot.
- Existing offline native build settings: `cargo build --offline --locked -j4 -p codex-cli --bin codex -p codex-app-server --bin codex-app-server -p inquello-service --bin inquello-service`; installed Rust 1.99.1/MSVC and existing D-drive caches only.
- `pnpm run generate:protocol` and `pnpm run build` in `desktop/`: matching runtime/protocol and successful production build; inspect any generated diff before proceeding.
- Unchanged pilot validation, `PILOT_READY`, fresh process identity and actual UI observation establish startup, not live-provider acceptance. Source fixes require applicable story approval and affected verification.
- Record a dated handoff. Preserve November 7's 2,265-test/19-report checkpoint as historical synthetic evidence; keep sprint statuses unchanged until actual acceptance. Commit only scoped nonprivate evidence when complete.
- Scoped Story 1.30 renderer repair: from `desktop/`, `pnpm exec vitest run --configLoader runner test/navigation-recovery-shell.test.tsx test/navigation-recovery.test.ts test/tasks-bootstrap.test.ts test/organise-shell.test.tsx test/tree-read-order-shell.test.tsx test/navigation-reopen-retry.test.ts test/saved-work-shell.test.tsx`, then `pnpm run build`. Reuse installed offline tooling; source-matched native binaries were rebuilt in this operation and engine source is unchanged. Preserve failing-before and passing-after logs. Actual UI must reach the existing explicit recovery and permitted saved work while no inference is dispatched. Broaden checks only for affected shared behavior or a new failure; no full-suite or Epic-completion claim from focused results.
