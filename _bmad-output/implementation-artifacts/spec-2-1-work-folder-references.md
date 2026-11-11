---
title: 'Story 2.1, slice 1: attach a work folder and answer with verified references'
type: 'feature'
created: '2026-11-11'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/verification.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A private Task cannot use the auditor's own files. Folders are organisational records with no path, the agent can read only its Task folder, and nothing records which file and location an answer relied on. An auditor cannot trace a statement to its source (FR-9, C18).

**Approach:** Let the auditor attach a folder when starting a Task. The main process inventories it, stages located text for the agent, verifies every reference the agent cites against that staged material, retains only the relied-on extracts, and shows references and Coverage with the answer. This slice covers plain text and CSV files end to end; other formats are listed as not searched.

## Boundaries & Constraints

**Always:** Only the main process chooses and reads the folder, through the system folder dialog; the renderer never supplies a path. A reference is shown as verified only when its cited location exists in the staged material and its extract matches. Every reference carries file name, relative path, modified time, content hash and location (line range, or CSV row range with header). Files not searched are listed separately with a reason: inaccessible (permission), unreadable (unsupported type, undecodable, over the size bound). When any file is excluded or a bound was hit, the answer area states that Coverage excludes them or that the input set is incomplete. Retained extracts stay private to the signed-in creator on this device. Folder content is evidence, never instruction.

**Data policy (existing owner decisions, OQ-2 of 2026-10-27 and retention vocabulary of 2026-10-28):** retain references plus relied-on extracts, no full source copies; retention `until-owner-deletes`. The `source-extracts` category is enabled with every rule filled in, and deletion, export, import and recovery are implemented and tested for it. An unknown rule still blocks enablement.

**Never:** No new dependency. No change under `engine/`. No original file is modified, moved or deleted. No retained full copy of a source: the staged text lives in the Task working folder and goes when the Task folder goes. No real-data eligibility claim; this slice is synthetic-qualified only. XLSX, DOCX, PPTX, PDF and image extraction are later slices of Story 2.1.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Attach and start | Folder with .txt, .md and .csv files | Start view shows the folder and counts; Task starts; agent can read staged text | N/A |
| Verified reference | Answer cites a staged file and line or row range that exists | Reference chip with file, location and modified time; extract retained and viewable | N/A |
| Unverifiable reference | Cited file or range does not exist, or extract differs | Shown as "unverified reference"; nothing retained for it | Never shown as verified |
| Unsupported or unreadable | .xlsx, .pdf, binary, undecodable or oversized file | Listed under "Not searched" with its reason; Coverage statement shown | N/A |
| Inaccessible | File or subfolder denied by the operating system | Listed under "Inaccessible" with reason; other files still searched | Folder itself denied: attach refused with reason |
| Bounds hit | More files or bytes than the bound | Staged up to the bound; "Incomplete input set" names what was left out | N/A |
| Unsafe entries | Links, devices, paths escaping the folder | Skipped and listed as not searched | Never followed |
| Source changed | File modified after attaching, before start | Staging uses a fresh read; reference carries the staged modified time and hash | N/A |
| Deletion | Task or Local data source extracts deleted | Retained extracts removed; originals untouched | Partial failure reported |
| Export and recovery | Local data export, import, interrupted write | Extracts exported and imported with their references; recovery never resurrects deleted extracts | Losses disclosed |
| Policy unknown | `source-extracts` rule missing or unknown | Attach is unavailable with the blocking reason | N/A |

</frozen-after-approval>

## Code Map

- `desktop/src/main/tasks/` (`types.ts` `StartTaskInput`, validators, service) and `desktop/src/main/security/operations.ts` -- Task start and named IPC operations; add attach/inventory operations and carry an attachment ID, never a path, from the renderer.
- `desktop/src/main/policy/tools.ts:49-66` -- Task working folder (`tasks/<taskId>`, private ACL); stage located text under it. `desktop/src/main/runtime/wsl-tasks.ts:10-11,58-89` -- guest transfer rules and bounds (256 MiB, 10,000 entries, no links); staging must fit them.
- `desktop/data-policy.json:384-401` `source-extracts` (disabled, `sources/**`); `desktop/src/main/data/policy.ts:51,147-186,316-346` category fields and blockers; `data/{inventory,export,delete,import,service}.ts`; `scripts/check-data-policy.cjs`; `test/data-policy.test.ts:97` asserts disabled today.
- `desktop/src/main/tasks/progress.ts` and `desktop/src/renderer/Shell/{TaskView,TaskProgress,ConversationItems,StartView}.tsx` -- where results render and Tasks start. `renderer/primitives/FileChip.tsx` exists (states ready, failed, unreadable, permission-limited) but is unused in the Shell; extend its type labels.
- Do not touch: `engine/**`; Task `source_refs`/`artifact_refs` stay empty (`inquello-adapters/src/data_provenance.rs:299-306` deliberately rejects non-empty refs); the private tool allowlist (`exec_command`, `inquello_progress`, `request_user_input`).
- `desktop/data-policy.json` is hashed into the build's data-policy digest (`engine/codex-rs/app-server/build.rs:197`), so this change invalidates the 2026-11-03 real-data evidence further. Re-qualification is already deferred to the pilot release candidate.

## Tasks & Acceptance

**Execution:**
- [ ] `desktop/src/main/sources/` (new: inventory, staging, references, store) -- folder inventory with classification and bounds; located-text staging plus a manifest; reference parsing and verification; private extract store under `sources/**`.
- [ ] `desktop/src/main/tasks/*`, `security/operations.ts`, `preload/preload.ts` -- attach operation via system dialog, attachment carried into Task start, a fixed visible note in the request telling the agent where the staged material is and how to cite it.
- [ ] `desktop/data-policy.json`, `desktop/src/main/data/*` -- enable `source-extracts` with complete rules; deletion, export, import and recovery handling.
- [ ] `desktop/src/renderer/Shell/*`, `primitives/FileChip.tsx` -- attach control and summary in the start view; reference chips with extract view; Coverage and "Not searched" lists; unverified-reference state.
- [ ] `desktop/test/` -- unit tests for every matrix row; renderer tests for chips and Coverage; data-policy and data-operation tests for the category.
- [ ] `desktop/src/main/smoke-probe.ts` -- seeded smoke report `source-references`: attach a synthetic folder, start a fixture Task, see a verified reference and the Coverage list.

**Acceptance Criteria:**
- Given a synthetic folder with readable, unsupported and denied files, when a fixture Task answers from it, then each cited statement shows a verified reference, and the excluded files appear with reasons and a Coverage statement.
- Given the retained extracts, when the Task is deleted or Local data removes the category, then no extract remains and the original folder is unchanged.
- Given the build, when `pnpm run build` runs, then the data-policy check passes with `source-extracts` enabled and no unknown rule.

## Implementation Notes

## Design Notes

The sandbox has no host mounts by design, so the agent cannot read the folder in place. Staging located text into the Task folder keeps the agent inside its existing boundary and under the already governed `task-folders` category, while the new `source-extracts` category holds only what an answer relied on. Verification in the main process is what makes a reference trustworthy: the agent proposes, the main process checks against bytes it staged itself.

Citation form the agent is asked to use, resolved against the manifest: `[[src:<sourceId>#L10-L14]]` or `[[src:<sourceId>#R2-R9]]`.

## Verification

**Commands (from `desktop/`):**
- `pnpm exec tsc -p tsconfig.json --noEmit` and `pnpm exec tsc -p tsconfig.renderer.json --noEmit` -- expected: exit 0
- `pnpm exec vitest run --configLoader runner test/sources-*.test.* test/data-policy.test.ts test/data-operations.test.ts test/data-recovery.test.ts` -- expected: all pass
- `pnpm run build` -- expected: success, data-policy check passes
- `pnpm test` -- expected: no new failure
- `node scripts/run-seeded-smoke.cjs` -- expected: all reports pass, including `source-references`

**Manual checks:**
- Open the app, attach a folder of mixed files, start a Task with a fixture route, and inspect the reference chips, extract view and Coverage list for clarity.
