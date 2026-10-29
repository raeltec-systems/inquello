---
title: 'Story 1.18: Inspect effective managed policy and explicit broader modes'
type: 'feature'
created: '2026-10-29'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-11-enforce-internal-company-memberships.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-15-distinguish-execution-checks-review-delivery-states.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-16-navigate-desktop-shell-keyboard-responsive.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nothing computes or shows which execution, tool, extension and approval rules govern a Task. A broader mode (no-prompt or full access) could be turned on silently, or mistaken for review or approval (FR-33, C67, C68, C70, AD-8, UX-DR40).

**Approach:** Combine three layers into one effective policy per Task and environment, computed in `inquello-domain`. Every restricted setting names the rule that governs it. The layers are:
- the **Workspace execution policy**, stored on the shared service as part of the Story 1.11 Workspace policy and set by administrators;
- the **device-managed Codex requirements**, set by IT and read through the runtime's existing `configRequirements/read`;
- the user's own configuration.

Show the result in S07 ("Capabilities and processing" in Settings) and on the Task. A broader mode is an explicit per-Task choice, allowed only when the effective policy permits it, and is always labelled with its reach, never as review or approval. The Capability Contract lists prompt inspection and specialist cyber access as not enabled.

**Owner decisions (2026-10-29):**
- **Policy source:** the Workspace policy on the shared service plus any device-managed Codex requirements. The stricter rule wins, and each restriction names its source.
- **Broad mode:** turned on per Task through an explicit, labelled confirmation, shown on that Task, ending with the Task, and never a global or per-user default.

## Boundaries & Constraints

**Always:**
- **Workspace execution policy:** a new optional `execution` section in the validated Workspace policy document, changed by administrators through the existing policy update (Story 1.11 receipts, revision and authorization epoch). It covers:
  - the sandbox ceiling: `read_only`, `workspace_write` or `full_access`;
  - the allowed approval behaviours: `on_request` or `untrusted`, plus `never`, meaning no-prompt;
  - network access in the sandbox: allowed or denied;
  - MCP and connector tools: allowed or denied;
  - plugins and extensions: allowed or denied;
  - `allow_full_access` and `allow_no_prompt`, both defaulting to false.

  If the section is absent, the conservative Inquello default applies: `workspace_write`, on-request approval, network denied, tools and extensions denied, and no broad modes. Unknown fields and external-audit attributes are refused, as Story 1.11 already does.
- **Device layer:** the managed requirements reported by the runtime's `configRequirements/read`, which covers allowed sandbox modes and approval policies. If none are configured, the device layer reads "None configured on this device".
- **User layer:** the user's runtime configuration, applied only where it is stricter than both the Workspace and device layers.
- **Effective computation:** a pure function in the domain.
  - For each setting, the most restrictive value wins.
  - Each output setting carries `{value, source: workspace_policy(revision) | device_requirements | user_config | inquello_default, restricted: bool}`.
  - The environment is always "Local device" in V1 (OQ-13).
  - The result is recomputed when a Task is opened, when the Workspace policy revision or authorization epoch changes, and when the device requirements change.
- **Broad mode per Task:** stored as a Task-scoped, versioned record in the working store, using operation IDs, expected revision and receipts, readable and writable only by the creator. Its values are `standard`, `no_prompt` and `full_access`.
  - Setting a non-standard value requires:
    - a human actor;
    - an explicit confirmation step in the UI that names the reach (for example, "Full access: commands on this Task run without sandbox limits on this device, and you will not be asked before actions.");
    - an effective policy that permits it.

    Otherwise it is refused with `broad_mode_not_permitted`, naming the governing rule.
  - If a later policy no longer permits the mode, it shows as "Suspended by policy" and the effective mode falls back to standard. It is never silently kept.
  - The mode is labelled "Broader execution mode" with its reach, never review, approval, Professional Approval or acceptance, and it uses no green or approved chip.
- **Single source for runs:** an `effectiveThreadSettings(taskId)` path in main returns the sandbox and approval settings derived only from the effective policy and the Task's broad mode. Story 1.25 must start threads only through it. This story adds no other way to set them.
- **S07 and the Task:**
  - **S07** shows, for each setting, the effective value and its governing source in plain words (for example, "Restricted by Workspace policy, revision 4" or "Set by this device's managed requirements").
  - **Task view** shows a compact policy summary and, if set, the broad mode with its reach.
  - **Unavailable actions** state which rule prevents them.
- **Capability Contract:** add `prompt_inspection` and `specialist_cyber_access` to the capability register as not enabled, with "Eligibility verification required before enablement", and show both in S07.
- **Host methods:** new `inquello/*` app-server methods for:
  - computing the effective policy, given the Workspace policy that main fetched from the service and the runtime's own device requirements and user configuration;
  - reading and setting the Task's broad mode.

  Record these as FORK-CUT "Patch 10", then regenerate the protocol and the stamp.

**Never:**
- No real runs or thread start (Story 1.25).
- No global or per-user broad-mode default.
- No approval or review language for broad modes.
- No enabling of prompt inspection or cyber access.
- No hosted sandbox (OQ-13).
- No new dependencies.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No policy | Workspace has no `execution` section, no device requirements | Inquello defaults; source "Inquello default"; broad modes unavailable | N/A |
| Workspace restricts | `execution.sandbox = read_only` | Effective read_only; "Restricted by Workspace policy, revision N" | N/A |
| Device stricter | Workspace allows full_access, device allows only workspace_write | Effective workspace_write; source device requirements | N/A |
| User stricter | User config read_only, policy allows more | Effective read_only; source user configuration | N/A |
| Broad mode allowed | `allow_full_access = true`, user confirms | Task shows "Full access" with its reach; no approval wording | N/A |
| Broad mode refused | Not permitted | Refused | `broad_mode_not_permitted` + governing rule |
| No confirmation | Request without the confirmation step | Refused | Validation |
| Policy tightened | Broad mode set, then policy revision forbids it | "Suspended by policy"; effective standard | N/A |
| Non-admin edit | Member updates execution policy | Refused | Story 1.11 authorization error |
| Bad policy | Unknown field or external-audit attribute in `execution` | Refused | Policy validation error |
| Other creator | Second principal reads or sets a Task's broad mode | Refused like an unknown Task | No disclosure |
| Capability Contract | Read S07 | Prompt inspection and cyber access "Not enabled — eligibility verification required" | N/A |
| Thread settings | `effectiveThreadSettings(taskId)` | Derived only from the effective policy and broad mode | N/A |

</frozen-after-approval>

## Code Map

- `engine/codex-rs/inquello-domain/src/authorization/policy.rs` -- the Workspace policy document; add the `execution` section and its validation.
- `engine/codex-rs/inquello-domain/src/` -- a new `execution_policy` module (effective computation and broad-mode rules); `capability/register.rs` (two entries).
- `engine/codex-rs/inquello-service/` -- policy update and read already carry the document; extend tests.
- `engine/codex-rs/inquello-adapters/` -- migration `0004` for the broad-mode record.
- `engine/codex-rs/app-server/src/request_processors/inquello_processor.rs` and `app-server-protocol` -- the new methods; `configRequirements/read` already exists upstream.
- `desktop/src/main/` -- fetch the Workspace policy, mediate, `effectiveThreadSettings`, and preload operations.
- `desktop/src/renderer/` -- the S07 section in Settings, plus the Task summary and the broad-mode confirmation.
- `engine/codex-rs/inquello-service/src/bin/inquello-dev-topology.rs` -- optional seeding of an execution policy, for tests.
- `desktop/src/main/smoke-probe.ts` -- a `policy` report.

## Tasks & Acceptance

**Execution:**
- [x] Domain: the policy section, the effective computation, the broad-mode rules and the capability entries, with tests for every matrix row.
- [x] Service: policy-update tests for `execution` (administrator only, validation, revision and epoch). Adapters: migration 0004 and race tests.
- [x] App-server methods (FORK-CUT Patch 10), the regenerated protocol and stamp, and processor tests.
- [x] Desktop main: policy fetch, mediation, `effectiveThreadSettings`, preload operations, the S07 section, the Task summary, the confirmation dialog, and jsdom tests.
- [x] Smoke `policy` report, with the default seed:
  - S07 shows Inquello defaults with their sources;
  - prompt inspection and cyber access show as not enabled;
  - a full-access request is refused with the governing rule;
  - no approval wording appears.
  The permitted path is covered by integration tests using a seeded permissive policy.
- [x] `sprint-status.yaml` (1-18).

**Acceptance Criteria:**
- Given the smoke with the seeded topology, when it runs, then `policy` and every earlier report are ok, and it exits 0.

## Implementation Notes

- **As built:**
  - **Domain (`inquello-domain/src/execution_policy/`):** `ExecutionPolicy` (the optional `execution` section; every field optional, an absent field takes the Inquello default and is attributed to it), `effective_policy` over `WorkspaceLayer`, `DeviceRequirements` and `UserConfig` (strictest value wins, ties name the earlier layer: Workspace, then device, then user), `Setting { value, source, restricted }` with `SettingSource` (`workspace_policy` with revision, `device_requirements`, `user_config`, `inquello_default`), `Environment::LocalDevice`. Broad modes: `BroadMode` with fixed titles and reach statements, `set_broad_mode` and the creator-only `task_broad_mode` (Story 1.15 pattern: validate, replay, creator check, Workspace match, permission, revision, commit, R10 re-lookup), `BroadModeStatus` (`Standard`, `Active`, `Suspended { rule }`) and `thread_settings`. `DomainError::BroadModeNotPermitted { rule }` and `PolicyError::InvalidExecution`. Register entries `prompt_inspection` and `specialist_cyber_access` (`disabled`, no evidence, limit "Eligibility verification required before enablement"); the C67 and C68 inventory rows stay `planned`.
  - **Section document:** `{"sandbox": "read_only|workspace_write|full_access", "approvals": ["untrusted", "on_request", "never"], "network": "allowed|denied", "mcp_tools": …, "extensions": …, "allow_full_access": bool, "allow_no_prompt": bool}`.
  - **Adapter:** migration `0004_task_broad_modes.sql` and `src/broad_modes.rs` (schema refuses a non-human broader mode).
  - **Service:** `GET /v1/workspaces/{id}/execution-policy` (members only) returns `{workspace_id, policy_revision, authorization_epoch, execution | null}` (`inquello-protocol` `ExecutionPolicyView`, fixture `workspace/execution_policy_view.json`). The policy is changed only through the operator `update_policy` (Story 1.11 revision, epoch and receipt). `inquello-dev-topology --seed-execution FILE` adds a section to the seeded policy.
  - **Host (FORK-CUT Patch 10):** `inquello/policy/effective {workspacePolicy, taskId?}`, `inquello/broadMode/read {taskId}` (also returns the Task's Workspace), `inquello/broadMode/set {operationId, expectedRevision, taskId, mode, confirmation, actorKind, actorRef, workspacePolicy}`. The dispatch reads the device layer from the runtime's own `configRequirements/read` (allowed sandbox modes and approval policies) and the user layer from the `User` layers of `config/read` with layers (`sandbox_mode`, `approval_policy`, `sandbox_workspace_write.network_access`). Refusal `broad_mode_not_permitted` carries `rule` and `revision`. The response also lists the two Capability Contract entries from the compiled register.
  - **Desktop main (`src/main/policy/`):** `PolicyService.settings` (S07, one entry per Workspace), `forTask`, `setBroadMode` (actor `human`, the bound principal) and the main-only `effectiveThreadSettings(taskId)`, which no preload operation reaches. The Workspace policy is fetched from the service on every read, so a new revision or epoch shows on the next open or refresh; if it cannot be read nothing is computed (fail closed). Operations `policy.getSettings`, `policy.forTask`, `policy.setBroadMode`; the validator accepts exactly `{operationId, taskId, expectedRevision, mode, confirmation}` and a broader mode only with its exact reach statement. Main supplies all text: "Restricted by Workspace policy, revision N", "Set by this device's managed requirements", "Restricted by your runtime configuration", "Inquello default", "None configured on this device", "Full access is not available: not permitted by …", "Suspended by policy: … This Task runs in Standard mode."
  - **Renderer:** `Capabilities.tsx` (Settings, "Capabilities and processing": environment, each Workspace's settings with their sources, the device layer and the Capability Contract) and `Shell/TaskPolicy.tsx` in the Task view (summary of sandbox, asking and network; "Broader execution mode" with a neutral custom-label StatusChip; unavailable modes stay focusable with their rule as the disabled reason; a permitted mode opens an inline `alertdialog` stating its reach, and only its "Turn on …" button sets it; Escape cancels; "Return to Standard"). `policy-bridge.ts` parses defensively and refuses an enabled contract entry. The Shell reads the Task policy on open and on each refresh.
  - **Smoke:** a `policy` report after `composer`, with the default seed.
- **Deviations and interpretations:**
  - `inquello-protocol` gained a wire type and fixture, and the service a read route; main needs both to fetch the Workspace policy. These are additions only.
  - Validation couples the broad-mode flags to their prerequisites: `allow_no_prompt` needs `never` among the approvals; `allow_full_access` needs the `full_access` ceiling, `allow_no_prompt` and network allowed (full access follows the spec's reach text: no sandbox limits and no asking). `approvals` must include a prompting behaviour.
  - The user's own configuration narrows the standard settings but does not forbid a broader mode: the broader mode is that user's explicit per-Task choice. The Workspace policy and the device requirements both govern it.
  - Standard Tasks never run above `workspace_write`, whatever the ceiling. With no prompting behaviour left after the device layer, the standard behaviour fails closed to `untrusted`.
  - "Non-admin edit": no HTTP route changes a policy (operator CLI only, Story 1.11). The service test shows a member's and an administrator's `update_policy` command are both refused as an unknown command.
  - "Policy tightened" is covered in the domain, processor and integration tests by computing against a stricter Workspace layer; desktop tests cannot change a policy revision over HTTP.
  - The approval setting is labelled "Asking before actions" so that no approval wording appears in the policy UI.
  - Recomputation is on read (Task open, Shell refresh, S07 every 30 s); there is no push when device requirements change.
- **Results (2026-10-29):**
  - Engine: `inquello-domain` 84 lib tests (21 new) and `capability_register` 15 (1 new); `inquello-adapters` 51 (`broad_modes` 3 new, 4 new races in `concurrent_operations`); `inquello-service` with the database: `memberships` 14 (1 new), `identity` 20, `topology` 9, and the lib tests; `inquello-protocol` fixtures (extended with the new view) pass; app-server inquello processor 10 (2 new); `codex-app-server-protocol` 317 lib tests (schema fixtures, 1 ignored). Clippy `-D warnings` clean on `inquello-domain`, `inquello-adapters`, `inquello-protocol` and `inquello-service`; `codex-app-server` shows only the pre-existing upstream `let_and_return`. Both builds pass separately; `Cargo.lock` unchanged.
  - Desktop: `pnpm generate:protocol` emits the 14 new types (795 files); `pnpm run build` is clean; `pnpm test` with the database passes 898 tests (22 new, including `policy-integration.test.ts` against the real runtime and a topology seeded with a permissive policy: Full access set after confirmation, thread settings `danger-full-access`/`never`, replay, stale revision, suspension under a stricter layer, return to Standard, another principal `not_found`).
  - Keyring smoke with the seeded topology: exit 0; `renderer-privileges`, `design`, `identity`, `data`, `providers`, `organise`, `states`, `shell-layout`, `composer` and `policy` all ok. The `policy` report: S07 lists all seven settings with "Inquello default", "Device-managed requirements: None configured on this device", environment "Local device", prompt inspection and specialist cyber access "Not enabled — eligibility verification required"; the Task shows Standard, its Full access control is unavailable with "Full access is not available: not permitted by the Inquello default." and opens no confirmation; a confirmed Full access request through the renderer is refused `broad-mode-not-permitted` with that rule, and one without confirmation fails main's validator; `effectiveThreadSettings` gives `workspace-write`/`on-request`; no approval or review wording and no green or accepted chip.
  - Step-04 review was skipped by owner rule.

## Verification

**Commands:**
- In `engine/codex-rs` (`-j 4`, `CARGO_INCREMENTAL=0`): tests for `inquello-domain`, `inquello-adapters` and `inquello-service` (with the database URL), and the app-server inquello tests; clippy and fmt on the changed crates. Builds: `codex-cli` and `codex-app-server` together, then the topology separately -- expected: pass, clean
- In `desktop/`: `pnpm generate:protocol`, `pnpm run build`, `pnpm test` with the database URL -- expected: all pass
- Keyring smoke with the seeded topology -- expected: exit 0, all reports ok
