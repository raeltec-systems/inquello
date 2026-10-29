---
title: 'Story 1.18: Inspect effective managed policy and explicit broader modes'
type: 'feature'
created: '2026-10-29'
status: 'in-progress'
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
- [ ] Domain: the policy section, the effective computation, the broad-mode rules and the capability entries, with tests for every matrix row.
- [ ] Service: policy-update tests for `execution` (administrator only, validation, revision and epoch). Adapters: migration 0004 and race tests.
- [ ] App-server methods (FORK-CUT Patch 10), the regenerated protocol and stamp, and processor tests.
- [ ] Desktop main: policy fetch, mediation, `effectiveThreadSettings`, preload operations, the S07 section, the Task summary, the confirmation dialog, and jsdom tests.
- [ ] Smoke `policy` report, with the default seed:
  - S07 shows Inquello defaults with their sources;
  - prompt inspection and cyber access show as not enabled;
  - a full-access request is refused with the governing rule;
  - no approval wording appears.
  The permitted path is covered by integration tests using a seeded permissive policy.
- [ ] `sprint-status.yaml` (1-18).

**Acceptance Criteria:**
- Given the smoke with the seeded topology, when it runs, then `policy` and every earlier report are ok, and it exits 0.

## Verification

**Commands:**
- In `engine/codex-rs` (`-j 4`, `CARGO_INCREMENTAL=0`): tests for `inquello-domain`, `inquello-adapters` and `inquello-service` (with the database URL), and the app-server inquello tests; clippy and fmt on the changed crates. Builds: `codex-cli` and `codex-app-server` together, then the topology separately -- expected: pass, clean
- In `desktop/`: `pnpm generate:protocol`, `pnpm run build`, `pnpm test` with the database URL -- expected: all pass
- Keyring smoke with the seeded topology -- expected: exit 0, all reports ok
