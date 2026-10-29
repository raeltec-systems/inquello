---
title: 'Story 1.14: Organise private Workspaces, Engagements, folders and Tasks'
type: 'feature'
created: '2026-10-29'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'ace1ca2883cc8cf62c44dd2df9563236c025c19a'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-4-keep-local-working-metadata-behind-domain-commands.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-11-enforce-internal-company-memberships.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-12-govern-local-data-held-by-first-route.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The working store (Story 1.4) and the service memberships (Story 1.11) exist, but the desktop cannot organise work. There are no Engagements, folders or Tasks, and nothing connects the domain commands to the desktop (FR-1, AD-6, AD-7).

**Approach:**
- **Domain:** extend `inquello-domain` with Engagement, Folder and Task records and commands, persisted by the `inquello-adapters` SQLite store.
- **Host:** host them in the forked app-server as `inquello/*` JSON-RPC methods, so the desktop reaches them over its existing stdio runtime.
- **Desktop:** main mediates every call. Engagement creation is validated by the shared service.
- **UI:** a minimal real Sidebar (Workspace selector, Engagements with folders and Tasks, ad hoc Tasks, New thread) and a Header (client, period, Workspace).

**Owner decisions (2026-10-29):**
- **Host:** the forked app-server hosts the domain (a deliberate engine patch).
- **Workspace:** a shared-service Workspace is required. Existing private Tasks stay readable while the service is down; creating an Engagement needs the service.
- **UI:** a minimal real Sidebar and Header now; Story 1.16 hardens layout, keyboard and responsiveness.

## Boundaries & Constraints

**Always:**
- **Records:**
  - **Engagement:** `engagement_id`, `workspace_id`, `service_engagement_id` (the Story 1.11 Engagement, which owns membership), name, objectives, scope, optional client/entity, optional period start and end, `revision`.
  - **Folder:** `folder_id`, `engagement_id` (required), name, `revision`.
  - **Task:** `task_id`, `workspace_id`, `creator_principal_id`, optional `engagement_id`, optional `folder_id`, title, optional `runtime_thread_id`, `source_refs` and `artifact_refs` (both empty lists until later epics), `visibility: private`, `revision`.
  - IDs are UUIDs and stable, scoped by Workspace.
- **Commands:** create Engagement, rename or edit Engagement, create Folder, create Task, rename Task, move Task (to another Engagement and folder, or to none) and attach a thread ref.
  - Each is a domain command with an operation ID and expected revision, following the Story 1.4 receipt and replay pattern.
  - A move keeps `task_id`, the thread ref and the references. It never changes visibility or grants, and it only targets Engagements in the same Workspace.
- **Engagement creation:** main first runs the Story 1.11 service command to create the Engagement (membership references validated there), then the local `inquello/engagement/create` with the returned `service_engagement_id`. If the service step fails, nothing is created locally. If the local step fails afterwards, the operation ID is reused on retry, and no duplicate service Engagement is made.
- **Visibility:** every Task is private to its creator. List methods return only Tasks whose `creator_principal_id` is the signed-in principal, whatever the Engagement membership. No Share control exists in the UI.
- **Host methods:**
  - The app-server gains an `inquello` request processor, with methods such as `inquello/engagement/create`, `inquello/engagement/update`, `inquello/folder/create`, `inquello/task/create`, `inquello/task/rename`, `inquello/task/move`, `inquello/task/attachThread` and `inquello/workspace/tree`.
  - The store path comes from `INQUELLO_WORKING_STORE`, set by the desktop to `<userData>/working/working.sqlite`. Without it, the methods answer "store not configured".
  - The acting principal is set by main through `inquello/session/setPrincipal` on each sign-in change and is never taken from payloads. Agent tools have no route to these methods.
- **Engine changes:** the patch stays minimal: protocol entries, one processor file and a store-path config. The protocol is regenerated, and the desktop uses the generated types.
- **Data policy:** add a `working-store` category (`working/*.sqlite*`): enabled, owned by the creator, kept until deleted, export included.
- **UI:**
  - The Sidebar is 264px with the Workspace selector, the Engagements section (Engagement, then folders, then Tasks), ad hoc Tasks and a New thread button. New thread creates an untitled ad hoc Task and opens it.
  - The Header is 48px and shows the open Task's title, client/entity, period and effective Workspace.
  - Engagement and folder creation use Story 1.6 inputs.
  - Opening a Task shows a placeholder thread area; the Composer is Story 1.17.
- **Shared-service fallback:** with the service unavailable, local Tasks still list and open, and Engagement creation is disabled with its reason.

**Never:**
- No Share control and no grant change.
- No Task execution or runtime thread creation (Stories 1.25 and later).
- No renderer or agent-tool write path to SQLite.
- No full keyboard or responsive shell (Story 1.16).
- No new dependencies.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create Engagement | Signed in, member, with name, period and client | Service Engagement plus local record; shown in Sidebar | Service down: disabled with reason |
| Ad hoc Task | New thread | Task with no Engagement, private, opened | N/A |
| Folder + Task | Create a folder, then a Task in it | Listed under Engagement → folder | N/A |
| Move Task | Move between Engagements | Same `task_id`, thread ref and refs; still private | Target in another Workspace: rejected |
| Stale revision | Rename with an old `expected_revision` | Rejected; draft kept | Conflict shown |
| Replay | Same op ID retried | Recorded outcome; no duplicate | N/A |
| Other creator | A second principal's Task in the same Engagement | Not listed for the first principal | N/A |
| No principal | `inquello/*` call before `setPrincipal` | Rejected as unauthenticated | N/A |
| Header | Open a Task with an Engagement | Title, client, period and Workspace shown | Ad hoc: client and period absent |
| Service down | Topology stopped | Existing Tasks open; create Engagement disabled | Reason shown |

</frozen-after-approval>

## Code Map

- `engine/codex-rs/inquello-domain/src/{commands,model,ports}.rs` and `inquello-adapters/src/{store,sqlite}.rs` plus `migrations/` -- the Story 1.4 patterns; add migration `0002`.
- `engine/codex-rs/app-server-protocol/src/protocol/common.rs` (the `ClientRequest` macro list, around lines 1150–1500) and `protocol/v2.rs` -- add the `inquello/*` entries and types.
- `engine/codex-rs/app-server/src/request_processors/` and the dispatch site that routes `ClientRequest` -- add `inquello_processor.rs`.
- `engine/codex-rs/app-server/Cargo.toml` -- depend on `inquello-domain` and `inquello-adapters`. Keep the domain's dependency-direction test green.
- `desktop/src/main/runtime/env.ts` (set `INQUELLO_WORKING_STORE`), `desktop/src/main/identity/` (principal changes) and the service client (the 1.11 Engagement command). Update the error parser to accept the optional `reason` field (deferred from 1.11).
- `desktop/src/renderer/` -- the new `Shell/Sidebar.tsx` and `Shell/Header.tsx`. The specimen page stays reachable for the smoke probes.

## Tasks & Acceptance

**Execution:**
- [x] `inquello-domain` and `inquello-adapters` -- the records, commands, a private-listing query and migration 0002, with tests for every matrix row at the domain level.
- [x] `app-server-protocol` and `app-server` -- the `inquello/*` methods and processor (Patch 7 in `FORK-CUT.md`), regenerated protocol and stamp, and app-server tests.
- [x] `desktop/src/main/organise/` -- the main mediation (principal binding, Engagement creation with service validation) plus the preload operations.
- [x] `desktop/src/renderer/Shell/` -- the Sidebar, Header and Task placeholder, with jsdom tests.
- [x] `desktop/data-policy.json` -- the `working-store` category.
- [x] `desktop/test/organise*.test.ts` -- an integration test against the real app-server, plus the dev topology for Engagement creation.
- [x] `smoke-probe.ts` -- an `organise` report: create an Engagement, folder and Task, move the Task, verify the IDs are unchanged and the Task is listed privately, and check the Header.
- [x] `sprint-status.yaml` (1-14).

**Acceptance Criteria:**
- Given the smoke with the dev topology running and a signed-in synthetic user, when it runs, then it creates an Engagement, folder and Task through the UI path and moves the Task. IDs and refs are unchanged and the Header shows client and period. It exits 0 with `organise.ok: true` and all earlier reports ok.

## Implementation Notes

- **Cloud machine (Linux, root):**
  - **PostgreSQL 18:** start it with `pg_ctlcluster 18 main start`, and export `INQUELLO_TEST_DATABASE_URL=postgres://inquello_test:inquello_test@127.0.0.1:5433/inquello_test`.
  - **Engine build:** use `-j 4`. Rebuild `codex-cli` and `codex-app-server` after the patch, before `pnpm generate:protocol` and the desktop tests. The protocol generator refuses a dirty `engine/`, so commit the engine change first, then regenerate, then amend.
  - **Keyring smoke:** as `smoke` inside `dbus-run-session` with an unlocked gnome-keyring, `--password-store=gnome-libsecret` and `xvfb-run`. Start the dev topology with `--config-out` (see the 1.10b notes and the topology binary's `--help`). The `dist/` directory and the topology files must be readable by `smoke`. Never pass `--no-sandbox`.
  - **Engagement creation in the smoke:** this needs a Workspace with the synthetic user as a member holding `manage_membership`. Use the operator CLI `inquello-service admin create-workspace`, with the topology's own database URL or the admin URL, then accept the first-admin invite after sign-in. Alternatively, extend the dev topology with an optional, test-issuer-gated `--seed-workspace` flag.
  - **Secrets:** this machine's environment holds real-looking provider keys (for example `ZOBBA_*`). Never print environment dumps in output or logs.
  - **Baseline:** 718 desktop tests pass; the keyring smoke exits 0 with all reports ok.
- **As built:**
  - **Domain (`inquello-domain/src/organise/`):** records as specified, plus a **Workspace label** (principal, Workspace, name, revision): the name a principal last saw for a Workspace, written by `RememberWorkspace` when the service lists it, so Tasks stay listable under named Workspaces while the service is down. Every command carries an operation ID and an expected *record* revision (0 for a creation, required). Receipts are record-scoped in a new `organise_receipts` table (principal, command, resource ID, revisions, the canonical request JSON); a reused operation ID with another request **or another principal** is `OperationConflict`, and a replay returns the receipt with the record as it now is. A Task command from another principal, or for a Task in another Workspace, is `NotFound`, the same as an unknown Task. A move or create that names an Engagement or folder of another Workspace is `WorkspaceMismatch`; a folder must belong to the named Engagement. One local Engagement per service Engagement (unique `service_engagement_id`). Period dates are `YYYY-MM-DD`, end not before start; names and titles 1–200 characters; objectives and scope up to 4,000 (may be empty).
  - **Adapter:** migration `0002_engagements_folders_tasks.sql` (0001 untouched); the Story 1.4 `store_info` is initialized when the app-server first opens the store.
  - **Host:** eleven stable methods: `inquello/session/setPrincipal`, `inquello/workspace/list|remember|tree`, `inquello/engagement/create|update`, `inquello/folder/create`, `inquello/task/create|rename|move|attachThread`, in one `global("inquello")` serialization queue. The principal is bound **per connection** and unbound when the connection closes. `codex-app-server` takes `INQUELLO_WORKING_STORE` out of its own environment at startup, so no tool or child the runtime starts can learn the path; the store opens lazily and is refused inside `CODEX_HOME`. Refusals are JSON-RPC errors with `data.inquello.kind` (and `expected`/`actual` for a revision conflict). The vendored schema fixtures and precomputed exports were regenerated so `generate-ts` emits the new types.
  - **Desktop main (`src/main/organise/`):** `OrganiseService` binds the principal before every call (and after sign-in, sign-out and runtime restart), lists Workspaces from the service (remembering their names) or, when the service is down or not configured, from the store, and refuses a tree for a Workspace not in that list. Engagement creation: Story 1.11 `create_engagement` envelope (command epoch from capabilities, `expected_revision` 0) under the renderer's operation ID, then `inquello/engagement/create` with the same ID; a local failure after the service step is reported as `incomplete`, and the renderer keeps the operation ID so the retry replays the service receipt. `attachThread` is main-only (no preload operation). Eight `organise.*` operations with strict validators (UUIDs, bounded text, no principal or path key). The service client gains `workspaces`, `workspaceCommand` and `acceptInvite`; `ServiceError` carries the refusal `reason`; `identity/wire.ts` mirrors every Story 1.11 Workspace fixture (closing that deferred item). `IdentitySession` gains `principalId()` and `withAccess()`.
  - **Renderer (`src/renderer/Shell/`):** `App` shows the Shell, or the design specimen at `#specimen` (a hash change is in-page, so nothing is blocked). Sidebar: Workspace selector (Menu radio group), New thread (untitled ad hoc Task, opened), New Engagement form (name, objectives, scope, client or entity, period start and end; disabled with main's reason while the service is down), per-Engagement New folder and New Task, folders with New Task, ad hoc Tasks, and a Design specimen link. Header: title, Private to you, client, period, Workspace (client and period absent for an ad hoc Task). Task view: placeholder thread area, Rename (a stale revision shows the conflict and keeps the draft) and a Move menu (no Engagement, each Engagement, each folder). No Share control.
  - **Data policy:** `working-store` (`user-data` root, `working/*.sqlite*`), enabled, creator-owned, kept until deleted, export included, access `runtime`.
  - **Dev topology:** `--seed-workspace NAME --seed-out FILE` (test-issuer only) creates the Workspace and the synthetic subject's first-administrator invite through `admin::create_workspace`. The smoke reads the seed from `INQUELLO_SMOKE_SEED`, signs in, accepts the invite, and drives the Shell.
  - **Smoke:** main loads `index.html#specimen` in `--smoke` so the earlier probes read the specimen unchanged; the `organise` probe then switches to `#shell`. The smoke clears `<userData>/working` at start.
  - **Engine build on this machine:** the disk filled during the first app-server build (only about 11G free after the cache). `target/debug/incremental` and superseded build artefacts were removed (build cache only) and builds ran with `CARGO_INCREMENTAL=0`.
- **Results (2026-10-29):**
  - Engine: `inquello-domain` (15 new organise unit tests; all lib and integration tests pass), `inquello-adapters` (6 new organise tests, 24 in all), `codex-app-server` inquello processor (6 tests) and `codex-app-server-protocol` (317 lib tests, schema fixtures included) pass. Clippy `-D warnings` is clean on `inquello-domain`, `inquello-adapters`, `inquello-service` (with `test-issuer`) and on the new app-server code; `codex-app-server` still fails `-D warnings` on one pre-existing upstream `let_and_return` in `message_processor.rs` (unchanged code, flagged by clippy 1.99). Rustfmt is clean on every changed file. `cargo build --locked -j 4 -p codex-cli -p codex-app-server` passes and leaves `Cargo.lock` as committed.
  - Desktop: `pnpm generate:protocol` emits the 24 `Inquello*` types; both `tsc` checks (and the renderer config) are clean; `pnpm test` with `INQUELLO_TEST_DATABASE_URL` passes 761 tests (43 new, including the 6-test real-runtime and dev-topology integration suite).
  - Keyring smoke as `smoke` with the seeded dev topology: exit 0; every report ok, and `organise.ok: true` (Engagement, folder and Task created through the Sidebar; Header showed `Untitled thread`, `Synthetic Client Ltd`, `2026-01-01 – 2026-12-31`, `Synthetic Audit Co`; the move kept the Task ID, the `smoke-thread-1` ref and empty references, private; a second principal listed 0 Tasks). Without the topology the smoke also exits 0 with `organise.ok: true` (signed-out Shell).
  - Step-04 review was skipped by owner rule.

## Verification

**Commands:**
- In `engine/codex-rs`: `cargo test -j 4` for `inquello-domain`, `inquello-adapters` and `codex-app-server` (the inquello tests), clippy `-D warnings` and fmt on the changed crates, then `cargo build --locked -j 4 -p codex-cli -p codex-app-server` -- expected: pass, clean, no lock rewrite
- In `desktop/`: `pnpm generate:protocol` (expected: the new types appear), both `tsc` checks and `pnpm test` with `INQUELLO_TEST_DATABASE_URL` -- expected: all pass
- Keyring smoke with the dev topology -- expected: exit 0, with `organise.ok: true`
