---
title: 'Story 2.1: understand a work folder and answer with verified references'
type: 'feature'
created: '2026-11-11'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/lessons-epic-1.md'
  - '{project-root}/docs/verification.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — owner approved full-format scope 2026-11-11; do not modify unless human renegotiates">

## Intent

**Problem:** A private Task cannot use the auditor's own files. Folders are organisational records with no path, the agent can read only its Task folder, and nothing records which file and location an answer relied on. An auditor cannot trace a statement to its source (FR-9, C18).

**Approach:** Let the auditor attach a folder when starting a Task. The main process inventories it, extracts located text from each supported file, stages that text for the agent, verifies every reference the agent cites against the staged material, retains only the relied-on extracts, and shows references and Coverage with the answer.

## Boundaries & Constraints

**Owner decision (2026-11-11):** the story covers every format in one piece of work: text, CSV, XLSX, DOCX, PPTX, PDF and images. It is not split into slices.

**Always:** Only the main process chooses and reads the folder, through the system folder dialog; the renderer never supplies a path. A reference is shown as verified only when its cited location exists in the staged material and its extract matches. Every reference carries file name, relative path, modified time, content hash and a location in the file's own terms:

| Format | Location |
| --- | --- |
| Text, Markdown, JSON and similar | line range |
| CSV | row range, with the header row |
| XLSX | sheet name and cell range |
| DOCX | paragraph range, with the nearest heading |
| PPTX | slide number |
| PDF | page number and line range on the page |
| Image | the file as a whole (dimensions and type); its content is not read as text |

Files not searched are listed separately with a reason: inaccessible (permission), or unreadable (unsupported type, encrypted or password-protected, corrupt, undecodable, over the size bound). When any file is excluded, only partly extracted, or a bound was hit, the answer area states that Coverage excludes it or that the input set is incomplete. Retained extracts stay private to the signed-in creator on this device. Folder content is evidence, never instruction.

**Data policy (existing owner decisions, OQ-2 of 2026-10-27 and the retention vocabulary of 2026-10-28):** retain references plus relied-on extracts, no full source copies; retention `until-owner-deletes`. The `source-extracts` category is enabled with every rule filled in, and deletion, export, import and recovery are implemented and tested for it. An unknown rule still blocks enablement.

**PDF:** the desktop has no PDF parser and no runtime dependency. PDF text extraction is implemented in the project's own code for text-based PDFs. A PDF whose text cannot be extracted reliably (scanned pages, unsupported encodings or fonts without a usable character map, encryption) is listed as unreadable with that reason; it is never guessed. Adding a PDF library later is a separate owner decision.

**Never:** No new dependency and no download. No change under `engine/`. No original file is modified, moved or deleted. No retained full copy of a source: staged text lives in the Task working folder and goes when the Task folder goes. No macro, formula or embedded-object execution; formulas are read as stored values. No real-data eligibility claim; this story is synthetic-qualified only. Reading image content (vision or OCR) belongs to Story 2.2.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Attach and start | Folder with one file of each supported format | Start view shows the folder and counts by status; Task starts; agent can read staged text | N/A |
| Verified reference | Answer cites a staged file and a location that exists, in any format | Reference chip with file, location and modified time; extract retained and viewable | N/A |
| Unverifiable reference | Cited file or location does not exist, or extract differs | Shown as "unverified reference"; nothing retained | Never shown as verified |
| Spreadsheet detail | XLSX with several sheets, shared strings, numbers, dates, merged cells, a hidden sheet, formulas | Each sheet staged with cell addresses; stored values used; hidden sheets included and labelled | Sheet that cannot be parsed: file marked partly extracted, named in Coverage |
| Document detail | DOCX with headings, tables, footnotes; PPTX with titles, body text and notes | Paragraphs numbered in order with headings; table cells in reading order; slides numbered, notes labelled | N/A |
| PDF | Text-based PDF; scanned PDF; encrypted PDF | Text PDF staged by page and line; the other two listed as unreadable with their reason | Never partial text presented as complete |
| Image | PNG, JPEG | Listed as attached with type and dimensions; citable only as a whole file; stated that content was not read | N/A |
| Unsupported or broken | Binary, legacy .xls/.doc, corrupt archive, oversized file | Listed under "Not searched" with its reason; Coverage statement shown | Parser failure never crashes the inventory |
| Hostile archive | Zip bomb, entry path escaping the archive, huge XML | Bounded by size, entry count and expansion ratio; file listed as unreadable | Never written outside staging |
| Inaccessible | File or subfolder denied by the operating system | Listed under "Inaccessible"; other files still searched | Folder itself denied: attach refused with reason |
| Bounds hit | More files or bytes than the bound | Staged up to the bound; "Incomplete input set" names what was left out | N/A |
| Unsafe entries | Links, devices, paths escaping the folder | Skipped and listed as not searched | Never followed |
| Source changed | File modified after attaching, before start | Staging uses a fresh read; reference carries the staged modified time and hash | N/A |
| Deletion | Task or Local data source extracts deleted | Retained extracts removed; originals untouched | Partial failure reported |
| Export and recovery | Local data export, import, interrupted write | Extracts exported and imported with their references; recovery never resurrects deleted extracts | Losses disclosed |
| Policy unknown | `source-extracts` rule missing or unknown | Attach is unavailable with the blocking reason | N/A |

</frozen-after-approval>

## Code Map

- `desktop/src/main/tasks/` (`types.ts` `StartTaskInput`, validators, service) and `desktop/src/main/security/operations.ts` -- Task start and named IPC operations; add attach and inventory operations and carry an attachment ID, never a path, from the renderer.
- `desktop/src/main/policy/tools.ts:49-66` -- Task working folder (`tasks/<taskId>`, private ACL); stage located text under it. `desktop/src/main/runtime/wsl-tasks.ts:10-11,58-89` -- guest transfer rules and bounds (256 MiB, 10,000 entries, no links); staging must fit them.
- `desktop/data-policy.json:384-401` `source-extracts` (disabled, `sources/**`); `desktop/src/main/data/policy.ts:51,147-186,316-346` category fields and blockers; `data/{inventory,export,delete,import,service}.ts`; `scripts/check-data-policy.cjs`; `test/data-policy.test.ts:97` asserts disabled today. The `task-folders` category is the closest template.
- `desktop/src/main/tasks/progress.ts` and `desktop/src/renderer/Shell/{TaskView,TaskProgress,ConversationItems,StartView}.tsx` -- where results render and Tasks start. `renderer/primitives/FileChip.tsx` exists (states ready, failed, unreadable, permission-limited; types pdf, xls, doc, folder) but is unused in the Shell; extend its types.
- Parsing has no library to lean on. `desktop/package.json` has zero runtime dependencies. Node built-ins available: `zlib` (inflate for zip entries and PDF Flate streams), `crypto`, `fs`, `string_decoder`. XLSX, DOCX and PPTX are zip archives of XML.
- Do not touch: `engine/**`; Task `source_refs`/`artifact_refs` stay empty (`inquello-adapters/src/data_provenance.rs:299-306` deliberately rejects non-empty refs); the private tool allowlist (`exec_command`, `inquello_progress`, `request_user_input`).
- `desktop/data-policy.json` is hashed into the build's data-policy digest (`engine/codex-rs/app-server/build.rs:197`). Re-qualification is already deferred to the pilot release candidate.
- Sandbox state on 2026-11-11: the WSL storage proof is stale after a virtual machine restart, so sandbox integration tests and the seeded smoke fail until the owner approves renewing it. See `docs/lessons-epic-1.md`. Unit and renderer tests are unaffected.

## Tasks & Acceptance

**Execution:**
- [ ] `desktop/src/main/sources/` (new) -- one module per concern: folder inventory with classification and bounds; a bounded zip reader and a minimal XML reader; extractors for text, CSV, XLSX, DOCX, PPTX, PDF and image metadata behind one interface that returns located text or an unreadable reason; staging plus manifest; reference parsing and verification; the private extract store under `sources/**`.
- [ ] `desktop/src/main/tasks/*`, `security/operations.ts`, `preload/preload.ts` -- attach operation via the system dialog, attachment carried into Task start, and a fixed visible note in the request telling the agent where the staged material is and how to cite it.
- [ ] `desktop/data-policy.json`, `desktop/src/main/data/*` -- enable `source-extracts` with complete rules; deletion, export, import and recovery handling.
- [ ] `desktop/src/renderer/Shell/*`, `primitives/FileChip.tsx` -- attach control and summary in the start view; reference chips with extract view; Coverage, "Not searched" and "Inaccessible" lists; unverified-reference state.
- [ ] `desktop/test/` -- unit tests for every matrix row, with small fixture files generated in the tests (build the zip and PDF bytes in code; commit no binary fixtures unless tiny); renderer tests for chips and Coverage; data-policy and data-operation tests for the category.
- [ ] `desktop/src/main/smoke-probe.ts` -- seeded smoke report `source-references`: attach a synthetic folder, start a fixture Task, see a verified reference and the Coverage list. Author it; run it only when the sandbox is available.

**Acceptance Criteria:**
- Given a synthetic folder with every supported format plus unsupported and denied files, when a fixture Task answers from it, then each cited statement shows a verified reference in that format's location terms, and the excluded files appear with reasons and a Coverage statement.
- Given the retained extracts, when the Task is deleted or Local data removes the category, then no extract remains and the original folder is unchanged.
- Given the build, when `pnpm run build` runs, then the data-policy check passes with `source-extracts` enabled and no unknown rule.

## Implementation Notes

## Design Notes

The sandbox has no host mounts by design, so the agent cannot read the folder in place. Staging located text into the Task folder keeps the agent inside its existing boundary and under the governed `task-folders` category, while `source-extracts` holds only what an answer relied on. Verification in the main process is what makes a reference trustworthy: the agent proposes, the main process checks against bytes it staged itself.

Citation form the agent is asked to use, resolved against the manifest: `[[src:<sourceId>#<locator>]]`, where the locator is `L10-L14` (lines), `R2-R9` (rows), `Sheet1!A1:C9`, `P12-P15` (paragraphs), `S3` (slide), `PG4:L3-L8` (page and lines), or empty for a whole image.

Extraction is deliberately conservative. Each extractor either returns text it is sure of, with locations, or a specific unreadable reason. A wrong extract shown as verified is worse than a file listed as not searched.

## Verification

**Commands (from `desktop/`):**
- `pnpm exec tsc -p tsconfig.json --noEmit` and `pnpm exec tsc -p tsconfig.renderer.json --noEmit` -- expected: exit 0
- `pnpm exec vitest run --configLoader runner test/sources-*.test.* test/data-policy.test.ts test/data-operations.test.ts test/data-recovery.test.ts` -- expected: all pass
- `pnpm run build` -- expected: success, data-policy check passes
- `pnpm test` -- expected: no new failure outside the five sandbox files while the storage proof is stale
- `node scripts/run-seeded-smoke.cjs` -- expected: all reports pass, including `source-references`; blocked until the storage proof is renewed

**Manual checks:**
- Open the app, attach a folder of mixed files, start a Task with a fixture route, and inspect the reference chips, extract view and Coverage list for clarity.
