---
title: 'Story 1.19: Bound initial tool reads, writes and network access'
type: 'feature'
created: '2026-10-29'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-12-govern-local-data-held-by-first-route.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-18-inspect-effective-managed-policy.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The effective policy (Story 1.18) says how far a Task may reach, but nothing turns it into concrete readable paths, writable paths and network destinations. Nothing proves the runtime enforces them, and nothing explains them in plain words (FR-33, C65, AD-5, AD-8, OQ-13).

**Approach:** Derive one permission profile per Task from the effective policy and the Task's broad mode:
- a private per-Task working folder with an `output` subfolder;
- read-only system locations that tools need in order to run;
- an admin-listed set of network domains.

Apply the profile through the inherited Codex local sandbox and network proxy, using only `effectiveThreadSettings` and its new profile companion. Prove enforcement on synthetic paths and destinations through the runtime's existing `command/exec`. Explain the profile on the Task and in S07, and report denials with the boundary or destination named.

**Owner decisions (2026-10-29):**
- **Locations:** a private per-Task folder, with an `output` subfolder, inside Inquello's own local data area (already governed by the Story 1.12 register). Tools read and write only there, plus read-only system locations they need. Nothing else on the device is reachable.
- **Network:** denied by default. Workspace administrators list allowed domains in the Story 1.18 execution policy. Any other destination is blocked and reported by name.

## Boundaries & Constraints

**Always:**
- **Task folder:**
  - Created on first use, under the runtime data area and recorded in `data-policy.json`. Private to the creator.
  - Included in export and removed by delete (Story 1.12).
  - Its absolute path never appears in user-facing text; it is shown as "This Task's working folder" and "Output folder".
- **Profile derivation:** a pure function in `inquello-domain`, from the effective policy, the broad mode and the Task folder.
  - **Standard:**
    - read and write the Task folder and its `output` folder;
    - read the minimal system set required to execute;
    - nothing else.
  - **`read_only` ceiling:** the Task folder becomes read-only, and `output` stays writable only if the policy allows writes.
  - **`full_access` broad mode** (when permitted): the profile states its true reach (no filesystem limits) instead of pretending to be bounded.
  - **Network:** the policy's `allowed_domains` (a new optional list in the `execution` section, validated as host or wildcard patterns, with no schemes, ports or paths). Absent or empty means no network.
- **Single application path:** `effectiveThreadSettings(taskId)` also returns the profile in the runtime's own permission-profile form (sandbox policy, writable roots, network allowlist). Story 1.25 starts threads only through it. In this story, `command/exec` is called only through the same path, for verification and the smoke.
- **Denials:**
  - A filesystem denial reports "Blocked: outside this Task's permitted locations" with the boundary named ("working folder (read/write)", "output folder", "system (read-only)").
  - A network denial reports "Blocked: <destination> is not on this Workspace's allowed list".
  - Reports are the runtime's own results translated, never invented. If the runtime gives no attributable reason, the text says "Blocked by the local sandbox" and nothing more specific.
- **Escalation:** where the approval behaviour would ask, the escalation is surfaced as a pending authorization request for Story 1.20, and in this story it is declined with the boundary named. A denied operation never ends the Task or discards earlier outputs; later permitted operations still work.
- **Explanation:** the Task view and S07 show the reach in plain words: what the Task can read, where it can write, and which destinations it can contact, with no sandbox syntax. The Capability Contract records "Execution sandbox: local OS sandbox on this device; no hosted sandbox — V2 revisit (OQ-13)".
- **Platform honesty:**
  - If the local sandbox cannot be applied on this device (for example, user namespaces are unavailable), the Task shows "Local sandbox unavailable on this device", and execution is refused rather than run unsandboxed.
  - A permitted `full_access` broad mode is the only unsandboxed path.

**Never:**
- No model runs (Story 1.25).
- No evidence or source attachment (Epic 2).
- No hosted sandbox.
- No unsandboxed fallback.
- No absolute paths in user-facing text.
- No new installs or dependencies: use the bubblewrap bundled with the engine. If enforcement cannot run in the build environment, stop and report rather than install anything.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Write inside | Exec writes `output/a.txt` | Succeeds; file exists | N/A |
| Write outside | Exec writes a synthetic path outside the Task folder | Denied; "outside this Task's permitted locations" | Boundary named |
| Read outside | Exec reads another Task's folder | Denied | Boundary named |
| Read-only ceiling | Policy `read_only`, exec writes the Task folder | Denied | Boundary named |
| Network allowed | `allowed_domains` includes the destination | Reachable, or the runtime reports a proxy pass | N/A |
| Network blocked | Unlisted destination | Blocked; destination named | N/A |
| No list | No `allowed_domains` | All tool network blocked | Destination named |
| Escalation | Approval behaviour would ask | Pending authorization request, declined in this story; boundary named | N/A |
| Continue | Denied op, then permitted op | Second succeeds; earlier output retained | N/A |
| Full access | Permitted broad mode | Profile shows "No filesystem limits"; never shown as bounded | N/A |
| Sandbox missing | Platform cannot sandbox | "Local sandbox unavailable"; exec refused | No unsandboxed run |
| Bad domain | Scheme, port or path in `allowed_domains` | Policy refused | Validation error |
| Delete | Task data deleted via Story 1.12 | Task folder removed | N/A |

</frozen-after-approval>

## Code Map

- `engine/codex-rs/inquello-domain/src/execution_policy/` -- profile derivation and `allowed_domains`.
- `engine/codex-rs/inquello-domain/src/authorization/policy.rs` -- validation of the `execution.allowed_domains` field.
- `engine/codex-rs/inquello-domain/src/capability/` -- the OQ-13 sandbox entry.
- `engine/codex-rs/app-server` inquello processor -- profile in runtime form, if it is computed engine-side. `command/exec` already exists upstream; the network proxy and bundled bubblewrap are upstream crates.
- `desktop/src/main/policy/` -- `effectiveThreadSettings` profile, the Task folder lifecycle, and denial translation.
- `desktop/data-policy.json` and `desktop/src/main/data/` -- register the Task folder, plus export and delete.
- `desktop/src/renderer/` -- the reach explanation on the Task and in S07.
- `desktop/src/main/smoke-probe.ts` -- a `tool-bounds` report.

## Tasks & Acceptance

**Execution:**
- [x] Domain profile derivation, the `allowed_domains` policy field and validation, and the capability entry, with tests.
- [x] Task folder lifecycle and its data-register entry, with export and delete.
- [x] Profile applied through `effectiveThreadSettings`, plus `command/exec` integration tests for every filesystem and network row, against the real runtime and the local sandbox.
- [x] Denial and escalation translation, the reach explanation UI, and jsdom tests.
- [x] FORK-CUT patch entry if the engine changes, plus the regenerated protocol and stamp.
- [x] Smoke `tool-bounds` report, with the default seed:
  - an exec write inside `output` succeeds;
  - a write outside is denied with the boundary named;
  - an unlisted destination is blocked and named;
  - the Task shows its reach in plain words;
  - S07 shows the OQ-13 entry.
- [x] `sprint-status.yaml` (1-19).

**Acceptance Criteria:**
- Given the smoke with the seeded topology, when it runs, then `tool-bounds` and every earlier report are ok, and it exits 0.

## Implementation Notes

- **As built:**
  - **Domain (`inquello-domain/src/execution_policy/`):** `allowed_domains` in the `execution` section (`section.rs`): lowercase host names, optionally after `*.` (subdomains) or `**.` (domain and subdomains); a scheme, port, path, user, query, whitespace, uppercase, the bare `*` or a one-label wildcard is refused with `PolicyError::InvalidExecution`; at most 100 patterns, no duplicates; a non-empty list needs `network: "allowed"`. `EffectivePolicy.allowed_domains` is the list while the effective network setting is allowed, otherwise empty (attributed to the rule that denied network). `profile.rs` holds the only derivation, `tool_profile(policy, status, TaskFolder)`, which agrees with `thread_settings` by construction: Standard and No prompt are bounded (working folder and `output` folder read/write, or read only under a `read_only` ceiling; system read only; the listed destinations); a permitted Full access mode is unbounded and claims no boundary. `TaskFolder` must be absolute, without `.`/`..`, and named after the Task. `Boundary::label` gives "working folder (read/write)", "working folder (read-only)", "output folder", "output folder (read-only)" and "system (read-only)". Register entry `execution_sandbox` (`synthetic-only`, synthetic evidence `desktop/test/tool-bounds-integration.test.ts` and the smoke), first limit "Execution sandbox: local OS sandbox on this device; no hosted sandbox — V2 revisit (OQ-13)". The C65 inventory row stays `planned` (later stories realise the rest).
  - **Host (FORK-CUT Patch 11):** `inquello/policy/effective` takes an optional `taskFolder` and returns the Workspace's standard `reach`, the Task's `reach` and, with the folder, its `runtimeProfile` (`permission-profile` with id `inquello-task-<taskId>`, the `[permissions.<id>]` table, readable and writable roots and the network allowlist; or `danger-full-access`). `inquello/tools/exec {workspacePolicy, taskId, taskFolder, command, timeoutMs}` derives the profile again from the same inputs (creator only, the Task's own Workspace, the folder must exist: `task_folder_missing`), writes `features.network_proxy = true`, `default_permissions = ":read-only"` and the permissions table through the runtime's own configuration writer, and runs the command through the runtime's own `command/exec` with `permissionProfile` and `cwd` = the Task folder; its response is the runtime's `CommandExecResponse`. The table grants `:minimal` (the runtime's system set: `/bin`, `/sbin`, `/usr`, `/etc`, `/lib`, `/lib64` on Linux) and the runtime's own executable read only, the Task folders as derived, and `network.enabled` with only the listed domains through the proxy.
  - **Desktop main (`src/main/policy/`):** `tools.ts` (Task folder paths and `ensureTaskFolder`, mode 0700, `<userData>/tasks/<taskId>/output`; `translateDenials`; `EscalationGate`). `PolicyService.effectiveThreadSettings(taskId)` now creates the Task folder on first use and returns the thread settings plus `profile` (runtime form), `folders` and `reach`; it stays main only. `runTool(taskId, command)` goes through it, refuses `sandbox-unavailable` when the sandbox check fails, runs `inquello/tools/exec` and returns the exit code, output and translated denials (main only). The sandbox check runs once per runtime process: a bounded probe through the Task's own profile must not see the working store's folder. `forTask` adds the plain-word `reach` and `sandbox` ("Local OS sandbox on this device.", "Local sandbox unavailable on this device", or "Full access runs without the local sandbox on this device."). The RPC connection answers server requests through `onServerRequest`; main wires the escalation gate there. `config.ts` writes `features.network_proxy = true`. `data-policy.json` gains `task-folders` (user-data `tasks/**`, runtime access, export included, deleted through Local data); delete also removes the empty directories a deleted `/**` category leaves, so an unused Task folder goes too.
  - **Denials** (the runtime's own results, translated): the proxy's blocked JSON body (`{"status":"blocked","host":…}`) or a `CONNECT host` refused with `x-proxy-error: blocked-by-…` gives "Blocked: <host> is not on this Workspace's allowed list"; `Read-only file system` gives "Blocked: outside this Task's permitted locations. Boundary: system (read-only)." (or the read-only Task boundary); a path the sandbox hides although it (or its folder) exists on this device, or `Operation not permitted`, gives the same text with the permitted boundaries ("working folder (read/write), output folder, system (read-only)"); a sandbox error with nothing attributable (`bwrap:` failures, a 403 CONNECT with no host) gives "Blocked by the local sandbox". Genuinely missing files and host `Permission denied` outside the Task folder are not reported as denials.
  - **Escalation:** `item/commandExecution/requestApproval`, `item/fileChange/requestApproval` (`decline`), `item/permissions/requestApproval` (no permissions, turn scope) and the legacy `execCommandApproval`/`applyPatchApproval` (`denied` with the reason) are recorded as pending authorization requests (`status: declined`, the reason naming the destination for a network request, the Task's boundary when its thread is known, otherwise "Blocked by the local sandbox"). Threads are not attached to Tasks before Story 1.25, so the boundary resolver is not wired yet.
  - **Renderer:** the Task view's "What this Task's tools can reach" (Can read, Can write to, Can contact, the rule that sets the destinations, and the sandbox line) and, per Workspace in S07, "What a Task's tools can reach"; the Capability Contract lists "Execution sandbox" with "Local OS sandbox on this device; no hosted sandbox — V2 revisit (OQ-13)" (`data-enabled="true"`, the only entry the bridge accepts as enabled). No path, sandbox syntax or approval wording.
  - **Smoke:** a `tool-bounds` report after `policy`, with the default seed.
- **Deviations and interpretations:**
  - The stable `command/exec` cannot take a permission profile (the field is experimental and the desktop stays on the stable schema), and its `sandboxPolicy` cannot restrict reads. So `command/exec` is reached through the new `inquello/tools/exec`, which builds the runtime's own `CommandExecParams` in the engine and calls the existing command execution processor; main never calls `command/exec` directly.
  - A named permissions profile has to exist in the runtime's configuration, so each run writes it through the runtime's own writer into the Inquello-owned `config.toml` (rewritten in full at every start). Without `features.network_proxy` a profile's network bypassed the proxy (verified), so it is written with every bounded profile. Once named profiles exist the runtime refuses to load configuration without `default_permissions`, so `:read-only`, the most restrictive built-in, is written too; Story 1.18 reads `sandbox_mode`, not this key.
  - Read-only ceiling: the policy then allows no writes, so the `output` folder is read only as well ("output stays writable only if the policy allows writes").
  - With no `allowed_domains` the profile still enables network through the proxy with an empty allowlist, so every destination is blocked and named by the proxy rather than failing name resolution.
  - The sandbox root is the runtime's private in-memory filesystem: a write to a path whose folder is not mounted (for example `/tmp/x`) succeeds there and vanishes with the command; nothing on this device changes and nothing is reported. Paths that exist on the device outside the profile are not visible and are reported as denials.
  - The runtime also mounts its own helper aliases (`<runtime home>/tmp/arg0-linux/…`) and its executable read only, so the sandbox check targets the working store's folder rather than the runtime home.
  - The sandbox check creates the Task's folder when the Task is first opened (the Task view shows whether the sandbox applies); a Task in a permitted Full access mode is not checked.
  - Bubblewrap: the runtime uses the bundled `bwrap` built beside `codex-app-server` (`cargo build -p codex-bwrap`); the Electron packaging must ship it beside the app-server binary. Not done in this story.
- **Results (2026-10-29):**
  - Engine: `inquello-domain` 94 lib tests (10 new) and `capability_register` 16 (1 new; the seed test now expects the two synthetic entries); app-server inquello processor 13 (3 new); `codex-app-server-protocol` 317 lib tests (schema fixtures regenerated, 1 ignored); `inquello-service` with the database (memberships 14, identity 20, topology 9, lib 8) pass. Clippy `-D warnings` clean on `inquello-domain`; `codex-app-server` shows only the pre-existing upstream `let_and_return`. Both builds pass separately; `Cargo.lock` unchanged.
  - Desktop: `pnpm generate:protocol` emits 799 files (4 new types); `pnpm run build` is clean; `pnpm test` with the database passes 919 tests (21 new), including `tool-bounds-integration.test.ts` against the real runtime, the bundled bubblewrap and the proxy: write inside, write into another Task's folder, a system write, reading another Task's file, no list, a listed destination, the `read_only` ceiling, continue after denials, Full access unbounded, and refusal when the sandbox check fails.
  - Keyring smoke with the seeded topology as the `smoke` user: exit 0; all earlier reports and `tool-bounds` ok. The `tool-bounds` report: bounded profile, two writable folders, empty allowlist, private folder in the data area; `printf > output/a.txt` exit 0 and the file exists; a write into another Task's folder exit 2, "Blocked: outside this Task's permitted locations. Boundary: working folder (read/write), output folder, system (read-only)." and nothing written; `/etc` write exit 2, "Blocked: outside this Task's permitted locations. Boundary: system (read-only)."; reading another Task's file exit 1 with the same outside text; `curl http://example.com/` "Blocked: example.com is not on this Workspace's allowed list"; a later permitted command exit 0 with the earlier output; the Task shows "Can read …", "Can write to This Task's working folder and Output folder only.", "Can contact No network destinations. Every destination is blocked." and "Local OS sandbox on this device."; S07 lists "Execution sandbox" with the OQ-13 text; no device path and no approval wording shown.
  - Not verified: macOS (seatbelt) and Windows sandboxes; on those the same path runs, and a failed sandbox check refuses execution. Real network reachability of an allowed destination depends on the device's network; the tests assert only that the proxy did not block it.
  - Step-04 review was skipped by owner rule.

## Verification

**Commands:**
- In `engine/codex-rs` (`-j 4`, `CARGO_INCREMENTAL=0`): the changed crates' tests, clippy and fmt; the two binary builds run separately -- expected: pass, clean
- In `desktop/`: `pnpm generate:protocol` (if the engine changed), `pnpm run build`, `pnpm test` with the database URL -- expected: all pass
- Keyring smoke with the seeded topology -- expected: exit 0, all reports ok
