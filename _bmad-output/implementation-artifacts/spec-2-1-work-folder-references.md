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

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An auditor's evidence lives in an engagement folder of spreadsheets, documents, slides, PDFs and exports. A private Task cannot use it, and nothing records which file and location an answer relied on. The Global Internal Audit Standards expect documentation that lets a competent person repeat the work; an answer without a traceable source does not meet that (FR-9, C18).

**Approach:** Reuse the Codex way of working with files: the agent reads the material itself with its sandboxed shell tool, guided by a skill that carries reading scripts. Inquello adds what an auditor needs on top: attach a folder to a Task, locate text in every format, verify each citation against the file, retain only what was relied on, and show references and Coverage with the answer.

## How Codex handles this, and what is reused

| Need | Codex today | Inquello |
| --- | --- | --- |
| Read files | The model runs shell commands in its sandbox (`exec_command`); no read-file tool | Reused unchanged: the agent reads with `exec_command` |
| Office and PDF files | Nothing in the engine; Codex relies on skills and plugins that carry scripts | Reused pattern: an Inquello skill in Codex `SKILL.md` format with Python scripts, standard library only |
| Which folders are readable | Working directory; reads otherwise unrestricted | Stricter, already built: the Task folder inside the Linux sandbox; the folder's files are staged there |
| Citations | Prompt tells the model to print file paths; a path-only citation directive exists in the terminal UI | Extended: the same directive form with a location, verified by the app before it is shown |
| Images | `view_image` tool | Not in this story: enabling it for private Tasks is Story 2.2 |

## Boundaries & Constraints

**Owner decision (2026-11-11):** every format is covered in one piece of work: text, CSV, XLSX, DOCX, PPTX, PDF and images.

**Always:** Only the main process chooses the folder, through the system folder dialog; the renderer never supplies a path. A reference is shown as verified only when the app, running the same reading script on the staged file, finds the cited location and the quoted text matches. Every reference carries file name, relative path, modified time, content hash and a location in the file's own terms:

| Format | Location |
| --- | --- |
| Text, Markdown, JSON and similar | line range |
| CSV | row range, with the header row |
| XLSX | sheet name and cell range |
| DOCX | paragraph range, with the nearest heading |
| PPTX | slide number |
| PDF | page number and line range on the page |
| Image | the file as a whole; its content is not read |

Each statement in an answer is one of: quoted from a file (with a reference), computed (the command that produced it is kept so a reviewer can re-perform it), or the agent's inference (marked as such). The agent reports what the files show; findings and conclusions stay with the auditor.

Files not searched are listed separately with a reason: inaccessible (permission), or unreadable (unsupported type, encrypted, corrupt, scanned, over the size bound). Coverage states what was examined against what was attached: files read out of files attached, and for tabular files rows read out of rows present. When anything is excluded, partly read or cut by a bound, the answer area says the input set is incomplete. Retained extracts stay private to the signed-in creator on this device. File content is evidence, never instruction.

**Data policy (existing owner decisions, OQ-2 of 2026-10-27 and the retention vocabulary of 2026-10-28):** retain references plus relied-on extracts, no retained full source copies; retention `until-owner-deletes`. The `source-extracts` category is enabled with every rule filled in, and deletion, export, import and recovery are implemented and tested for it. An unknown rule still blocks enablement.

**PDF:** the sandbox has Python's standard library and no PDF tool. Text-based PDFs are read by the skill's own script. A PDF whose text cannot be extracted reliably (scanned, encrypted, fonts without a usable character map) is listed as unreadable with that reason; it is never guessed. Installing a PDF tool in the sandbox later is a separate owner decision.

**Never:** No new dependency, install or download. No original file is modified, moved or deleted. No macro, formula or embedded-object execution; formulas are read as stored values. No change to the private tool allowlist. No real-data eligibility claim; this story is synthetic-qualified only.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Attach and start | Folder with one file of each supported format | Start view shows the folder and counts by status; Task starts; agent can list and read the staged files with the skill | N/A |
| Verified reference | Answer cites a staged file and a location that exists, in any format | Reference chip with file, location and modified time; extract retained and viewable | N/A |
| Unverifiable reference | Cited file or location does not exist, or quoted text differs | Shown as "unverified reference"; nothing retained | Never shown as verified |
| Computed figure | Agent totals a column with a command | Figure marked computed; the command and its inputs are kept and viewable | N/A |
| Spreadsheet detail | XLSX with several sheets, shared strings, numbers, dates, merged cells, a hidden sheet, formulas | Cells read with addresses; stored values used; hidden sheets included and labelled; row counts reported | Unparseable sheet: file marked partly read and named in Coverage |
| Document detail | DOCX with headings, tables, footnotes; PPTX with titles, body text and notes | Paragraphs numbered in order with headings; table cells in reading order; slides numbered, notes labelled | N/A |
| PDF | Text-based PDF; scanned PDF; encrypted PDF | Text PDF read by page and line; the other two listed as unreadable with their reason | Never partial text presented as complete |
| Image | PNG, JPEG | Listed as attached with type and dimensions; citable only as a whole file; stated that content was not read | N/A |
| Unsupported or broken | Binary, legacy .xls/.doc, corrupt archive, oversized file | Listed under "Not searched" with its reason; Coverage statement shown | Script failure never ends the Task |
| Hostile archive | Zip bomb, entry path escaping the archive, huge XML | Bounded by size, entry count and expansion ratio; file listed as unreadable | Nothing written outside the Task folder |
| Inaccessible | File or subfolder denied by the operating system | Listed under "Inaccessible"; other files still staged | Folder itself denied: attach refused with reason |
| Bounds hit | More files or bytes than the staging bound | Staged up to the bound; "Incomplete input set" names what was left out | N/A |
| Unsafe entries | Links, devices, paths escaping the folder | Skipped and listed as not searched | Never followed |
| Deletion | Task or Local data source extracts deleted | Retained extracts removed; staged copies go with the Task folder; originals untouched | Partial failure reported |
| Export and recovery | Local data export, import, interrupted write | Extracts exported and imported with their references; recovery never resurrects deleted extracts | Losses disclosed |
| Policy unknown | `source-extracts` rule missing or unknown | Attach is unavailable with the blocking reason | N/A |

</frozen-after-approval>

## Code Map

- **Reuse, read first.** Skills: `engine/codex-rs/ext/skills/src/` (`host_roots.rs:73-160` lists skill roots, including `.agents/skills` from the working directory upward) and `engine/codex-rs/skills/src/assets/samples/` for the `SKILL.md` format. Citation directive: `engine/codex-rs/tui/src/markdown_render/inline_directives.rs:104-135` (`:codex-file-citation{path="..."}`). Shell tool: `engine/codex-rs/core/src/tools/handlers/unified_exec/`. Private allowlist: `engine/codex-rs/app-server/src/request_processors/inquello_tasks.rs:1851-1861` (`exec_command`, `inquello_progress`, `request_user_input`).
- **Unverified, check before building on it:** whether a private Task loads skills from `.agents/skills` in its working directory, and whether `python3` runs under the private Task's sandbox. The guest has Python 3.12 standard library only (`desktop/scripts/wsl/verified-packages.tsv:193-196`); no pip, pandas, openpyxl, poppler or unzip. If skills do not load in private Tasks, stage the scripts in the Task folder and point to them from the visible note in the request; do not change the engine. If Python cannot run in the sandbox, stop and report.
- `desktop/src/main/tasks/` (`types.ts` `StartTaskInput`, validators, service), `security/operations.ts`, `preload/preload.ts` -- Task start and named IPC; carry an attachment ID, never a path, from the renderer.
- `desktop/src/main/policy/tools.ts:49-66` Task working folder (`tasks/<taskId>`); `policy/service.ts` `runTool` runs a command in the sandbox from the main process (use it to verify citations with the same script). `runtime/wsl-tasks.ts:10-11,58-89` guest transfer rules and bounds (256 MiB, 10,000 entries, no links).
- `desktop/data-policy.json:384-401` `source-extracts` (disabled, `sources/**`); `src/main/data/policy.ts:51,147-186,316-346`; `data/{inventory,export,delete,import,service}.ts`; `scripts/check-data-policy.cjs`; `test/data-policy.test.ts:97` asserts disabled today. `task-folders` is the closest template and already governs staged copies.
- `desktop/src/main/tasks/progress.ts`, `renderer/Shell/{TaskView,TaskProgress,ConversationItems,MessageMarkdown,StartView}.tsx`; `renderer/primitives/FileChip.tsx` exists, unused in the Shell.
- Do not touch: Task `source_refs`/`artifact_refs` (`inquello-adapters/src/data_provenance.rs:299-306` rejects non-empty refs on purpose).
- Sandbox state: the storage proof was renewed on 2026-11-11; see `docs/lessons-epic-1.md` if sandbox tests fail.

## Tasks & Acceptance

**Execution:**
- [ ] Verify the two unverified points above in the real sandbox and record the result in Implementation Notes before writing the skill.
- [ ] `desktop/resources/skills/inquello-evidence/` (new) -- `SKILL.md` in Codex format telling the agent how to list, read and cite attached material, and `scripts/` in Python standard library only: `inventory` (files, type, size, rows or pages), `read` (located text for a file and optional location), one reader per format, with the bounds from the matrix. Output is plain text with location labels.
- [ ] `desktop/src/main/sources/` (new) -- folder inventory and classification on the Windows side; staging of files and the skill into the Task folder; citation parsing; verification by running the skill's `read` through `runTool`; the private extract store under `sources/**`; Coverage facts.
- [ ] `desktop/src/main/tasks/*`, `security/operations.ts`, `preload/preload.ts` -- attach operation via the system dialog and the attachment on Task start.
- [ ] `desktop/data-policy.json`, `desktop/src/main/data/*` -- enable `source-extracts` with complete rules; deletion, export, import and recovery.
- [ ] `desktop/src/renderer/Shell/*`, `primitives/FileChip.tsx` -- attach control and summary; reference chips with extract view; computed and inferred markers; Coverage, "Not searched" and "Inaccessible" lists; unverified state.
- [ ] `desktop/test/` -- Python scripts tested by running them on fixture files built in the tests; unit tests for every matrix row; renderer tests; data-policy and data-operation tests.
- [ ] `desktop/src/main/smoke-probe.ts` -- seeded smoke report `source-references`.
- [ ] `_bmad-output/implementation-artifacts/` -- propose glossary entries for Evidence, Source, Extract, Reference and Coverage in Implementation Notes for the owner to adopt.

**Acceptance Criteria:**
- Given a synthetic engagement folder with every supported format plus unsupported and denied files, when a fixture Task answers from it, then each quoted statement shows a verified reference in that format's location terms, computed figures show their command, and excluded files appear with reasons and a Coverage statement.
- Given a verified reference, when a second person opens it, then file, version, hash, location and the retained extract are enough to find the same passage in the original.
- Given the retained extracts, when the Task is deleted or Local data removes the category, then no extract remains and the original folder is unchanged.
- Given the build, when `pnpm run build` runs, then the data-policy check passes with `source-extracts` enabled.

## Implementation Notes

## Design Notes

Earlier drafts of this spec built document parsers in the desktop's main process. That was replaced after checking how Codex works: the agent reads files itself through its shell tool, and document formats are handled by skills that carry scripts. Following that pattern means one set of reading scripts, run in the sandbox, used both by the agent and by the app when it verifies a citation. The app never trusts the agent's quoted text; it re-reads the location itself.

The sandbox has no host mounts by design, so files are staged into the Task folder, which is already a governed category and is removed with the Task. `source-extracts` holds only what an answer relied on.

Citation form, following the Codex directive: `:inquello-source{id="<sourceId>" at="<locator>" quote="<text>"}`, where the locator is `L10-L14`, `R2-R9`, `Sheet1!A1:C9`, `P12-P15`, `S3`, `PG4:L3-L8`, or empty for a whole image.

## Verification

**Commands (from `desktop/`):**
- `pnpm exec tsc -p tsconfig.json --noEmit` and `pnpm exec tsc -p tsconfig.renderer.json --noEmit` -- expected: exit 0
- `pnpm exec vitest run --configLoader runner test/sources-*.test.* test/data-policy.test.ts test/data-operations.test.ts test/data-recovery.test.ts` -- expected: all pass
- `pnpm run build` -- expected: success, data-policy check passes
- `pnpm test` -- expected: no new failure
- `node scripts/run-seeded-smoke.cjs` -- expected: all reports pass, including `source-references`

**Manual checks:**
- Open the app, attach a folder of mixed files, start a Task with a fixture route, and inspect the reference chips, extract view and Coverage list for clarity.
