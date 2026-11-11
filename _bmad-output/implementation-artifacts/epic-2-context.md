# Epic 2 Context: Attributable analysis with Methods

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Let an auditor point the assistant at real Engagement material (files, images, selections, connector data, public research), run calculations and Methods over it, and get results where every statement traces to its source, version, scope and derivation. Coverage, exclusions, departures and limits are stated rather than implied, and instructions embedded in evidence never gain authority. This is the Increment 1 evidence-and-analysis core; each story is a proposal, not an approved or ready-for-development status.

## Stories

- Story 2.1: Understand an existing work folder with precise references
- Story 2.2: Use images and screenshots as attributable context
- Story 2.3: Capture selections and application snapshots with saved or live scope stated
- Story 2.4: Attach connector identity, entity scope and extraction context to evidence
- Story 2.5: Run calculations, queries and scripts with retained derivations
- Story 2.6: Apply standing instructions and Workspace guidance with provenance
- Story 2.7: Define, select and validate a Method before Task invocation
- Story 2.8: Start a Task with actual files and a selected Method
- Story 2.9: Retain Composer attachments and selected Method during navigation
- Story 2.10: Execute and verify a registered Method on its supplied inputs
- Story 2.11: Record Task-specific departures separately from Method changes
- Story 2.12: Show population, exclusions, sampling and actual Coverage
- Story 2.13: Inspect technical investigation detail without forcing it on ordinary review
- Story 2.14: Show attributable parallel reads and complete analysis progress
- Story 2.15: Run hooks with observable outcomes and defined mandatory-check consequences
- Story 2.16: Keep M1 evidence and retrieved-source instructions subordinate
- Story 2.17: Research with attributable sources and labelled limits
- Story 2.18: Verify source authority before enabling attributable analysis

## Requirements & Constraints

- Every relied-on statement carries file, version or modified time, and location (sheet and range, page, passage, slide, image region). Retained extracts stay private and are never auto-uploaded as full copies; they become shared only through an authorised explicit share or formal issue.
- Inaccessible and unreadable files are listed separately from files actually searched, with reasons. Partial input is named as such and never described as full Coverage.
- Saved file state, live host state and application snapshots are labelled with capture time and source. A snapshot older than the current file version is marked stale when relied on. Unknown image provenance or capture time is recorded as unknown, and a screenshot is never treated as proof of history, completeness or period.
- Connector and MCP evidence records source identity, acting account, entity scope and observation time, shown before reliance. Write-capable tools show the acting account and destination in the ApprovalCard and are reviewed separately from reads.
- Analyses (script, input identities and versions, parameters, output) are stored and linked to the Task. A changed input triggers recomputation with the difference shown, or marks the result stale and names the changed input. Failed runs show no partial output as a result.
- Ordinary review uses audit and business language: what was checked, sources, findings, differences, assumptions and limitations. The auditor can drill into one item, challenge an assumption and request recalculation. Queries, scripts and logs stay retained and available on demand. An explanation must not turn an unsupported result into a verified conclusion.
- Each analysis shows population count, exclusions with reasons, duplicate treatment, sampling parameters (from the Method only, never an invented universal rule) and examined Coverage as count and share. Input must reconcile to completed, excluded, failed and unfinished work, including after interruption or resume. No record is silently omitted and no effect is blindly repeated. Uncertain outcomes stay unresolved until reconciled.
- Method identity, version, criteria references, inputs, outputs and verification steps are inspectable. Instructions and skills cannot grant execution or source authority. Preflight names missing dependencies and keeps the draft Task. Incompatible version and denied distribution are distinct states. Execution evidence distinguishes faithful execution from human judgment of procedure suitability.
- Task-specific departures store Method identity and version, what differs, rationale, affected outputs and the person. They never change the maintained Method, and denied departures stay unapplied with the draft preserved. Applied instructions show their source and are labelled policy, procedure (Method), memory or current request. Conflicts are shown, not silently resolved.
- Mandatory lifecycle hooks show and record passed, warning, blocked and failed-to-run outcomes. A hook that fails to run applies the configured consequence (for example "checks incomplete" and blocked delivery), not silent proceeding. Unsupported hook versions fail intelligibly with the version named.
- Instructions inside evidence, web pages or tool results are content under examination and never override trusted task or policy instructions. Reports disclose limits and never claim all untrusted input was detected. Research claims cite URL or title, retrieval time and basis. Estimates are labelled with assumptions. An unavailable search route is stated, with no silent substitution.
- The permission profile is explained in audit terms (sources, working copies, outputs, external destinations). The default scoped profile reads the source folder and writes only to the Engagement output folder. Stale or unauthorised references or indexes are re-checked against current authority, inaccessible content is excluded with the gap visible, and retention never makes a private extract Workspace-visible.
- Each route that holds a new private category (source references and extracts in 2.1, derived Analysis inputs, scripts and results in 2.5) needs access, retention, deletion, export and recovery rules implemented and tested before real-data use. Unknown policy blocks enablement and no retention duration is invented. Revocation suppresses derived disclosure, and recovery cannot resurrect grants. Exports disclose losses and surviving external copies. Epic 4 and Epic 13 controls do not substitute for this local floor.
- Cross-product language rule: use clear audit language (PRD terminology and UX Voice and Tone guidance), not only in technical analysis. Standards-defined meanings and organisation-configured terms stay distinct.

## Technical Decisions

- Evidence, Methods, review and working records live in shared Rust domain modules inside the fork. All supported audit entry paths use them. Working metadata sits in separate local SQLite, which is not shared-service authority. Formal audit-record authority stays external in V1.
- Trusted instructions are separated from evidence. Source origin, version, saved or live scope and access limits are retained. Authority is re-checked on use, resume and mutation. Nothing grants credentials from plugin discovery or permission from a Method. There is no silent route fallback.
- Artifacts and analyses keep input, Method and derivation, population, exclusions, duplicate treatment, sampling parameters and actual Coverage. A completed turn, passed sample or human spot check does not establish full-population execution. Procedure suitability and human acceptance stay separate.
- Method, version, parameters and departures are retained separately from shared-guidance changes. Memory, history and Method stay distinct, and case evidence never becomes maintained Method. There is no silent case-to-team promotion and no general workflow engine.
- Renderers are sandboxed and context-isolated with no Node authority. Source and artifact previews run in a separate sandboxed context and cannot submit human decisions. Protected domain stores and credentials are denied to agent tools and subprocesses and exposed only through scoped domain commands.
- Stable Workspace, optional Engagement, Task, Source and Artifact identity link to runtime thread, turn and item references. Run, checks, human review, approval and delivery stay separate states. Model output cannot mint a human decision. Reconcile cross-store outcomes (SQLite, runtime history, files) and never blindly replay.
- Enabled routes declare their limits and evidence. Missing, partial, failed and uncertain outcomes stay inspectable. Unverified requirements remain unmet scope.
- `engine/` edits (fork of Codex) only when a story requires it. Hooks need adaptation because upstream proceeds silently when a hook fails to run.

## UX & Interaction Patterns

- Keep the conversation clean. Show concise source, account and scope cues before reliance, and open the source, file or result on demand for full provenance. Details remain inspectable and are not removed.
- Start surface: focus begins at the request, the prompt reads "What should we work on?", the applied-method row shows Applied or Not applied from actual inclusion, and Send is disabled with a stated reason when the request is empty. Unreadable attachments stay on their FileChip and the draft is preserved. Unsent text, attachments and the selected Method persist across navigation. Enter submits only in the advertised mode, Shift+Enter inserts a newline, and IME composition never sends.
- Progress: PlanStep is done only when the step finished, running is blue and pending is neutral. Calculations, observations, suggestions, decisions and gaps carry JudgmentTag text, and checked, unchecked and incomplete are told apart in words, not colour alone. Input requests appear in context without stealing focus.
- Workbook tables are semantic, with rows linking to evidence. Horizontal overflow is keyboard-reachable with a labelled boundary, and values are not shrunk. The technical view uses a locally dark console surface with no global dark theme. "No run" is distinct from "run with no findings".
- If composer assistance is unavailable, no suggestion is shown and the Capability Contract records it as not enabled.

## Cross-Story Dependencies

- The stories form a strict chain, 2.1 to 2.18, each listing the one before it as its prerequisite. Epic 1 delivery is required: the shell, Composer, ApprovalCard, capability registry, held-data governance and the Task lifecycle.
- 2.1 and 2.5 each introduce a held-data category and carry their own policy gate. 2.7 (define Method) precedes 2.8 (start with Method), 2.10 (execute), 2.11 (departures) and 2.12 (Coverage). 2.5's minimal error view is deepened by 2.13.
- 2.15 deliberately uses synthetic analysis output. Workbook-hook coverage is completed in Epic 3. 2.16 and 2.17 build on the evidence-versus-instruction rule from Epic 1 (1.27). 2.18 settles the source-authority profile that the earlier stories rely on.
- Shared-control disclosure (Epic 4) and broader administration (Epic 13) come later and do not replace Epic 2's local floor. Representative scale and expected results for 2.12 must be chosen before reliance and are not inferred from earlier work.
