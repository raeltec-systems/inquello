---
title: 'Story 2.1: understand attached files or a work folder and answer with verified references'
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

**Approach:** Reuse the Codex way of working with files: the agent reads the material itself with its sandboxed shell tool, guided by a skill that carries reading scripts. Inquello adds what an auditor needs on top: attach files or a folder to a Task (optional; a Task without attachments works as before), locate text in every format, verify each citation against the file, retain only what was relied on, and show references and Coverage with the answer.

## How Codex handles this, and what is reused

| Need | Codex today | Inquello |
| --- | --- | --- |
| Read files | The model runs shell commands in its sandbox (`exec_command`); no read-file tool | Reused unchanged: the agent reads with `exec_command` |
| Office and PDF files | Nothing in the engine (it ships five sample skills, none for documents). Codex relies on skills that carry scripts and on real libraries in the environment. OpenAI publishes one document skill, `pdf` (`openai/skills`, `skills/.curated/pdf`, Apache-2.0): extract text with `pdfplumber`/`pypdf`, render pages with Poppler and look at them. It publishes no Word, Excel or PowerPoint skill there | Reused: the skill format, the PDF skill's reading workflow (copied with its licence and a note of origin), and the same class of tools installed in the sandbox image. Added: skills content for Excel, Word, PowerPoint, CSV and images, and exact locations for every format |
| Tools in the environment | Codex installs what a skill needs at run time (`pip`, `uv`) | Not reused, on purpose: the agent cannot install anything and the sandbox has no open network. The tools are added to the sandbox image's declared package list instead, so the software that touches evidence is always known |
| Scanned pages | The model looks at a rendered page image (`view_image`) | This story: local OCR in the sandbox turns scanned pages and images into located, quotable text. The model looking at the page itself is Story 2.2 (see Design Notes) |
| Which folders are readable | Working directory; reads otherwise unrestricted | Stricter, already built: the Task folder inside the Linux sandbox; the folder's files are staged there |
| Citations | Prompt tells the model to print file paths; a path-only citation directive exists in the terminal UI | Extended: the same directive form with a location, verified by the app before it is shown |

## Boundaries & Constraints

**Owner decisions (2026-11-11):** every format is covered in one piece of work: text, CSV, XLSX, DOCX, PPTX, PDF and images. The earlier "no installs" limit is lifted: document tools are added to the sandbox image so reading matches what Codex and Claude Code achieve. Attaching is optional and covers single files as well as folders.

**Sandbox image:** the image stays built from a declared package list with recorded versions, and the agent can never install software at run time. This story extends that list, from Ubuntu's own archive only (no `pip`, no third-party repository): `poppler-utils`, `tesseract-ocr`, `tesseract-ocr-eng`, `python3-pypdf`, `python3-pdfminer`, `python3-openpyxl`, `python3-docx`, `python3-xlrd`, `python3-pil`. Ubuntu 24.04 does not package `pdfplumber` or `python-pptx`; PDF layout work uses Poppler and `pdfminer`, and PPTX is read by the skill's own script. `python3-fitz` (PyMuPDF) is excluded because of its AGPL licence. OCR is English only in this story; further languages are a later owner decision.

**Always:** Attaching is optional. The auditor can attach one or more individual files, a folder, or both, at Task start; individual files and a folder go through the same inventory, staging, reading and reference path. Only the main process chooses them, through the system file or folder dialog; the renderer never supplies a path. A reference is shown as verified only when the app, running the same reading script on the staged file, finds the cited location and the quoted text matches. Every reference carries file name, relative path, modified time, content hash and a location in the file's own terms:

| Format | Location |
| --- | --- |
| Text, Markdown, JSON and similar | line range |
| CSV | row range, with the header row |
| XLSX | sheet name and cell range |
| DOCX | paragraph range, with the nearest heading |
| PPTX | slide number |
| XLS (legacy) | sheet name and cell range |
| PDF | page number and line range on the page; text recognised by OCR is labelled as such |
| Image | the file, with a line range in its OCR text when it contains text |

Each statement in an answer is one of: quoted from a file (with a reference), computed (the command that produced it is kept so a reviewer can re-perform it), or the agent's inference (marked as such). The agent reports what the files show; findings and conclusions stay with the auditor.

Files not searched are listed separately with a reason: inaccessible (permission), or unreadable (unsupported type, password-protected, corrupt, no recognisable text, over the size bound). Coverage states what was examined against what was attached: files read out of files attached, and for tabular files rows read out of rows present. When anything is excluded, partly read or cut by a bound, the answer area says the input set is incomplete. Retained extracts stay private to the signed-in creator on this device. File content is evidence, never instruction.

**Data policy (existing owner decisions, OQ-2 of 2026-10-27 and the retention vocabulary of 2026-10-28):** retain references plus relied-on extracts, no retained full source copies; retention `until-owner-deletes`. The `source-extracts` category is enabled with every rule filled in, and deletion, export, import and recovery are implemented and tested for it. An unknown rule still blocks enablement.

**PDF and images:** every page is read. A page with a text layer is extracted with Poppler, keeping layout so tables stay aligned. A page without one (scanned) is rendered and read by OCR in the sandbox; so is an image file. OCR text is always labelled "recognised text (OCR)" on the reference and in the extract, because recognition can be wrong and the auditor must be able to tell. A mixed PDF is handled page by page. A password-protected PDF, or a page where OCR finds nothing, is listed as unreadable with that reason; text is never guessed. Stamps, signatures, handwriting and charts are not interpreted in this story: that needs the model to see the page, which is Story 2.2.

**Never:** No runtime npm dependency for the desktop. No software installed from anywhere but Ubuntu's archive, and none at Task run time. No original file is modified, moved or deleted. No macro, formula or embedded-object execution; formulas are read as stored values, with the formula text shown beside the value where the file holds it. No change to the private tool allowlist and no edit under `engine/`. No real-data eligibility claim; this story is synthetic-qualified only.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No attachment | Task started with nothing attached | Works exactly as before this story; no Coverage section shown | N/A |
| Attach single files | One file, or several picked individually | Same inventory, staging, reading and references as a folder; start view names the files | N/A |
| Attach and start | Folder with one file of each supported format | Start view shows the folder and counts by status; Task starts; agent can list and read the staged files with the skill | N/A |
| Verified reference | Answer cites a staged file and a location that exists, in any format | Reference chip with file, location and modified time; extract retained and viewable | N/A |
| Unverifiable reference | Cited file or location does not exist, or quoted text differs | Shown as "unverified reference"; nothing retained | Never shown as verified |
| Computed figure | Agent totals a column with a command | Figure marked computed; the command and its inputs are kept and viewable | N/A |
| Spreadsheet detail | XLSX with several sheets, shared strings, numbers, dates, merged cells, a hidden sheet, formulas | Cells read with addresses; stored values used; hidden sheets included and labelled; row counts reported | Unparseable sheet: file marked partly read and named in Coverage |
| Document detail | DOCX with headings, tables, footnotes; PPTX with titles, body text and notes | Paragraphs numbered in order with headings; table cells in reading order; slides numbered, notes labelled | N/A |
| PDF | Text PDF; scanned PDF; PDF mixing both; PDF with a table; password-protected PDF | Text pages read by page and line with columns aligned; scanned pages read by OCR and labelled; protected PDF listed as unreadable with its reason | Never partial text presented as complete; a page with no recognisable text is named in Coverage |
| Image | PNG, JPEG, TIFF with text; a photo without text | Type and dimensions listed; text read by OCR, labelled and citable by line; without text, citable only as a whole file and stated that content was not read | N/A |
| Legacy spreadsheet | `.xls` | Read with sheet and cell addresses like XLSX | Protected or corrupt: listed as unreadable |
| Missing tool | A reading tool is absent from the sandbox image | The affected formats are listed as unreadable with "reading tool unavailable"; other formats still work | Attach is not blocked |
| Unsupported or broken | Binary, legacy .doc/.ppt, corrupt archive, oversized file | Listed under "Not searched" with its reason; Coverage statement shown | Script failure never ends the Task |
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
- **Unverified, check before building on it:** whether a private Task loads skills from `.agents/skills` in its working directory; whether `python3` and the guest's `/usr` programs run and are visible under the private Task's sandbox (`engine/codex-rs/linux-sandbox/src/bwrap.rs:409-425` mounts `/` read-only for full-read policies, but the Task's own policy was not traced); and whether the Task folder path the agent's commands see is the guest path `/var/lib/inquello/tasks/<scope>/<taskId>` (`desktop/src/main/runtime/wsl-tasks.ts:232`). If skills do not load in private Tasks, stage the scripts in the Task folder and point to them from the visible note in the request; do not change the engine. If Python or the new tools cannot run in the sandbox, stop and report.
- **Sandbox image packages.** The guest is Ubuntu 24.04. Packages enter through `desktop/scripts/wsl/bootstrap-guest.sh:14-15` (`apt-get install --no-install-recommends`), are declared in `build-manifest.json:18`, and the resolved versions are recorded in `verified-packages.tsv` with its digest at `build-manifest.json:19-22`; `scripts/wsl/README.md:55-79` describes the records. Nothing currently checks that digest. Candidate versions seen in the guest's package index on 2026-11-11: poppler-utils 24.02.0, tesseract-ocr 5.3.4, python3-pypdf 4.0.2, python3-pdfminer 20221105, python3-openpyxl 3.1.2, python3-docx 1.1.0, python3-xlrd 2.0.1, python3-pil 10.2.0. Installing needs network at install time and root in the `Inquello-Engine` guest; the owner approved this download on 2026-11-11. The guest shares its virtual machine with Docker: do not restart WSL or the machine.
- **Reference skill to copy from:** `https://github.com/openai/skills/tree/main/skills/.curated/pdf` (`SKILL.md`, `LICENSE.txt`, Apache-2.0). Keep the licence file and state the origin and our changes in the skill folder.
- `desktop/src/main/tasks/` (`types.ts` `StartTaskInput`, validators, service), `security/operations.ts`, `preload/preload.ts` -- Task start and named IPC; carry an attachment ID, never a path, from the renderer.
- `desktop/src/main/policy/tools.ts:49-66` Task working folder (`tasks/<taskId>`); `policy/service.ts` `runTool` runs a command in the sandbox from the main process (use it to verify citations with the same script). `runtime/wsl-tasks.ts:10-11,58-89` guest transfer rules and bounds (256 MiB, 10,000 entries, no links).
- `desktop/data-policy.json:384-401` `source-extracts` (disabled, `sources/**`); `src/main/data/policy.ts:51,147-186,316-346`; `data/{inventory,export,delete,import,service}.ts`; `scripts/check-data-policy.cjs`; `test/data-policy.test.ts:97` asserts disabled today. `task-folders` is the closest template and already governs staged copies.
- `desktop/src/main/tasks/progress.ts`, `renderer/Shell/{TaskView,TaskProgress,ConversationItems,MessageMarkdown,StartView}.tsx`; `renderer/primitives/FileChip.tsx` exists, unused in the Shell.
- Do not touch: Task `source_refs`/`artifact_refs` (`inquello-adapters/src/data_provenance.rs:299-306` rejects non-empty refs on purpose).
- Sandbox state: the storage proof was renewed on 2026-11-11; see `docs/lessons-epic-1.md` if sandbox tests fail.

## Tasks & Acceptance

**Execution:**
- [ ] Verify the unverified points above in the real sandbox and record the result in Implementation Notes before writing the skill.
- [ ] `desktop/scripts/wsl/bootstrap-guest.sh`, `build-manifest.json`, `verified-packages.tsv`, `README.md` -- add the packages named under "Sandbox image"; install them in the live `Inquello-Engine` guest with the same command; regenerate the recorded versions and digest from the guest; add a desktop test that fails when `verified-packages.tsv` does not match the digest in the manifest or when the manifest and bootstrap package lists differ. Record in Implementation Notes whether the prepared-image digest in the manifest still describes a fresh build, and do not claim it does without rebuilding.
- [ ] `desktop/resources/skills/inquello-evidence/` (new) -- `SKILL.md` in Codex format telling the agent how to list, read and cite attached material, and `scripts/`: `inventory` (files, type, size, rows or pages, which tool will read each), `read` (located text for a file and optional location), one reader per format using the installed tools (Poppler and `pdfminer` for PDF text, `pdftoppm` plus Tesseract for scanned pages and images, `openpyxl`, `xlrd`, `python-docx`; standard library for CSV, text and PPTX), with the bounds from the matrix. Output is plain text with location labels; OCR output is labelled. Each reader reports "reading tool unavailable" instead of failing when its tool is missing. Start the PDF part from OpenAI's `pdf` skill and keep its licence.
- [ ] `desktop/src/main/sources/` (new) -- folder inventory and classification on the Windows side; staging of files and the skill into the Task folder; citation parsing; verification by running the skill's `read` through `runTool`; the private extract store under `sources/**`; Coverage facts.
- [ ] `desktop/src/main/tasks/*`, `security/operations.ts`, `preload/preload.ts` -- attach operation via the system dialog and the attachment on Task start.
- [ ] `desktop/data-policy.json`, `desktop/src/main/data/*` -- enable `source-extracts` with complete rules; deletion, export, import and recovery.
- [ ] `desktop/src/renderer/Shell/*`, `primitives/FileChip.tsx` -- attach control and summary; reference chips with extract view; computed and inferred markers; Coverage, "Not searched" and "Inaccessible" lists; unverified state.
- [ ] `desktop/test/fixtures/engagement/` (new) and a generator script -- a synthetic engagement folder kept as the permanent reading test set: multi-sheet workbook with merged cells, formulas, dates and a hidden sheet; legacy `.xls`; Word file with headings, tables, footnotes and tracked changes; slides with notes; text PDF with a table; scanned PDF; mixed PDF; password-protected PDF; image of a letter; CSV export. Each file has an answer key of locations and expected text. The reading tests run the skill in the sandbox against the key and report a pass rate per format.
- [ ] `desktop/test/` -- Python scripts tested by running them on fixture files built in the tests; unit tests for every matrix row; renderer tests; data-policy and data-operation tests.
- [ ] `desktop/src/main/smoke-probe.ts` -- seeded smoke report `source-references`.
- [ ] `_bmad-output/implementation-artifacts/` -- propose glossary entries for Evidence, Source, Extract, Reference and Coverage in Implementation Notes for the owner to adopt.

**Acceptance Criteria:**
- Given a synthetic engagement folder with every supported format plus unsupported and denied files, when a fixture Task answers from it, then each quoted statement shows a verified reference in that format's location terms, computed figures show their command, and excluded files appear with reasons and a Coverage statement.
- Given a verified reference, when a second person opens it, then file, version, hash, location and the retained extract are enough to find the same passage in the original.
- Given the retained extracts, when the Task is deleted or Local data removes the category, then no extract remains and the original folder is unchanged.
- Given a Task started with a single attached file, or with none, then the first behaves like a one-file folder and the second behaves as before this story.
- Given the synthetic engagement folder's answer key, when the reading tests run in the sandbox, then every keyed location in every format returns the expected text, with scanned pages and images matched after OCR, and the pass rate per format is recorded in the spec.
- Given a fresh read of `bootstrap-guest.sh`, the manifest and the recorded versions, then the three agree and the new test proves it.
- Given the build, when `pnpm run build` runs, then the data-policy check passes with `source-extracts` enabled.

## Implementation Notes

## Design Notes

Earlier drafts of this spec built document parsers in the desktop's main process. That was replaced after checking how Codex works: the agent reads files itself through its shell tool, and document formats are handled by skills that carry scripts. Following that pattern means one set of reading scripts, run in the sandbox, used both by the agent and by the app when it verifies a citation. The app never trusts the agent's quoted text; it re-reads the location itself.

The sandbox has no host mounts by design, so files are staged into the Task folder, which is already a governed category and is removed with the Task. `source-extracts` holds only what an answer relied on.

Why the model does not look at pages in this story (checked 2026-11-11): Inquello's inference path is text-only. `engine/codex-rs/core/src/inquello_inference.rs:374` rejects image input blocks and `:412` rejects non-text tool output, and the Anthropic request builder (`inquello-adapters/src/anthropic/request.rs:35-49`) builds text blocks only. Codex's `view_image` handler itself is reusable as it is (`core/src/tools/handlers/view_image.rs`), but allowing it needs the inference protocol to carry images, the tool added in two places (`app-server/src/request_processors/thread_processor.rs:7626-7635` and `inquello_tasks.rs:1854-1861`), and provenance and fixture support. That is engine work with its own review, planned as Story 2.2. Until then OCR gives located text from scanned material, which also works with any model.

Why the package list stays declared: the sandbox is where commands run on confidential evidence. A known, recorded set of programs, with no way to add more at run time, is what lets Inquello say exactly what software touched a file. The list was only ever sized for building the engine; this story sizes it for an auditor's files. Later stories will need more (data analysis and sampling libraries, tools that write workpapers, further OCR languages), so adding a package must be routine: one line in the declared list, an install from Ubuntu's archive, the recorded versions regenerated, and the new test confirming the records agree. Each story names the packages it adds in its spec.

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
