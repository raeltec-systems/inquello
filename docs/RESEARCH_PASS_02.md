# Research pass 2: methodology, reusable foundation and work integrity

**Date:** October 26, 2026. **Status:** first source/documentation pass completed; validation scenarios specified but not executed. Product design, architecture selection and implementation remain deferred.

**Subsequent product decision:** the user assigns built-in audit-record mode to V2. The research below spans the full roadmap; external-record validation applies to V1, while native-record/mode-migration validation applies to V2. See [the updated product brief](PRODUCT_BRIEF_V0_1.md).

## Accepted decisions applied

| Question | User decision | What remains open |
| --- | --- | --- |
| Q1 | B — one organisation's audit team is the first validation setting. | Actual participants, responsibilities, permitted examples and policies. This does not limit the eventual audience. |
| Q3 | A — audit-record mode is selected per organisation/workspace. | Organisation/workspace precedence, migration and record lifecycle. Both modes remain supported in the product direction. |
| Q4 | B — deliberate, reviewable remote-record writeback. | Named destinations, supported operations, identity and reliable state confirmation. Saved-file collaboration is already the baseline. |
| Q7 | B — scoped user-started task execution by default. | Concrete action boundaries and human approval semantics; optional unattended capabilities remain in scope. |
| Q8 | Begin with how Codex currently supports users' methods. | Which auditor adaptations the actual team needs; no new workflow builder has been selected. |
| Q11 | Actual organisational policy determines processing constraints. | Files, inference, tools, connectors, logs, backups and scheduled-run locations. Azure/Bedrock remain candidates, not a topology decision. |

## Findings

**Q8 now has a documented Codex baseline.** Codex combines task examples, persistent instructions, reusable skills, plugins, specialist agents, tools, configuration and optional memory. Our proposed starting point is that same experience: auditors bring their existing work and method, turn repeated procedures into inspectable reusable guidance, and improve it through reviewed results. [Methodology study](CODEX_METHODOLOGY_STUDY.md), [official customization guide](https://learn.chatgpt.com/docs/customization/overview)

**Representative implementation paths are now traced.** The [source report](research/2026-10-26-methodology/SOURCE_TRACES.md) follows instruction discovery/snapshots, skill selection/loading, memory generation/recall, and roles versus policy. The [foundation report](research/2026-10-26-methodology/FOUNDATION_REUSE.md) follows request-to-tool execution and interrupt/resume/history behavior. These are six bounded traces; they are not exhaustive implementation coverage.

**A fork has identifiable reusable components, with service boundaries still to resolve.** Core/CLI, app-server and SDK are concrete candidates. This pass does not establish reusable desktop UI source or transferable hosted services. Authentication eligibility and each capability's supply route need independent confirmation. The product ambition remains the same. [Foundation report](research/2026-10-26-methodology/FOUNDATION_REUSE.md)

**Task recovery does not establish record rollback.** Inspected cancellation/history paths do not reverse external changes; a post-tool block cannot undo an operation already completed. Reviewable writeback must distinguish an approved proposal, attempted execution, uncertain outcome and confirmed destination state. [Source evidence](research/2026-10-26-methodology/FOUNDATION_REUSE.md#t6--cancellation-resume-and-history-are-not-rollback)

**Office compatibility needs measurable cases.** Formula caches, revisions, comments, unsaved state and concurrent edits have distinct semantics. Three synthetic cases now specify expected results and change/failure behavior: reconciliation workbook, procurement workpaper/review, and IT access review with remote writeback. They are documented fixtures, not generated artifacts or passing tests. [Artifact findings and validation specifications](research/2026-10-26-methodology/ARTIFACT_VALIDATION.md)

## Unknown-register progress

| Existing unknown | Progress this pass | Evidence still required |
| --- | --- | --- |
| U1 — feasible and eligible supply routes | Partial: source candidates and authentication/service boundaries identified. | Each hosted feature and dependency; intended team distribution model and eligible service route. |
| U2 — concepts across practices | Proposed contrasting examples, no practitioner evidence yet. | Actual walkthroughs, terminology, outputs, exceptions and review criteria. |
| U3 — remote record operations | Partial: concrete Microsoft conditional-update/session patterns. | Named audit-system contracts; no equivalence to Diligent APIs is assumed. |
| U4 — retained audit record | Q3 scope settled; lifecycle not yet validated. | Team policies, roles, retention, amendments, sign-off, locking, deletion and restore. |
| U5 — change and failure | Partial: source semantics and documented remote failure cases. | Controlled trials of stale evidence, cancellation, conflicts, uncertain writes and revoked access. |
| U6 — quality and scale | Known-result validation specifications prepared. | Executed round trips, population/calculation checks, larger workloads and human correction effort. |
| U7 — cost per accepted output | Measures identified; no estimates or benchmarks asserted. | Baseline team time and actual model/tool/compute/review costs. |
| U8 — audit/competitor gaps | Not materially advanced in this pass. | Further product-first audit-tool inventories and observed workflows. |
| U9 — source mechanisms | Partial: pinned source plus six representative traces. | Complete model loop, compaction, child context/synthesis, persistence, scheduler and client behavior. |
| U10 — portability | Risks and round-trip criteria specified. | Executed file/record export, reimport and workspace-mode migration. |

## Inventory changes discovered

- **GCP/Vertex provider support appears in the pinned public source.** It needs a separate map entry and route verification; the original frozen inventory and generated counts are preserved. This finding reinforces that inventory reconciliation does not establish permanent exhaustiveness. [Source](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/model-provider-info/src/lib.rs#L630-L735)
- **Implementation paths have moved.** Instructions, skills and memory traces now cite current files instead of relying on stale directory descriptions.
- **Customization details vary by release/client.** Current CLI profile format and macOS-only Record & Replay documentation must not be projected onto every client or a fork automatically. [Profiles](https://learn.chatgpt.com/docs/config-file/config-advanced), [Record & Replay](https://learn.chatgpt.com/docs/extend/record-and-replay)

## Evidence method and next research

Three scouts independently examined methodology source, component reuse/execution and artifact/writeback semantics. Sources are primary vendor documentation and pinned public source. The pin is `970111f6cb62cc02fe36a82ea7d71b37a2889c97`, returned for `main` on October 26 with an October 23 commit timestamp. Documentation and that source revision may differ. [Source index](research/2026-10-26-methodology/SOURCE_MANIFEST.json)

An independent reviewer checked decision consistency, evidence boundaries, representative citations and fixture arithmetic. Corrections made: explicit service-account approval evidence, updated decision-status wording and deterministic duplicate matching. A fourth, methodology-specific specification now tests approved instructions versus untrusted evidence and method changes; all four specifications remain unexecuted. [Review and validation record](research/2026-10-26-methodology/REVIEW_NOTES.md)

Next public-source work: complete the uncovered U9 paths, map the newly identified provider route, and build a supply-route entry for each hosted capability. Next empirical work: obtain actual team workflow examples/policies and execute controlled artifact and failure cases using synthetic or appropriately permitted material. Real platform access, purchases, confidential inputs and external writes are not implied by this documentation research.

The immediate decision required from Q8 is no longer an abstract choice among instructions, packs and a builder. We have an evidence-backed Codex baseline to test. Its audit adaptations remain proposals until workflow evidence supports them.
