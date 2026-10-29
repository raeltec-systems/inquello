---
title: 'Story 1.15: Distinguish execution, checks, review and delivery states'
type: 'feature'
created: '2026-10-29'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-14-organise-workspaces-engagements-folders-tasks.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-7-navigate-and-identify-work-with-accessible-primitives.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tasks have no state yet. The risk is that "done" collapses execution, checks, review, approval and delivery into one word (FR-44, AD-6, UX-DR51).

**Approach:** Add a typed, versioned, scoped state model to `inquello-domain`. It stores seven separate dimensions, each with its own vocabulary and writer rules. The working store persists it, `inquello/state/*` methods expose it, and the open Task's view shows each dimension separately. Only Task and run states have writers now.

**Owner decisions (2026-10-29):**
- **Model:** all seven dimensions are stored as separate records with exact vocabularies and domain rules. Only Task and run states get writers now; the others exist as types and tests, written by their later epics.
- **Professional Approval and Delivery:** these are local working markers only, with no external-reference fields until the external-audit route (OQ-15) is designed. They are always labelled as local markers, never as authoritative sign-off or proof of delivery.

## Boundaries & Constraints

**Always:**
- **Dimensions and vocabularies** (no shared "done"):
  - `task`: planned, running, blocked, interrupted;
  - `run`: running, blocked, interrupted, execution_finished, failed;
  - `output`: produced;
  - `checks`: incomplete, complete;
  - `review`: requested, revision_requested, decision_recorded;
  - `approval_marker`: noted_locally;
  - `delivery_marker`: attempted, confirmed, uncertain.
- **Record shape:** each record is `{dimension, scope_kind, scope_id, value, version, actor_kind (human|runtime|system), actor_ref, recorded_at, revision}`.
  - The scope is the Task, a run, or an output/version reference.
  - "Absent" means "not recorded"; nothing is defaulted.
- **Writer rules (domain):**
  - `review` and `approval_marker` require `actor_kind = human` with a principal reference. Runtime and system actors are refused, so model output cannot mint a human decision.
  - `task` and `run` accept runtime or system actors.
  - The other dimensions are refused through the Story 1.15 methods (`dimension_not_enabled`) until their epic.
  - Every write uses the Story 1.4 operation-ID and expected-revision pattern, with the R10 race replay. Only the Task's creator can write or read its states.
- **Independence:** no transition table spans dimensions. A Task can be `execution_finished` with no checks, review or markers. Nothing forces a route through approval or delivery.
- **Display:**
  - The open Task shows a States section that lists every dimension, with its value or "Not recorded".
  - `execution_finished` reads "Execution finished" in a neutral style, never green.
  - Review and markers use separate truthful labels ("Approval noted locally — not an authoritative record"; "Delivery attempted / confirmed / uncertain — local marker") through StatusChip's custom-label path (Story 1.7), never the accepted or explained chips.
  - No toast or green chip ever states acceptance.
- **Host methods:**
  - `inquello/state/list {taskId}` (dimensions with history, latest first).
  - `inquello/state/record {taskId, dimension, scopeKind, scopeId, value, expectedRevision, operationId}`, where main supplies the actor kind (`system` for desktop-originated Task states). Human-actor writes come later from the UI; there is no human-dimension writer in this story.

**Never:**
- No real runs (Story 1.25).
- No check, review, approval or delivery UI or writers.
- No external-system references.
- No StatusChip coercion of these states into suggested, investigating, open, evidence, accepted or explained.
- No new dependencies.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Run finished | `run = execution_finished` recorded | Shown as "Execution finished" (neutral); checks, review and markers "Not recorded" | N/A |
| Independent states | `checks = complete` without review | Valid; no review implied | N/A |
| Human-only | `review` written by a runtime or system actor | Refused | `human_actor_required` |
| Not enabled | `delivery_marker` written in this story | Refused | `dimension_not_enabled` |
| Bad value | `run = done` | Refused | `invalid_value` |
| Stale write | Old `expected_revision` | Refused; history unchanged | Conflict |
| Replay | Same op ID, same request | Recorded outcome | Different payload: conflict |
| Other creator | Second principal lists or records states | Refused like an unknown Task | No disclosure |
| Custom label | A state outside the StatusChip taxonomy | Separate truthful text label | N/A |
| History | Task planned → running → interrupted | All three listed with versions and actors | N/A |

</frozen-after-approval>

## Code Map

- `engine/codex-rs/inquello-domain/src/organise/` (Story 1.14 records and commands, R10 replay) -- add a `state` module beside it.
- `engine/codex-rs/inquello-adapters/` -- migration `0003`, store methods and the race tests pattern (`tests/concurrent_operations.rs`).
- `engine/codex-rs/app-server/src/request_processors/inquello_processor.rs` and `app-server-protocol` -- add the two methods and regenerate.
- `desktop/src/main/organise/` -- mediation and preload operations.
- `desktop/src/renderer/Shell/` -- the States section in the Task view.
- `desktop/src/renderer/primitives/StatusChip.tsx` -- the custom `label` path.

## Tasks & Acceptance

**Execution:**
- [x] Domain `state` module, with tests for every matrix row (domain level).
- [x] Adapter migration 0003, store methods and race tests.
- [x] App-server methods (FORK-CUT Patch 9), regenerated protocol and stamp, and processor tests.
- [x] Desktop main mediation, preload `state.list` and `state.recordTaskState` (task and run only, actor `system`), the States section, and jsdom tests.
- [x] Smoke `states` report: record task planned → running and run execution_finished through main. The Task view shows "Execution finished" in neutral style, every other dimension shows "Not recorded", no accepted or green chip appears, and a review write is refused.
- [x] `sprint-status.yaml` (1-15).

**Acceptance Criteria:**
- Given the smoke with the seeded topology, when it runs, then the `states` report and all earlier reports are ok, and it exits 0.

## Implementation Notes

- **As built:**
  - **Domain (`inquello-domain/src/state/`):** `StateDimension` (seven, each with `vocabulary()` and allowed scope kinds: `task` → task, `run` → run, `output` → output, the other four → task, run or output; a `task` scope must name the Task itself), `ScopeKind`, `ActorKind`, `StateWriter` (`Human` is always the session's principal, so no payload can name one; `Runtime` and `System` carry a 1–128-byte reference), immutable `StateRecord`, `TaskStates`, `StateReceipt` (command `record_state`), the `TaskStateStore` port, `record_task_state` and the creator-only `task_states`. Check order: Task ID, dimension, value (`invalid_value`), scope, writer reference, writer rule (`human_actor_required`), enablement (`dimension_not_enabled`), operation ID; then replay, creator check (`not_found`), revision, commit, with the R10 re-lookup. New `DomainError` variants `HumanActorRequired`, `DimensionNotEnabled`, `InvalidValue`.
  - **Interpretation of `version` and `revision`:** `revision` is the Task's state revision (one compare-and-set counter over all of a Task's state records, 0 before the first; each record holds the revision it created), and it is the `expectedRevision` of `inquello/state/record`. `version` counts records within one (dimension, scope): 1, 2, 3. The two are separate so that the history shows per-dimension versions while stale writes are still detected. This couples dimensions only for concurrency, never for transitions.
  - **Writer rule for the other dimensions:** only `review` and `approval_marker` require a human; every other dimension accepts any writer kind. A human may therefore also write `task` and `run` once a UI does; no human writer exists in this story.
  - **Adapter:** migration `0003_task_states.sql` (`task_states` keyed by (task, revision), unique per (task, dimension, scope, version), with schema checks for each vocabulary, the human-only rule and the task-scope rule; `state_receipts`). `src/states.rs` writes in one `BEGIN IMMEDIATE` transaction: receipt check first (R10), revision compare-and-set, record, receipt.
  - **Host (FORK-CUT Patch 9):** `inquello/state/list {taskId}` returns `{taskId, revision, dimensions}` with all seven dimensions in order, records latest first. `inquello/state/record` adds `actorKind` and `actorRef` to the frozen parameter list: main supplies both; `human` takes no reference (it is the bound principal), `runtime` and `system` need one. Refusal kinds `human_actor_required`, `dimension_not_enabled`, `invalid_value`.
  - **Desktop main:** `OrganiseService.listStates` and `recordTaskState` (`src/main/organise/states.ts` holds the views, validators and `DESKTOP_STATE_ACTOR = 'inquello-desktop'`). Main maps a `task` state to scope `task`/Task ID and a `run` state to scope `run`/`runId`, always with actor kind `system`. Operations `state.list` and `state.recordTaskState` are in the named registry and the preload (`window.inquello.state`); the validator accepts exactly `{operationId, taskId, expectedRevision, dimension: 'task' | 'run', value, runId}` (runId null for `task`, printable for `run`), so no actor, scope or principal key passes.
  - **Renderer:** `Shell/TaskStates.tsx` (States section, `data-task-states`, one `data-state-dimension` row per dimension), `Shell/state-bridge.ts` (labels, defensive parsing). Every value renders through StatusChip's custom `label` path with status key `<dimension>:<value>`, so it is always the neutral `iq-status-chip--other` style. Approval reads "Approval noted locally — not an authoritative record"; delivery reads "Delivery attempted / confirmed / uncertain — local marker". Earlier records are listed under each dimension with version and actor. The Shell reads the open Task's states on open and on every tree refresh; it never records one.
  - **Smoke:** a `states` report after `organise`. Unconfigured: `state.list` answers signed-out and a review write fails main's validator. Configured: sign in, create an ad hoc Task in main, record task planned → running and run execution_finished through the renderer's `state.recordTaskState`, try a review write through the renderer (refused by main's validator) and straight to the runtime as `system` (`human_actor_required`), open the Task and read the States section (run chip "Execution finished", custom-label class, colours different from the accepted chip and not green; the five other dimensions "Not recorded"; no accepted or explained chip; no acceptance text or toast), list through main (revision 3), and check a second principal gets `not_found`. Signs out at the end.
- **Results (2026-10-29):**
  - Engine: `inquello-domain` 63 lib tests pass (11 new state command tests and 4 state model tests) plus its integration tests; `inquello-adapters` 44 tests pass (5 new in `task_states.rs`, 4 new state races in `concurrent_operations.rs`); `codex-app-server` inquello processor 8 tests (2 new); `codex-app-server-protocol` 317 lib tests (schema fixtures included). Clippy `-D warnings` clean on `inquello-domain` and `inquello-adapters`; `codex-app-server` clippy shows only the pre-existing upstream `let_and_return`. Both builds pass separately; `Cargo.lock` unchanged.
  - Desktop: `pnpm generate:protocol` emits the six `InquelloState*` types (781 files); `pnpm run build` is clean; `pnpm test` with `INQUELLO_TEST_DATABASE_URL` passes 825 tests (34 new, including the real-runtime states test in `organise-integration.test.ts`).
  - Keyring smoke with the seeded topology: exit 0; `renderer-privileges`, `design`, `identity`, `data`, `providers`, `organise` and `states` all ok.
  - Step-04 review was skipped by owner rule.

## Verification

**Commands:**
- In `engine/codex-rs` (`-j 4`, `CARGO_INCREMENTAL=0`): tests for `inquello-domain`, `inquello-adapters` and the app-server inquello tests; clippy and fmt on the changed crates. Build with `cargo build --locked -p codex-cli -p codex-app-server`, then separately `-p inquello-service --features test-issuer --bin inquello-dev-topology` -- expected: pass, clean
- In `desktop/`: `pnpm generate:protocol` (new types), `pnpm run build`, `pnpm test` with the database URL -- expected: all pass
- Keyring smoke with the seeded topology -- expected: exit 0, all reports ok
