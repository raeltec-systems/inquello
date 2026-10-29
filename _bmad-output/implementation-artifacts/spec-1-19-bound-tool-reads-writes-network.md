---
title: 'Story 1.19: Bound initial tool reads, writes and network access'
type: 'feature'
created: '2026-10-29'
status: 'in-progress'
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
- [ ] Domain profile derivation, the `allowed_domains` policy field and validation, and the capability entry, with tests.
- [ ] Task folder lifecycle and its data-register entry, with export and delete.
- [ ] Profile applied through `effectiveThreadSettings`, plus `command/exec` integration tests for every filesystem and network row, against the real runtime and the local sandbox.
- [ ] Denial and escalation translation, the reach explanation UI, and jsdom tests.
- [ ] FORK-CUT patch entry if the engine changes, plus the regenerated protocol and stamp.
- [ ] Smoke `tool-bounds` report, with the default seed:
  - an exec write inside `output` succeeds;
  - a write outside is denied with the boundary named;
  - an unlisted destination is blocked and named;
  - the Task shows its reach in plain words;
  - S07 shows the OQ-13 entry.
- [ ] `sprint-status.yaml` (1-19).

**Acceptance Criteria:**
- Given the smoke with the seeded topology, when it runs, then `tool-bounds` and every earlier report are ok, and it exits 0.

## Verification

**Commands:**
- In `engine/codex-rs` (`-j 4`, `CARGO_INCREMENTAL=0`): the changed crates' tests, clippy and fmt; the two binary builds run separately -- expected: pass, clean
- In `desktop/`: `pnpm generate:protocol` (if the engine changed), `pnpm run build`, `pnpm test` with the database URL -- expected: all pass
- Keyring smoke with the seeded topology -- expected: exit 0, all reports ok
