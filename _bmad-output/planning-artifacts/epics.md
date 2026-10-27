---
status: draft
stepsCompleted: [1, 2]
storyDraftStatus: step-3-generation-complete-consolidated-review-pending
finalValidationStatus: attempted-failed-unresolved-implementation-gates
workflowVariation: owner-approved batch review on 2026-10-27 at 17:04 UTC; no individual-story approvals claimed
previousRunStepsCompleted: [1, 2]
reconciliationStatus: structure-approved-story-review-pending
updated: 2026-10-27
inputDocuments:
  - _bmad-output/specs/spec-inquello/SPEC.md
  - _bmad-output/specs/spec-inquello/scope-and-gates.md
  - _bmad-output/specs/spec-inquello/glossary.md
  - _bmad-output/specs/spec-inquello/collaboration-and-memory.md
  - _bmad-output/planning-artifacts/prds/prd-inquello-2026-10-26/prd.md
  - _bmad-output/planning-artifacts/prds/prd-inquello-2026-10-26/addendum.md
  - _bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md
  - _bmad-output/planning-artifacts/architecture/architecture-inquello-2026-10-26/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/architecture/architecture-inquello-2026-10-26/shared-service-contract-proposal-2026-10-27.md
  - _bmad-output/planning-artifacts/architecture/architecture-inquello-2026-10-26/claude-access-routes-2026-10-27.md
  - docs/addendum.md
  - docs/PRODUCT_BRIEF_TRACEABILITY.md
  - docs/CODEX_AUDITOR_FEATURE_MIRROR.md
  - docs/CODEX_AUDITOR_FEATURE_MAP.md
decisionRecord: _bmad-output/specs/spec-inquello/.memlog.md
vocabulary: Workspace / Engagement / Task per glossary.md (Engagement is the decided term; the older term in root scope artifacts is read as Engagement)
---

# Inquello - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Inquello, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

Inquello is a public-Codex-fork agentic workbench for internal audit, external audit, advisory and IT/IS audit teams (AD-1 to AD-4: public Codex fork, audit semantics separate from the runtime, Electron desktop with React/TypeScript, shared Rust audit modules with a separate working SQLite). The canonical contract is `SPEC.md` with its companions; every stable ID below (CAP-1 to CAP-25, FR-1 to FR-44, NFR-1 to NFR-10, UJ-1 to UJ-8, A01 to A18, AD-1 to AD-17, S01 to S13, SP1 to SP7, OQ-1 to OQ-16, AS-1/AS-2/AS-UX1 to AS-UX4) is preserved as written there.

**Phase rule.** The full V1 target is CAP-1 to CAP-22 (41 FRs) plus the OQ-14 identity and authorisation obligation added on 2026-10-27. CAP-23 to CAP-25 (FR-38, FR-40, FR-42) are V2, as is a hosted agent browser or sandbox (V2 revisit, OQ-13). Grouping into epics is not a scope cut. Under OQ-10 (decided 2026-10-27) the first increment, sequencing and explicit deferrals are decided in this document; every deferral is recorded as unmet acceptance, never silently dropped.

## Reconciliation requirements (2026-10-27)

This update resumes the installed `bmad-create-epics-and-stories` workflow. The prior draft recorded steps 1 and 2 despite containing 89 stories; that is historical state, not evidence of completed story/final validation. The current run records only completed steps. The 17-group story set below has been regenerated under the owner-approved batch-review variation; it remains a consolidated review draft pending final validation and unresolved implementation gates.

The user's explicit “Yes, please proceed. No implementation code at this stage” continues the already-confirmed five-decision requirement baseline (conversation evidence: `Sentinel_3966c14ed92c8191bcfcb94ff30a02b1`); it is not a literal typed C or approval of a new epic ordering. All 25 CAP IDs, 44 FR IDs, 10 NFR IDs, 55 existing UX-DR IDs and the detailed C/E inventory remain in scope. Original V1/V2 boundaries remain. First-increment scheduling is being reconciled, not counted as delivered.

- **RR-1 Delivery order:** eliminate forward dependencies through actual epic/story ordering or splitting, with old-to-new traceability for all 89 stories. A same-file Excel analysis → external edit → recomputation → human/agent review → export checkpoint tests an end-to-end engineering path; it does not narrow the team's eventual validation task choices or the full product scope.
- **RR-2 Hybrid authority:** desktop execution/files plus a shared Inquello identity, membership, permission, sharing and review-coordination service. Provider sign-in is separate. No automatic source-file upload and no V1 authoritative audit-record system. A recipient must actually obtain the permitted artifact version and supporting context; a preparer's local path is insufficient. Vendor, spend, region and detailed protocols remain unapproved.
- **RR-3 Private work and team knowledge:** Tasks start private. File/folder/review-package grants need not expose conversation; whole-Task sharing is explicit. Formally issued or explicitly team-shared work is automatically eligible for institutional memory across different auditors and Engagements in one internal-audit company Workspace, including shared ongoing work. Private exploration is excluded. Admission is distinct from memory contribution/use controls. Preserve origin, period, status, changes and current access; historical similarity does not establish a current/repeat Finding. No cross-company leakage; external-audit client/independence boundaries remain a separate unresolved policy. This supersedes unconditional visibility of all retained extracts.
- **RR-4 First-team-enabled revocation:** membership removal prevents subsequent shared retrieval/recall; withdrawing one share removes that route unless another valid current grant remains. Active agents cease revoked use and retained derived knowledge cannot leak revoked content. Already downloaded/exported copies cannot be recalled. Necessary V1-held-data controls ship with enabled routes; advanced unattended-job reassignment can follow automation. This supersedes blanket Epic 12/A14 deferral.
- **RR-5 Agent-assisted human review:** a reviewer-owned private Task binds submitted version/evidence; tools reperform calculations, check Method and actual Coverage, challenge conclusions/contradictions and compare eligible historical findings. Humans select anchored notes to issue, preparer agents assist revisions, reviewer agents recheck changed/impacted work. Handoff and change impact are precise; uncertainty broadens recheck. No private-thought disclosure, silent submitted-artifact mutation, automatic professional acceptance or claim of agent independence.

The revised 17-group design was approved by the owner at 17:02 UTC on 2026-10-27 (“this structure makes sense”, Sentinel_36c7981e56488191829acb20a782001e). Detailed story generation is complete under the approved batch-review variation; final validation was attempted and remains failed on explicit implementation/owner-review gates. See epic-final-validation-2026-10-27.md. No implementation, runtime fixture execution, tracking generation or remote publication is authorised by this document update.

## Requirements Inventory

### Functional Requirements

Source: final PRD section 4 (IDs global and stable). Each FR names its capability (CAP) and source group (P). All are V1 unless marked **V2**. The "Consequences" sentences define verification intent, not claims of tested capability.

**CAP-1 Organise and recover work (P01)**

- **FR-1 Organise work:** Practitioners can create and organise Engagements, folders, Tasks and concurrent workstreams, including ad hoc Tasks without an Engagement. Consequences: Tasks start private to their creator; Workspace/Engagement membership alone does not disclose them. Relevant entity/client/period and effective Workspace remain visible when supplied; opening an ad hoc Task does not require invented engagement fields; moving or reopening work preserves its permitted references.
- **FR-2 Find and distinguish work:** Users can search, revisit, pin and archive work and distinguish Tasks awaiting input, review or Delivery. Consequences: a reopened Task exposes its saved progress and artifacts; archiving navigation does not imply deletion of authoritative records; search respects effective access and never implies inaccessible content is available.

**CAP-2 Continue across access surfaces (P02)**

- **FR-3 Access the same work through supported surfaces:** Users can start, inspect, steer and continue permitted work through desktop, CLI/session, application-adjacent, mobile/remote and optional physical surfaces, with surface-specific capabilities declared. Consequences: changing surface preserves Task identity and effective authority; unavailable actions are identified rather than simulated; a client cannot gain authority because another surface exposed a Task.
- **FR-4 Preserve session and context controls:** Users retain applicable CLI/session commands, contextual application assistance and physical shortcuts from the inventory. Consequences: each control has a declared action and observable outcome; unavailable integrations are reported; saved-file access is distinguished from live-selection or unsaved-state capability.

**CAP-3 Use environments and alternatives (P03)**

- **FR-5 Make work location explicit:** Users select an available approved environment and see where work executes separately from where model processing occurs. Consequences: a local UI is not labelled proof of local inference; unavailable environments fail intelligibly; environment changes preserve or disclose availability of required sources and artifacts.
- **FR-6 Isolate and promote changes:** Users create isolated alternatives analogous to worktrees, compare results and deliberately promote changes while preserving originals. Consequences: concurrent external edits are detected before replacement; conflicting changes are resolved or left unapplied; alternatives retain origin and promotion history.

**CAP-4 Direct scoped work (P04)**

- **FR-7 Perform and explain scoped work:** The assistant understands a request, plans when useful, executes permitted tools, verifies outputs and reports results, including parallel independent reads. Consequences: progress identifies current work and input needs; results distinguish checked, unchecked and incomplete work; asking for a conclusion does not authorise unrelated external effects.
- **FR-8 Continue, interrupt and recover:** Users steer, interrupt, continue and resume Tasks, including long-running goals and background work. Consequences: interruption distinguishes stopped future work from effects already applied; retained artifacts and external outcomes remain visible; resumption never claims rollback or completion without evidence.

**CAP-5 Use attributable context (P05)**

- **FR-9 Understand permitted material:** The assistant uses folder/file structure, documents, data, images and other declared supported visual material as context. Consequences: relied-on content retains accessible origin/version and limits; unreadable or missing material is identified; an incomplete input set is never presented as full Coverage.
- **FR-10 Capture contextual input accurately:** Users supply supported selections, annotations, application snapshots and composer assistance. Consequences: captured context states whether it is saved or live state and its scope; browser annotations retain source association; a stale snapshot is not treated as current application state.

**CAP-6 Produce checkable analysis (P06)**

- **FR-11 Produce checkable analysis:** The assistant runs permitted calculations and executable work, retaining input definitions, parameters, derivations and outputs needed to explain the result. Consequences: known-result fixtures reconcile; changed inputs cause recalculation or stale marking; executable outputs and errors are inspectable by technical users without making code knowledge mandatory for ordinary review.
- **FR-12 Represent population and sampling honestly:** Users perform full-population or sample-based work under their chosen Method. Consequences: population counts, exclusions, sampling parameters and actual Coverage remain identifiable; duplicate handling is traceable; no universal sampling method is invented and complete Coverage is never inferred from a successful run.

**CAP-7 Create and deliver editable artifacts (P07)**

- **FR-13 Create, edit and continue supported artifacts:** Users create and revise spreadsheets, documents, presentations, datasets, scripts and visuals, inspect previews/changes, and continue editing the same supported saved files externally. Consequences: declared supported formulas, references, comments, revisions, charts, notes and other features survive round trips; unsupported features are disclosed before destructive conversion; intervening user edits are preserved or an explicit conflict is raised.
- **FR-14 Generate and deliver visual or hosted outputs:** Users can generate/edit visuals and prepare supported shared, published or hosted outputs under the required audience and destination authority. Consequences: file/folder/review-package sharing is explicit and independent from entire-conversation sharing; whole Task sharing requires its own explicit action. The selected artifact version and necessary permitted supporting context must be accessible on the recipient computer, not just a sender-local path. The intended audience and included content are inspectable before publication; source/analysis references remain usable where claimed; delivery states distinguish generated, published and verified rather than equating preview with publication.

**CAP-8 Research and use permitted interfaces (P08)**

- **FR-15 Research with attributable sources:** Users ask the assistant to research and cite public or permitted sources using supported web/browser mechanisms. Consequences: material claims carry accessible references and retrieval context; source limitations and estimates are labelled; retrieved instructions never override the Task's authority.
- **FR-16 Use browser, site and computer actions:** The assistant uses available browser context, site-exposed tools and computer interaction under the acting identity and permitted scope. Consequences: relevant account/destination and action outcome are identifiable; a visible browser session grants no blanket authority; unavailable UI context or uncertain outcomes are disclosed rather than guessed.

**CAP-9 Review and investigate technical work (P09)**

- **FR-17 Review, correct and recheck work:** Reviewers can use their own private agent Tasks anchored to a submitted artifact version and accessible evidence to reperform calculations with tools, examine Method and actual coverage, challenge conclusions/contradictory evidence, compare permitted historical findings and draft precise anchored review notes. Humans select which notes to issue; preparer agents help resolve them and reviewer agents recheck changed and impacted work. Consequences: submitted versions are not silently mutated and private reviewer thoughts/unselected notes are not automatically shared. Revision handoffs identify per-note resolution, changed evidence/Method/coverage/conclusions and precise impact; uncertain impact requires broader recheck rather than claiming unchanged work. Human acceptance remains required under actual authority, and agent agreement does not establish professional independence. Findings retain scope, evidence, uncertainty and revision context; unsupported findings are distinguished from established errors; a correction or agent recheck does not automatically close a Finding or grant Professional Approval.
- **FR-18 Retain actual technical and security capabilities:** Technical specialists inspect code/configuration, perform permitted security analysis, manage available scans/findings and pursue focused follow-up investigations. Consequences: source/script results remain accessible; inherited findings and backlog work retain provenance; specialist service/model eligibility and coverage limits are visible.

**CAP-10 Teach and reuse methods (P10)**

- **FR-19 Turn guidance into reusable work:** Users provide task examples, maintain standing instructions, author/select skills with templates/references/helpers, and use eligible demonstration-to-skill capabilities. Consequences: applicable guidance, Method version and parameters are inspectable; missing dependencies are reported; no new general workflow engine is required; case evidence is not copied into shared guidance without authority.
- **FR-20 Preserve Method authority and departures:** Users distinguish task guidance, maintained Methods, memory and enforced policy, with versions and explicit departures recorded for relied-on work. Consequences: changing a Method identifies affected outputs; wider-distribution review follows actual team policy (OQ-4: inherited Codex mechanisms, no managed catalogue); an instruction file, skill invocation or agent title cannot grant access or establish professional acceptance.

**CAP-11 Discover and extend tools (P11)**

- **FR-21 Discover and use permitted capabilities:** Users discover/use built-in tools, connected apps, MCP tools and plugin/marketplace packages under effective permissions. Consequences: capabilities, identity, dependencies and limitations are visible; missing access differs from missing functionality; discovering or installing guidance never grants a connector's credentials.
- **FR-22 Extend and integrate execution:** Teams use supported hooks, app-server integration and client-supplied tools with declared contracts. Consequences: hook success/failure and resulting enforcement are observable; prose guidance differs from technical restrictions; unsupported integration versions fail intelligibly rather than silently skipping a claimed check.

**CAP-12 Run programmatic and continuous work (P12)**

- **FR-23 Run programmatic work:** Teams initiate permitted batch/SDK and non-interactive tasks and receive structured results and structured streaming where supported. Consequences: task identity, progress, errors, actual Coverage and completion state remain available to the caller; output follows a declared versioned contract; programmatic access never bypasses resource or action policy.
- **FR-24 Run bounded schedules and events:** Teams configure supported schedules/events with trigger, inputs, Method, acting identity, budgets/limits, destination and escalation. Consequences: missing/not received, not run, incomplete, failed and completed-with-no-reported-exceptions are distinguishable; duplicate events never cause uncontrolled repeated effects; continuous assurance reports observed Coverage only.

**CAP-13 Delegate and compare alternatives (P13)**

- **FR-25 Delegate and consolidate bounded work:** Users delegate to focused agents, inspect progress, consolidate results and see disagreements and incomplete Coverage. Consequences: delegated tasks retain scope/source references; conflicting shared writes are coordinated or isolated; an agent review cannot appear as a human decision or confer professional independence.
- **FR-26 Explore without losing origin:** Users create side chats, forks, references and alternate branches/analyses while retaining the relation to the originating Task. Consequences: alternatives are distinguishable from accepted changes; origins and context remain accessible; rejoining results never silently overwrites another agent's or human's changes.

**CAP-14 Control continuity and memory (P14)**

- **FR-27 Resume with scoped knowledge:** Users can resume history and manage limited active context through compaction while retaining accessible source and decision references. Users can inspect and control memory use and contributions separately, subject to effective policy. Consequences: missing context or changed access is identified; personal preferences, approved reusable knowledge and Engagement/client evidence remain distinguishable; users can identify what may contribute to memory and what retained knowledge may be used; institutional memory is team-wide across engagements and different auditors of the same internal-audit company Workspace. Issued or explicitly team-shared work is automatically eligible, including ongoing work; private exploratory drafts/conversations are excluded. Admission is separate from generic contribution/use controls. Preserve origin, period, status, changes and current access; historical recall supports investigation, not proof of a current/repeat finding. No cross-company leakage; external-audit client/independence specifics remain OQ-15.
- **FR-28 Control activity recall:** Users enable, inspect and control permitted recall of application/site activity separately from conversation history and Methods. Consequences: capture/use controls and original references are visible; disabled or out-of-scope activity is not claimed as captured; reuse and revocation obey effective policy for retained material.

**CAP-15 Select routes and control consumption (P15)**

- **FR-29 Use permitted processing routes:** Teams use allowed models, organisational gateways, local-model routes and service identities, retaining Bedrock, Azure Foundry/Azure OpenAI and the named GCP/Vertex route (OQ-9: every documented route stays in scope and is tested; eligibility verified per route before real data). Consequences: effective provider/deployment and capabilities are identifiable; an unsupported operation never silently switches route; execution, inference and connector data flows are distinguishable.
- **FR-30 Control reasoning, speed and consumption:** Users select available reasoning/speed choices and inspect usage under configured limits (OQ-5: inherited Codex usage handling; no Inquello budget values for first validation). Consequences: enabled limits have observable enforcement and an explained stop/escalation; tool/model costs are attributable to accepted deliverables.

**CAP-16 Retain convenience and scoped migration (P16)**

- **FR-31 Retain interaction and attention aids:** Users use supported voice/dictation, notifications and optional task companions. Consequences: voice-derived instructions are inspectable and correctable; notifications distinguish attention needed from completion; companion state never determines Professional Approval or audit completion.
- **FR-32 Migrate setup and share scoped snapshots:** Users can import supported setup/history and share selected conversation snapshots under an explicit audience. Consequences: artifact/package sharing need not share a conversation; whole Task sharing is separate and explicit. Imported items and transfer limitations are reported; snapshots expose only selected permitted content; migration does not silently copy unavailable credentials, grant authority or change Record Authority.

**CAP-17 Enforce authority and input trust (P17)**

- **FR-33 Enforce effective action authority:** Teams can apply sandbox/permission profiles, command rules, approvals, managed policy and source identity. Default execution is a scoped user-started Task; broader/no-prompt modes require an explicit permitted configuration. Consequences: Inquello identity and permissions are owned by its shared service, separately from provider sign-in; local desktop execution/files do not confer team access. Negative permission cases prevent the prohibited action; an approval identifies its action/scope and cannot become blanket Professional Approval; eligible automatic review, prompt inspection and specialist access retain declared limits.
- **FR-34 Treat evidence as data:** The assistant distinguishes trusted task/policy instructions from instructions embedded in Sources, retrieved pages, tool results or examples. Consequences: malicious instructions in evidence never change the authorised mandate; blocked or inspected actions disclose limits; tool/hook configuration is not proof that every untrusted input was detected.

**CAP-18 Assign responsibility and revoke access (P18)**

- **FR-35 Assign work and human review:** Teams can assign Task and Human Review responsibility with Workspace/Engagement access and attribution. Consequences: reviewer agent work is private by default and bound to the submitted version/evidence; only human-selected notes are issued. The responsible human and reviewed version are identifiable; multiple responsibilities can coexist where permitted; reviewer hierarchy and guest rights follow selected policy, not a hard-coded firm structure.
- **FR-36 Reassign and revoke access:** Administrators can handle access revocation, reassignment and departures, including retained work and unattended job ownership. Consequences: first-team-increment Workspace removal blocks subsequent shared retrieval/recall; withdrawing a share removes that route unless another current valid grant exists. Active agents cease revoked use, and retained extracts, derived knowledge, summaries/indexes/caches and diagnostic/export routes must not leak revoked content. Previously downloaded/exported copies cannot be magically recalled. Advanced unattended-job reassignment follows with automation; orphaned jobs are surfaced under policy. Retained material is addressed separately from current access rather than assumed deleted.

**CAP-19 Govern V1-held material (P19)**

- **FR-37 Govern V1-held material:** Teams can apply applicable access, retention, deletion, export and recovery policy to working files/history, evidence references, logs and telemetry held by Inquello. Consequences: access/retention/deletion/export/recovery controls for actually enabled local/shared categories ship with those routes, including derivative non-disclosure after revocation; V2 native hold/amendment policy is not imported into V1. These categories are distinguishable from external authoritative records; usage/task counts do not stand in for accepted work or Coverage; recovery/export declares losses and respects relevant access.

**CAP-23 Govern native records (P19) - V2**

- **FR-38 Govern native audit records - V2:** Native-record mode supports retention, deletion, hold, amendment and recovery obligations with attributable history. Consequences: permitted record changes and retention decisions are identifiable; hold/deletion conflicts follow configured policy; recovery preserves records, relationships and history or reports limitations. V2 delivery conditions, not V1 gates. Depends on OQ-11.

**CAP-20 Support external-record practice (P20)**

- **FR-39 Coordinate practice workflows using external records:** Practitioners plan/scope, manage procedures and evidence requests/receipt, analyse, prepare workpapers, review, report, handle responses and follow up using artifacts and external systems, and prepare stakeholder communications through approved tools (OQ-6: no named external record system for first validation; import/export only). Consequences: external-audit, advisory and technical examples work without mandatory control objects or deficiency states; the Method determines transitions; a Finding is never professionally closed merely because a Task completed.

**CAP-24 Use native practice records (P20) - V2**

- **FR-40 Carry workflows through native records - V2:** Native-record mode links practice workflows to native Engagements, procedures, Sources, workpapers, Findings, decisions, Responses, Actions and Retests. Consequences: identities and relationships survive revision; Professional Approval names the authorised human, scope and version; amendments identify affected prior approvals. A guest portal remains a separate open choice. Depends on OQ-11.

**CAP-21 Verify external delivery (P21)**

- **FR-41 Review and verify external updates:** Users inspect a specific destination, proposed changes and supporting evidence, authorise the required action and verify the resulting external record state; import/export remains a supported fallback (OQ-6: import/export is the first-validation route). Consequences: unrelated fields remain untouched; current state/version is checked; stale proposals and uncertain outcomes require reconciliation, not blind retry; operation/destination identity is retained; missing conditional-update or deduplication support is declared; audit-record writeback grants no source-transaction authority.

**CAP-25 Select and migrate record authority (P21) - V2**

- **FR-42 Select and migrate record authority - V2:** Organisation/Workspace configuration selects the permitted record mode and supports deliberate migration with an identified destination and verified results. Consequences: Tasks/Engagements never silently change authority; operational systems remain separate; export/migration identifies transferred records, artifacts, relationships/history and declared limitations. Policy precedence is OQ-11.

**CAP-22 Preserve coherent, inspectable work (P22)**

- **FR-43 Preserve meaning across boundaries:** Users can delegate, switch editors or environments, review and resume without manually reconstructing Task context or losing artifact identity. Consequences: sources, Method, artifacts, decisions and actual status remain accessible under current grants across the boundary; unsupported transfers disclose missing context. Handoffs identify artifact/evidence versions, per-note resolution and precise change impact; uncertain impact requires broader recheck. External edits and changed evidence or Method identify affected outputs and approvals.
- **FR-44 Make scope and completion claims inspectable:** The product exposes actual completion states and maintains Capability Contracts for the mapped behaviours, including smaller and technical capabilities. Consequences: planned/running/blocked/interrupted, produced, checks incomplete/complete, review/revision, Professional Approval and attempted/confirmed/uncertain Delivery remain distinct; no universal state machine; capability-specific acceptance exists for enabled routes and the full inventory; any deferral is named unmet scope.

### NonFunctional Requirements

Source: final PRD section 5. All apply to enabled capabilities in their phase; policy-specific values are set at their gates (OQ-7 measure first, OQ-8 after first validation).

- **NFR-1 Artifact fidelity:** For each declared supported file feature/version, round-trip fixtures preserve meaning and unrelated content. Unsupported macro/link/signature, formula/cache, comment/revision, chart/theme/notes or conversion cases are identified before destructive modification. Verification includes saved external edits and concurrent-change cases (FR-6, FR-13). First-validation formats: Excel, Word, PowerPoint, CSV (OQ-6).
- **NFR-2 Analytical reliability:** Known-result populations reconcile, including boundary and duplicate cases; reported Coverage matches examined inputs. Record wrong/missed exceptions and reviewer correction effort. Retain sufficient inputs/parameters/derivations for a reviewer to check relied-on results (FR-11, FR-12, FR-17).
- **NFR-3 Confidentiality and access:** Negative tests across clients, Workspaces, Sources, delegation, memory, artifacts and sharing prevent access/actions outside effective authority. Revocation cases cover ongoing/unattended work and retained material. A folder label alone is insufficient evidence of isolation (FR-27, FR-33 to FR-37).
- **NFR-4 Recovery and duplicate effects:** Test cancel/resume, session loss, crashes, duplicate events, stale versions and uncertain external outcomes; each preserves usable retained work, reports applied effects and prevents blind repeated Delivery. Recovery time and tolerable data loss targets follow OQ-8 (FR-8, FR-24, FR-41).
- **NFR-5 Usability and accessibility:** Practitioner walkthroughs demonstrate inspection of progress, evidence, changed inputs and review decisions without code expertise. Keyboard access to core actions and comprehensible failure/status messages on each declared client. Conformance targets follow OQ-8 (FR-2, FR-13, FR-43).
- **NFR-6 Performance and cost:** Representative small/large workload profiles measure elapsed time, interruptions, tool/model/resource cost and total effort through acceptance. Enabled limits are enforced visibly. Latency, concurrency and budget targets follow the team baseline (FR-7, FR-23, FR-30).
- **NFR-7 Evidence and decision provenance:** Relied-on outputs expose origin/version, input scope, Method, derivations, uncertainty and applicable human decision. Changed evidence/Methods/content identify affected results and approvals. V1 confirms formal approval through the external authority; V2 preserves native attribution/version history (FR-9, FR-20, FR-35, FR-40).
- **NFR-8 Processing transparency:** Policy evaluation separately addresses files, execution, inference, browser/connector traffic, history/logs, backups and unattended runs. Declared routes match observed routes in validation; unsupported requests never silently change route (FR-5, FR-29, FR-33).
- **NFR-9 Portability and compatibility:** Export/migration and each supported integration/client/provider version need reopen/reimport or equivalent outcome checks, declared losses and regression cases. Provider availability is not represented as universal feature compatibility (FR-3, FR-22, FR-32, FR-42).
- **NFR-10 Operational visibility:** Operators and responsible users distinguish unavailable triggers, failures, partial work, identity/access problems, uncertain Delivery and recovery state. Diagnostic detail follows the same data policy as other retained material; successful Task/token counts are never labelled assurance Coverage (FR-24, FR-37, FR-44).

### Additional Requirements

#### Starter foundation (affects Epic 1, Story 1)

- **AD-1 Public Codex fork foundation [ADOPTED]:** Inquello is derived from public `openai/codex`, inheriting verified runtime/app-server contracts at an identified revision. The inspected revisions (`970111f6cb62cc02fe36a82ea7d71b37a2889c97` and main `efab30992b28bb8fc5064dbac9c12090b8818e98`) are evidence snapshots, not the silently selected delivery cut. **The first story must select and record the actual fork cut and verify API/toolchain compatibility before dependent code.**
- **Historical stack seeds (not freshly verified in this update; not a validated combined stack):** Electron 45.0.0, React 19.3.1, TypeScript 5.9.2, Rust 1.99.1 (edition 2024), pnpm 10.34.5. SQLite is adopted; the domain-store driver/runtime must include the WAL-reset corruption fix (SQLite 3.51.3+ or a documented fixed backport) and be verified independently of the upstream state-store check.
- **Structural seed (package names are seed, not mandatory directories):** `fork/codex-rs/{core, core-api, app-server, ext}` retained runtime and integration seams; `{rollout, state, thread-store}` retained runtime continuity; `inquello-domain/` audit commands, rules and ports; `inquello-adapters/` runtime, SQLite, file and external adapters; `fork/desktop/` Electron main/preload and React interface.
- **Transport warning:** upstream documents the app-server command and WebSocket transport as experimental/unsupported for production in the remote Code Mode host context. Default stdio availability establishes neither blanket production support nor Inquello readiness; the selected fork/route must be verified and hardened before release.

#### Architecture rules binding every story (AD-2 to AD-17)

- **AD-2 Separate audit semantics from the runtime:** retain the Codex runtime/app-server; place evidence, Method, review and record logic in Inquello modules; make focused core changes only where needed.
- **AD-3 Electron desktop with React/TypeScript:** build the interface on the supplied DESIGN/EXPERIENCE contract; assume no reusable private OpenAI desktop source.
- **AD-4 Shared Rust audit modules and separate working SQLite [ADOPTED]:** Implement audit evidence, Methods, review and working records in shared Rust modules within the fork; all supported audit entry paths use them. Store Inquello working metadata in separate local SQLite. Electron owns interface/application lifecycle; V1 formal audit-record authority remains external. This store is not shared-service authority; AD-15 owns shared identity/permissions/coordination. Neither store confers native V2 record authority.
- **AD-5 Directed dependencies and constrained desktop privilege:** sandboxed, context-isolated renderers without Node authority; preload exposes specific operations; main validates payloads/senders, controls navigation, owns the packaged Rust child and its stdio lifecycle; no general IPC/shell/`child_process` bridge; artifact and source previews render in a distinct sandboxed security context that cannot submit human decisions; generated protocol schemas match the actual runtime version; stderr stays outside protocol output; initialisation, backpressure, disconnect and shutdown are handled explicitly.
- **AD-6 Stable work linkage and separate state authorities [DERIVED]:** Keep stable Workspace, optional Engagement, Task, Source and Artifact identity with explicit runtime thread/turn/item/branch references and origin. The shared Inquello identity/authorisation service supplies authenticated acting/reviewer identity, membership and current permitted scope; the trusted host validates that scoped authority and fails closed for shared use when it cannot establish it. Model output cannot mint a human decision. Provider/connector credentials are not organisation review authority. Preserve separate run, artifact, checks, human-review, Professional Approval and delivery states with applicable scope/version. The shared domain owns a common reviewed-basis revision covering decision-relevant outputs, Sources/evidence, Method/departures and policy versions; review and delivery use that same reference. Retained historical decision attribution is immutable and distinct from current applicability. No universal audit state machine is imposed.
- **AD-7 Owned mutations and cross-store recovery [DERIVED]:** Each Task/working record has one logical domain mutation owner. Local domain commands own private/local working state; the shared service owns membership, grants, shared coordination and registered/shared version references (technical publication, not Professional Approval). A published version is immutable; revision is a new version, not mutation of the submitted basis. Local replicas/caches are not independently writable shared authority. Domain commands validate authority, relevant expected versions and operation identity; the domain repository owns writes/migrations. Deny general agent tools and their subprocesses direct reads/writes of the protected domain store and privileged credential storage; expose permitted working records through scoped domain commands. Keep privileged credentials within trusted runtime credential facilities or adapters, allowing scoped authentication without exposing raw secrets to model context, arbitrary tools/subprocesses, artifacts, exports or logs. Enforce these boundaries in every enabled execution mode or gate that route. Agent-driven interactions cannot establish human reviewer decisions. Persist required intent/outcomes. Across SQLite, runtime history and files, reconcile using supported IDs/status or expose uncertain/unlinked work; never blindly replay thread creation or claim a shared transaction. Cross-host ownership/version transfer must be explicit and verified; otherwise that route remains gated, without independently writable replicas or implied synchronisation.
- **AD-8 Scoped context, permission and processing routes (read with OQ-14: identity comes from the Inquello auth module, not provider sign-in; and OQ-13: V1 browser/sandbox routes are local):** trusted instructions separate from evidence; source origin/version, saved/live scope and access limits retained; authority rechecked on use, resume and mutation; revocation covers active/unattended work; execution, inference, browser/connector, files, history/logs, backups and unattended routes distinguished; no silent fallback; no credential grant from plugin discovery; no permission grant from a Method; gateway/local-model, Bedrock, Azure Foundry/Azure OpenAI and GCP/Vertex routes preserved with per-route eligibility.
- **AD-9 Artifact identity and conflict-preserving changes:** same supported saved files and unrelated content preserved; live application and remote-record access distinguished; versions compared before replacement; intervening edits preserved or conflicts left unapplied; alternatives promoted deliberately with origin history; input/Method/derivation, population, exclusions, duplicate treatment, sampling parameters and actual coverage retained; changed inputs recompute or mark stale; reviewed-basis changes mark decision applicability stale; unsupported conversions disclosed before destructive change.
- **AD-10 Method departures and knowledge boundaries [DERIVED]:** Retain Method/version/parameters and permitted Task-specific departures, rationale and affected scope separately from shared-guidance changes. Expose them with relied-on outputs and identify changed-Method/evidence impacts. Keep memory contribution, memory use, history and optional activity capture/recall distinct under policy. Denied departures remain unapplied; no silent case-to-team Method promotion. Team-wide institutional recall follows AD-16 admission and current access, not unconditional visibility of retained extracts. It is isolated between company Workspaces; external-audit client boundaries remain OQ-15. Preserve instructions, skills, tools, agents and eligible demonstration-to-skill mechanisms without imposing a general workflow engine.
- **AD-11 Bounded external effects and reconciliation:** operation/destination/acting identity, exact authorised content and relevant version retained before effects; configured permission or an AD-12 mandate applied; execution through the supported adapter with destination verification; attempted/confirmed/uncertain outcomes recorded; stale proposals return to review; uncertain effects reconcile before retry; destination conditional-update/deduplication used where available and its absence disclosed; no invented idempotency; import/export fallback kept; audit writeback grants no source-transaction authority.
- **AD-12 Automation mandates and collaboration ownership [DERIVED]:** Retain trigger/input/Method/identity/limits/destination/escalation mandates and actual event/run outcomes. Each accepted run and its effects bind to one immutable authorised mandate revision. Configuration changes apply prospectively unless a trusted, explicit domain rebind records the authority and impact checks for running work. Current revocation and restrictive policy always apply. Disabling changes future eligibility; handle running work separately. Enforce ownership/revocation and duplicate-effect controls across supported entry paths using shared domain rules. Observe execution-host/context availability; never assume automatic cloud continuation. Scheduler, team-coordination and hosted-route gaps remain required V1 implementation dependencies with the owners/gates below. AD-15 selects the shared-service responsibility boundary; its implementation and the scheduler supply remain unproven. Basic sharing revocation is mandatory before first team enablement; advanced unattended-job reassignment can follow with automation.
- **AD-13 Phase-specific record authority [DERIVED]:** V1 retains useful local working/review records and links any Method-required formal acceptance to verified designated external authority. Preserve authorised human/scope/version attribution and affected approvals. V1-held files, histories, extracts, derived knowledge and shared coordination still require access, retention/deletion and recovery controls for enabled routes. Only V2 adds FR-38/40/42 native authoritative record identity, relationships, lifecycle, hold/amendment/retention, recovery/export and deliberate organisation/Workspace migration. Tasks/Engagements cannot silently change authority; operational source systems remain separate. V2 policy is not a V1 gate.
- **AD-14 Capability evidence and operating commitments:** each enabled route declares owner, implementation/service supply, identity/processing/source limits, versions and capability-specific acceptance; missing/partial/failed/uncertain outcomes, diagnostics, recovery and cost evidence inspectable under data policy; deferred or unverified requirements remain unmet scope.
- **AD-15 Hybrid authority and explicit private-to-shared handoff [ADOPTED]:** Desktop executes agents and holds local working files; a shared Inquello service owns its own authenticated identities, memberships, grants and shared coordination. Provider sign-in remains separate. Tasks are creator-private by default. Grant file/folder/review-package access independently of conversation/history; whole-Task access requires explicit sharing. Every shared operation binds Workspace, actor, object, immutable version or declared folder scope, recipient/audience and permissions. Sharing selected artifacts/context is deliberate, not automatic upload of all sources. A recipient must actually access the authorised artifact version and relied-on evidence/Method/coverage context through a permitted transfer or materialisation route; sender-local paths alone never satisfy a handoff. Missing/inaccessible/version-mismatched context is blocked or partial, not silently substituted. Shared requests validate current authority and expected revision at the service; local caches cannot grant access. AD-18–22 and SC-1–6 now propose detailed protocol, service seed and materialisation; OQ-16A direction is adopted; OQ-16B actual-route gates remain.
- **AD-16 Team-wide knowledge admission and basic revocation [ADOPTED]:** Within an internal-audit company Workspace, formally issued or explicitly team-shared work is automatically eligible for shared knowledge admission, including ongoing shared work; private exploratory drafts and conversations are excluded. Admission is distinct from generic contribution/use controls: those controls cannot broaden eligibility or create a grant. This supersedes unconditional Workspace visibility of all retained extracts under earlier OQ-2/OQ-3 language. Knowledge preserves source/version, originating engagement, period, finding/status history and changes, admission basis and access lineage; historical recall aids investigation and is not evidence of a current or repeat finding. Current grants apply on every retrieval and use; no cross-company Workspace leakage. Workspace removal blocks subsequent shared retrieval/recall. Share withdrawal removes that route unless another current valid grant covers the exact content/action. Active agents cease revoked use and dependent actions; revocation reaches task context, caches, indices, summaries and other derived knowledge, including restored state, so these cannot re-expose prohibited content. If current access or derived lineage is unprovable, block shared recall/use. Basic enforcement and necessary retained-data controls ship before first team enablement, not with later automation. Already downloaded/exported copies cannot be magically recalled. Advanced unattended-job reassignment remains with automation. External-audit client/independence boundaries require OQ-15 before enabling those routes.
- **AD-17 Private reviewer-agent work and versioned human handoff [ADOPTED]:** Reviewer creates a private Task anchored to the immutable submitted version and common reviewed-basis revision. With permitted accessible evidence, the agent uses tools to recalculate/reperform, inspect Method and actual coverage, challenge conclusions and contradictory evidence, and compare admitted historical findings. It drafts notes precisely anchored to artifact/version/location or scoped evidence/Method/coverage. The human chooses notes to issue; private conversation and unissued notes stay private unless explicitly shared. Preparer-agent revisions produce a new version with a handoff summary identifying changes, supporting basis, resolved/unresolved notes and exact known impact. Reviewer agent rechecks changed and impacted work; uncertain impact widens the recheck and never certifies untouched scope as unchanged. No agent silently mutates the submitted artifact or professionally accepts work. Human acceptance remains attributable to person/scope/version under Method and V1 external authority; agent agreement does not establish professional independence.
- **Consistency conventions:** identifiers stable and scope-qualified across client/runtime/destination references; runtime events describe runtime facts while domain commands establish domain outcomes; errors retain operation identity, applied effects and recovery status; a toast, completed turn or green chip establishes no acceptance; confirmed saved work and review/context references preserved; no universal offline, queued-write, reconnect-resend or rollback promise.

#### Implementation and supply gates (owned delivery work, not scope cuts)

- **Scheduler/event/mandate route:** prove actual production supply beyond queue/heartbeat primitives before enabling or promising FR-23/FR-24 routes; FR-23/24 remain V1.
- **Sharing, review and cross-host ownership:** local threads/SQLite do not implement FR-35/36 team authority or remote continuity; verify explicit ownership/version transfer or gate that route.
- **Remote execution and connected services:** name service, identity, context and eligibility per route (OQ-6/OQ-9); no inferred hosted backend, automatic cloud handoff or fully local inference.
- **Environment and operating envelope:** workload, support/availability, recovery/loss, deployment/data eligibility and retention set after first validation (OQ-8); synthetic fixtures may proceed; real-data/production promises wait.
- **Local desktop/context availability:** validate computer/app/connection availability for locally sourced schedules; disclose unavailable/interrupted work.
- **Implementation seed and compatibility:** fork cut, facade/extension/protocol seams, compiler/package/driver compatibility, migrations, conflict mechanics, secure data paths, packaging/update and ownership-transfer contracts.

#### Capability, phase and acceptance index (from scope-and-gates.md)

| CAP | Phase | FRs | Relevant NFR | Journeys | Acceptance |
| --- | --- | --- | --- | --- | --- |
| CAP-1 | V1 | FR-1, FR-2 | 3, 5, 7 | UJ-1, UJ-2 | A01, A09 |
| CAP-2 | V1 | FR-3, FR-4 | 3, 5, 9 | UJ-1, UJ-3, UJ-5 | A09, A15, A16 |
| CAP-3 | V1 | FR-5, FR-6 | 1, 4, 8 | UJ-3, UJ-5 | A04, A09, A18 |
| CAP-4 | V1 | FR-7, FR-8 | 4, 6, 10 | UJ-1 to UJ-8 | A01, A09, A13, A18 |
| CAP-5 | V1 | FR-9, FR-10 | 2, 3, 7 | UJ-1, UJ-3, UJ-6 | A01, A03, A05, A17 |
| CAP-6 | V1 | FR-11, FR-12 | 2, 6, 7 | UJ-3, UJ-5 | A03, A06, A18 |
| CAP-7 | V1 | FR-13, FR-14 | 1, 5, 7, 9 | UJ-3, UJ-4, UJ-6 | A03, A04, A05, A17 |
| CAP-8 | V1 | FR-15, FR-16 | 3, 7, 8 | UJ-1, UJ-5, UJ-6 | A01, A02, A06, A10 |
| CAP-9 | V1 | FR-17, FR-18 | 2, 5, 7 | UJ-2, UJ-4, UJ-5 | A05, A06, A08 |
| CAP-10 | V1 | FR-19, FR-20 | 3, 7 | UJ-7 | A07 |
| CAP-11 | V1 | FR-21, FR-22 | 3, 8, 9 | UJ-5, UJ-7 | A07, A15, A16 |
| CAP-12 | V1 | FR-23, FR-24 | 3, 4, 6, 10 | UJ-8 | A13, A14, A18 |
| CAP-13 | V1 | FR-25, FR-26 | 3, 4, 7 | UJ-5, UJ-8 | A08, A09 |
| CAP-14 | V1 | FR-27, FR-28 | 3, 4, 7 | UJ-1, UJ-7 | A07, A09, A14 |
| CAP-15 | V1 | FR-29, FR-30 | 6, 8, 9 | UJ-1, UJ-5 | A15, A18 |
| CAP-16 | V1 | FR-31, FR-32 | 3, 5, 9 | UJ-1, UJ-8 | A09, A14, A16 |
| CAP-17 | V1 | FR-33, FR-34 | 3, 7, 8 | UJ-1 to UJ-8 | A07, A14, A15 |
| CAP-18 | V1 | FR-35, FR-36 | 3, 7, 10 | UJ-2, UJ-4 | A08, A14 |
| CAP-19 | V1 | FR-37 | 3, 4, 9, 10 | UJ-2, UJ-8 | A09, A11, A14, A18 |
| CAP-20 | V1 | FR-39 | 2, 5, 7 | UJ-2, UJ-4, UJ-6, UJ-8 | A02, A05, A06, A10, A11, A13 |
| CAP-21 | V1 | FR-41 | 3, 4, 7, 9 | UJ-4, UJ-5, UJ-8 | A10, A11 |
| CAP-22 | V1 | FR-43, FR-44 | 1 to 10 | UJ-1 to UJ-8 | A01 to A11, A13 to A18 |
| CAP-23 | V2 | FR-38 | 3, 4, 7, 9 | UJ-2, UJ-8 via SP7 | A12 |
| CAP-24 | V2 | FR-40 | 3, 7, 9 | UJ-2, UJ-4, UJ-6, UJ-8 via SP7 | A12 |
| CAP-25 | V2 | FR-42 | 3, 4, 7, 9 | UJ-4, UJ-5, UJ-8 via SP7 | A11 (V2 part), A12 |

#### Journeys (all V1; SP7 extends them into V2)

- **UJ-1** Amina (Internal Auditor) answers an ad hoc question from existing files without Engagement setup; sources, uncertainty and coverage inspectable; continuation without reconstruction.
- **UJ-2** Amina and Noah (Internal Audit Manager) carry an Engagement through review to a reviewable reporting package with decision/Delivery state under the external authority.
- **UJ-3** Amina continues a reconciliation in Excel: same saved file edited externally; changed inputs recomputed or marked stale; supported formulas/comments/references preserved; conflicts explicit (fixture W1).
- **UJ-4** Amina and Noah revise a Word workpaper through Word or Inquello; approval in the designated record authority; accepting a text change does not approve a conclusion (fixture W2).
- **UJ-5** Dev (IT Auditor) reconciles specialist investigations: delegated access/configuration/code-security work; population/coverage, disagreements, gaps visible; no agent impersonates the human reviewer (fixture W3).
- **UJ-6** Amina develops advisory options: research, compare, options paper or presentation; facts/assumptions/recommendations distinct; no deficiency workflow forced (A17 presentation round trip).
- **UJ-7** Amina teaches and reuses a procedure: Method version, parameters and departures visible; client evidence never silently becomes shared Method or memory (fixture M1).
- **UJ-8** Noah follows a triggered procedure through: schedule/event mandate, run outcomes, authorised Delivery, retest; agent completion never equals assurance or closure.

#### Validation fixtures and acceptance evidence (unexecuted; exact rules in the PRD addendum)

- **W1 Excel reconciliation:** five ledger rows (R1=1,000; R2=1,500; R3=500; R4=900; R5=700) and six bank rows (R1=1,000; R2=1,500; R3=500; R3=500; R4=950; R6=300); IDs L01 to L05 / B01 to B06; match equal reference/amount by ascending source ID so L03 matches B03 and B04 stays unmatched; three exact matches; totals 4,600/4,750; excess 150; saved R5=800 changes the ledger to 4,700 and excess to 50; stale formula caches, intervening editor changes, named ranges, comments, formatting and an unrelated sheet tested; no source transaction changed.
- **W2 Word procurement workpaper:** policy v1 requires two prior approvals above 5,000; order 7,800 has approval A before and B after; report one prior and one later approval; preserve comments, tracked deletion, footnote, table, bookmark and attribution; v2 threshold 10,000 requires its effective period before reassessment; broken citations detected; Professional Approval pending until the authorised reviewer acts.
- **W3 Access review and external update:** HR E01 to E05 (E02 terminated); accounts A1/E01, A2/E02, A3/E03 disabled, A4/E04, A5/E99, A6/service owned by E05 with valid approval, A7/E01; preserve all seven; investigate A2 and A5; recognise A6; keep A7; test an approved finding update against a named destination with a record changed after review, a response lost after success and revoked credentials; reconcile before retry.
- **M1 Method authority:** approved procedure v1, template and example alongside evidence containing instructions to ignore exceptions or bypass review; approved guidance used, evidence facts retained, embedded instructions untrusted; guidance identity and loaded references recorded; missing dependencies surfaced; v2 identifies affected outputs; a case correction never silently becomes a team rule.
- **A01 to A18:** A01 ad hoc output and continuation; A02 external-audit/advisory without mandatory controls; A03 W1 reconciles exactly; A04 stale caches and external edits; A05 W2 approval timing and effective policy; A06 W3 seven accounts and technical review; A07 M1; A08 parallel agents and write coordination; A09 resumed/compacted work and no false rollback; A10 remote update preserves unrelated fields and confirms state; A11 V1 external authority/export versus V2 mode/migration; A12 V2-only native records; A13 scheduled/event work outcomes; A14 revocation, reassignment, sharing scope; A15 route capabilities without silent substitution; A16 smaller capabilities tested individually, deferrals remain unmet; A17 presentation fidelity; A18 total effort/accuracy/cost/recovery against baseline.
- **Success measures:** SM-1 total effort per accepted deliverable; SM-2 traceable acceptance; SM-3 cost per accepted deliverable; SM-4 recovery outcome; counter-metrics SM-C1 wrong/missed results, SM-C2 review burden, SM-C3 confidentiality/authority failures (negative authority cases pass before enabling a route), SM-C4 artifact loss/duplicate effects. Thresholds follow the validating internal audit team's baseline (OQ-7).

#### Decided gates binding this breakdown (decided 2026-10-27)

- **OQ-1** team-only participation; no guest UX in V1.
- **OQ-2** retain references plus relied-on extracts/derivations; no automatic all-source capture/upload. Retention alone grants no visibility; selected authorised artifact/context handoff is distinct.
- **OQ-3** team-wide memory across engagements and auditors of one internal-audit company Workspace, admitted only from formally issued or explicitly team-shared work under current access; private exploration excluded. Earlier unconditional extract visibility is superseded. External-audit client/independence boundaries remain OQ-15.
- **OQ-4** Method distribution inherits Codex mechanisms (Workspace/local/plugin skills, marketplaces, MCP configuration, Agent Security managed policy); no managed catalogue or approval workflow.
- **OQ-5** cost policy inherits Codex usage handling; no Inquello budget values; FR-30 configured limits are the inherited limits.
- **OQ-6** desktop first mirroring Codex clients; Excel, Word, PowerPoint, CSV; no named external record system for first validation; import/export only. Full target unchanged.
- **OQ-7** an internal audit team validates on task types it picks; measure first, no numeric thresholds until a baseline exists.
- **OQ-8** single-team scale, no service promises; operating and accessibility targets after first validation.
- **OQ-9** every documented processing route stays in scope and is tested; eligibility verified per route before real data.
- **OQ-10** sequencing, first increment and explicit deferrals are decided here and recorded with unmet acceptance.
- **OQ-13 (added 2026-10-27)** the agent browser and agent sandbox are local in V1: the Codex desktop built-in browser profile, Computer Use and OS sandbox enforcement inherited from Codex. A hosted agent browser or hosted sandbox is a **V2 revisit (OQ-13)** item; any related deferral in this breakdown is labelled "V2 revisit (OQ-13)", never dropped. Affects FR-15, FR-16, FR-33 and the S07/S12 route facts.
- **OQ-14 (added 2026-10-27)** Inquello owns identity and authorisation through its own auth module covering Workspace membership, audit-team roles, Engagement membership and the differing internal-audit and external-audit models. Inference-provider sign-in (ChatGPT subscription, Claude, Azure, Bedrock, Vertex) is separate and only selects and authorises the inference route; it never stands in for Inquello identity. This is a new V1 obligation (see the requirement below) and supersedes the spine's reliance on trusted host/policy context alone for acting/reviewer identity (AD-6/AD-7 still bind; the auth module becomes the trusted identity source they consume).

#### Identity and authorisation obligation (OQ-14, V1, no FR number assigned)

- **Inquello auth module:** Inquello authenticates its users and authorises them against Workspace membership, audit-team roles, Engagement membership and the internal-audit versus external-audit models. Effective identity from this module supplies the acting/reviewer identity and permitted scope that AD-6, AD-7, AD-8, AD-12 and FR-33, FR-35, FR-36, FR-37 rely on. Inference-provider credentials (ChatGPT subscription, Claude, Azure Foundry/Azure OpenAI, Bedrock, GCP/Vertex, gateway, local) are held separately and only select and authorise an inference route (FR-29); signing in to a provider grants no Workspace, Engagement or review authority, and losing a provider session revokes no Inquello authority.
- **Dependency:** AD-15 adopts the shared-service authority/local-desktop boundary; OQ-16A now adopts its technical direction and SC-1–6 fix identity/session, permission/version/invalidation and recipient-materialisation contracts. OQ-16B still gates actual supplier/deployment and real-data eligibility. OQ-15 separately gates external-audit client/independence boundaries. Claude API-key access is selected and CR-1 specifies the adapter; conditional subscription access and later route eligibility remain separately gated. SC-7 defines the synthetic service topology.

#### Open gates carried as explicit story dependencies

- **OQ-11** V2 record precedence, lifecycle, review/hold/amendment/retention and migration policy (owners: product lead, audit lead, data-policy owner). Blocks native-mode implementation commitments (FR-38, FR-40, FR-42); not a V1 blocker.
- **OQ-12** final name clearance and public-brand validation (owner: product/design lead). Blocks public brand commitments; the supplied visual kit and final UX are selected inputs.
- **Assumptions:** AS-1 personas illustrative (Amina = Internal Auditor, Noah = Internal Audit Manager, Dev = IT Auditor accepted as example labels); AS-2 gate owners proposed (Israel is the current product decision owner); AS-UX1 S05 to S13 placements require walkthroughs (Engagements as a main navigation section with the current Workspace in a selector accepted); AS-UX2 responsive arrangements require content-fit validation (direction accepted); AS-UX3 interaction completion unproved on hosts (required behaviours accepted); AS-UX4 token accessibility applications require rendered-state checks.

#### Detailed inventory retained through the stories

The 79 C entries (C01 to C78 plus C54A), 20 expanded behaviours (E01 to E20), 270 subfeature mappings, 93 proposed enhancements and the named GCP/Vertex delta remain scope inputs under their primary P group (traceability table in `PRODUCT_BRIEF_TRACEABILITY.md`). Stories reference the C/E entries they realise; a C/E entry not realised by any story in the first increment is a recorded deferral.

### UX Design Requirements

Source: DESIGN.md (appearance, tokens, 28 components, AX applications) and EXPERIENCE.md (13 surfaces, states, interaction primitives, accessibility floor, responsive arrangements, 8 journeys, 7 supporting paths). The supplied `inquello-design-system` package is an implementation reference, not a production framework decision; imports stay unchanged.

**Foundations and tokens**

- **UX-DR1 Design tokens:** implement the exact resolved token set from DESIGN frontmatter as the single source of visual values: ink ramp (ink-900 `#16191d` to ink-50 `#fafbfc`, white), blue (800/700/600/200/150/100/50), green (800/600/200/150/100/50), amber (800/700/500/200/150/50), red (800/600/200/50); semantic roles text-primary/secondary/muted/faint/inverse/link/link-hover, surface-app/sidebar/panel/raised/subtle/hover/selected/console/console-raised, border-subtle/default/strong/input, action-primary-bg/bg-hover/fg, action-secondary-bg/border, action-quiet-bg, judgment-calculation/observation/suggestion/decision/gap, status-suggested/investigating/open/evidence/accepted pairs, row-added/changed/selected, source-highlight, diff-add/del, approval-bg/border, file-pdf/xls/doc/folder. Primary actions are ink on white; agent blue is not the default button fill.
- **UX-DR2 Typography roles:** hero 32/600/1.15/-0.02em, display 28/600/1.2/-0.02em, title 14/600/1.45 (the 14px semantic token wins over the 18px specimen), body 14/400/1.55, ui 13/400/1.45, caption 12/400/1.45, label mono 11/500/1/+0.04em uppercase, code mono 11.5/400/1.6. Sentence case for labels; uppercase only for the mono overline. Tabular numerals and right alignment in numeric columns.
- **UX-DR3 Self-hosted fonts:** bundle the five WOFF2 files (IBM Plex Sans 400/500/600, IBM Plex Mono 400/500), Latin subset, `font-display: swap`, with the declared fallback stacks; do not assume italic, 700 or other scripts.
- **UX-DR4 Radii, spacing, layout and elevation:** radii chip 3, sm 5, md 6, lg 8, card 10, composer 14, pill 999 (literal), app-icon 22.7%; spacing scale 2/4/6/8/10/12/16/20/24/28/32/40/48/64px; layout header 48, panel-tabs 40, sidebar 264, rail 52, thread-max 720, panel-min 380 (wins over the 340 prototype clamp), panel-default 560, console 230, controls 26/28/32 and round 30; shadows none, hairline, composer, page, popover, toast with exact values; tonal layering and one-pixel lines before shadows; no blur, glass, gradient, coloured side stripes or decorative imagery.
- **UX-DR5 Motion and reduced motion:** timings 120/200/600ms `cubic-bezier(0.2,0.8,0.2,1)`, 800ms linear spinner, pulse opacity 1 to 0.3; under `prefers-reduced-motion` remove nonessential animation and keep an explicit textual running state; a spinner or pulse is never evidence of running or completed work.
- **UX-DR6 Brand assets and identity:** use the 14 supplied logo variants (lockup, symbol, wordmark, app icon, blue and reversed); the symbol represents the agent, initials discs represent people; small symbol asset at 20px and below; clear space half the symbol width; minimum lockup 16px, 20px in the sidebar; never retype the wordmark. Public brand commitments depend on OQ-12.
- **UX-DR7 Icon set:** the 40 Lucide outline icons at 16px default, 14px dense, 18px rail, 1.75 stroke, currentColor; decorative icons hidden from assistive technology; informative icons carry text equivalents; status never encoded by shape or colour alone.
- **UX-DR8 Proposed AX contrast applications (AS-UX4, rendered-state checks required):** informative small text uses text-muted not text-faint (6.08:1 on white); attention Badge uses ink-900 on amber-500 (5.99:1) instead of white; accepted/explained StatusChip text uses green-800 on green-150 (7.78:1); essential control boundaries use ink-600 (6.08:1) while decorative separators keep pale values; focus uses a visible blue-600 edge with the pale blue-150 ring supplementary. Source token values stay unchanged; each adjacent pair and state is verified when rendered.

**Primitives (18) with behavioural rules**

- **UX-DR9 Icon:** as UX-DR7, standalone meaningful uses have a visible or accessible label.
- **UX-DR10 Button:** primary ink/white, secondary outlined, quiet grey, ghost muted; 26/28/32px heights, radius md; native action target with action-specific accessible name; disabled 0.45 opacity without hiding the reason; pending state prevents duplicate submission; appearance never establishes permission.
- **UX-DR11 IconButton:** ghost/outline/active plus round 30px send/stop; label required; stop uses a 9px square and requests interruption, not rollback; toggled/expanded state exposed; visible blue focus indicator.
- **UX-DR12 Avatar:** person initials disc 24px in supplied tones; agent uses the symbol without disc; decided green/white only when identity, scope and version are recorded; person versus agent identified in accessible text.
- **UX-DR13 Badge:** attention amber-500/ink-900, neutral ink-150/secondary, accent blue-600/white; 11px type, 16px line height, 8px radius; counts name the category and never signal accepted audit work; dynamic counts do not steal focus.
- **UX-DR14 TextField:** single/multiline, persistent programmatic label, radius 6, 7x9 padding, 12.5px type; essential border ink-600, focused blue edge plus pale ring; entered text retained on validation or save failure with the failing field identified; explicit focus, disabled, read-only, error and loading states (derived, not supplied by the kit).
- **UX-DR15 Switch:** 28x16 track, blue on/ink-300 off, 12px white thumb; readable On/Off state; Space toggles when permitted; effective result shown only after confirmation when an external setting changes; turning off a schedule affects future eligibility only.
- **UX-DR16 Choice:** radio 14px/dot 6px or checkbox 16px/radius 4; grouped radio semantics for one option, checkbox semantics for independent options; arrow keys move radio selection, Space activates; selecting a treatment alone does not commit it.
- **UX-DR17 SegmentedControl:** one selected view with text/shape/focus cues; selected ink/white; arrow-key movement; selection changes only the view and never discards unsaved edits or implies recalculation.
- **UX-DR18 Tabs:** tab/tablist/tabpanel relationships, selected state, arrow navigation, visible focus; Enter/Space activates unless activation on focus is immediate and safe; selected source/item preserved across tabs; counts in muted 11px mono.
- **UX-DR19 Menu:** white floating list, radius 10, popover shadow, width 300; trigger exposes expanded state; focus moves inside on open; arrows/Home/End navigate, Enter activates, Escape closes and returns focus; unavailable actions keep an understandable reason without exposing protected data.
- **UX-DR20 StatusChip:** source states suggested (dashed blue), investigating (pale ink), open (outlined), needs evidence/awaiting client (amber), accepted/explained (pale green with green-800 text); 11px label, radius 3, optional 16px decision disc; explicit text always; a separate truthful label for states outside the source taxonomy; a green chip is not sign-off.
- **UX-DR21 JudgmentTag:** calculation f/ink, observation circle/muted, suggestion dashed-blue box, decision green dot, gap dash/amber; 10px mono uppercase or 11px sentence case; classification paired with its content and source; a decision tag names the human or policy basis and scope.
- **UX-DR22 FileChip:** PDF red, XLS green, DOC blue, DIR muted; 9px mono type tag with 12px name; chip or tag variant, radius 6, ink-50 background; labelled keyboard-reachable remove button; removing task context never deletes the original; failed/unreadable/permission-limited sources remain distinct.
- **UX-DR23 PlanStep:** done green check, running blue outline/fill, pending neutral, 14px indicator; done means the step actually finished; pending items preserved after Stop; blocked/failed/interrupted shown with explicit words and existing status colours; meaningful transitions announced without streaming every pulse.
- **UX-DR24 ApprovalCard:** amber-50 panel, amber-200 border, radius 10, 12x14 padding, mono label, 13.5px question, optional exact-message quote; shows context, exact action/content/destination, consequences and permitted alternatives; the actual action replaces generic Approve; only the configured authority checkpoint is applied; dismiss/alternative actions have real outcomes and preserve unresolved work.
- **UX-DR25 DiffLine:** add green +, remove red -, change blue ~, context neutral; 40px gutter, 12.5px body; retains source identity, version and line/row context; distinguishes suggested, applied locally and delivered changes; inspection or selection never applies an edit.
- **UX-DR26 Toast:** ink/white, radius 6, 8x14 padding, 12.5px type, toast shadow, top-centre with a 2.6s timer for replaceable nonessential feedback only; announces without moving focus; errors, required action, evidence gaps, stale outputs, uncertain writes and recovery instructions never rely on a toast; a toast never proves a saved file or external action.

**Compositions (10) with behavioural rules**

- **UX-DR27 Sidebar:** 264px pale navigation with 20px lockup, Workspace selector, Engagements as a main navigation section, Tasks hierarchy, bottom person/settings; 52px rail retains symbol, labelled actions and counts; current surface/task maintained when collapsing; logo expansion keyboard-operable.
- **UX-DR28 Header:** white 48px region with the 14px title, readable muted Workspace/Engagement context and trailing actions; truncated context exposed accessibly; title announced after deliberate surface changes, not per streamed token.
- **UX-DR29 Composer:** white 14px-radius surface, composer shadow, body typography, FileChip context, scope/method/environment/reasoning controls, 30px send/stop; actual text/files/method carried to the Task; unsent text retained after errors; disabled Send explains missing input; steering stays possible while running; Enter submits only when the advertised mode permits, Shift+Enter inserts a newline, input-method composition never sends.
- **UX-DR30 NavRow:** 13px UI type, 6x8 padding, radius 6, selected ink-150, hover surface-hover; link semantics for navigation, button semantics for actions; current/expanded state exposed; nested children keep hierarchy; a row never routes to a fixed demo record.
- **UX-DR31 Over:** mono 11px uppercase overline in muted, a text label associated with its content; never a menu or interactive heading.
- **UX-DR32 Workbook:** artifact preview with file identity/version, segmented sheet selector, aligned numeric columns, supplied row highlights and judgment legend; table radius 8, 12.5px type; semantic table with keyboard-reachable interactive rows/cells unless full grid editing is implemented; horizontal overflow independently reachable with a labelled boundary; full-population versus sample work, counts, exclusions, sampling parameters, duplicate treatment and examined coverage inspectable; selection identifies the real row and links to evidence; demo totals are not validation results.
- **UX-DR33 StartScreen (S01):** header and centred 720px column; 40px symbol, 28px display prompt "What should we work on?", Composer, applied-method row (Applied/Not applied reflects actual inclusion) and suggested existing files; starting work transfers all selections and records Task identity without assuming an Engagement.
- **UX-DR34 ActiveScreen (S02):** thread beside the artifact region with Changes/Preview/Summary tabs; plan, specialists, approval request and persistent Composer; artifact toggles/expands without losing context; thread and artifact keep their own scroll positions; Stop never marks remaining work done.
- **UX-DR35 ReviewScreen (S03):** reviewer-owned private Task anchored to submitted version and complete reviewed basis (evidence, Method/departures, policy and actual coverage); agent tools reperform and challenge conclusions/contradictions/history. Humans select precisely anchored notes to issue; private prompts/unissued notes stay private. Preparer agent creates successor version and explicit per-note resolution/change-impact handoff. Reviewer agent checks changed and impacted work; uncertain impact broadens recheck. No silent submitted-version edits or agent acceptance; Keep/Revert is separate from Professional Approval.
- **UX-DR36 AutomationsScreen (S04):** 14px title, compact automation list with selected blue-50 row, readable trigger/last-run context, detailed check/action region; selects the actual automation/run showing trigger, scope, Method, identity and outcome; enable/disable/configure, "New automation" and "Open review package" require real persistent state; a successful run never borrows the human-decision appearance.

**Surfaces, states and flows**

- **UX-DR37 Shared state baseline for every surface S01 to S13:** cold loading names what is loading without inventing content; empty states describe the actual absence plus one relevant action; focused controls visible in reading order; errors name the failed action and retained work; permission denial prevents the action without disclosure; offline/lost connection identifies the unavailable capability; unsent input kept in session; confirmed saved artifacts preserved; no promise of local persistence, synchronisation, queued writes or retries unless actually supported; version/authority rechecked on recovery; a disabled control explains what prevents its action.
- **UX-DR38 S05 Search and Workspace navigation (spine-only):** find accessible Tasks, files and Engagements; pin/archive/reopen; inspect origin; no workspaces, no matches and unavailable search are separate; focus returns to the trigger on close; stale index never reveals revoked content; search terms kept on failure; unsearched scope shown as unavailable.
- **UX-DR39 S06 Skills and procedures (spine-only):** inspect/create/refine examples, instructions and skills with versions and dependencies; record Task-specific departures separately from Method changes; missing dependency, unpublished change, incompatible version and denied distribution distinct; denied departure stays unapplied with draft rationale preserved; client evidence never imported into shared Method by default.
- **UX-DR40 S07 Capabilities and processing (spine-only):** discover tools/apps/plugins; inspect permissions, effective provider/deployment, acting service identity, distinct execution/inference/browser-connector routes, model choices and configured consumption; all documented routes (ChatGPT/OpenAI sign-in, API key, Azure Foundry/Azure OpenAI, Bedrock, GCP/Vertex, gateway, local; Claude route subject to unresolved supply/eligibility) shown with capability limits; provider sign-in state shown separately from Inquello identity (OQ-14); browser and sandbox shown as local routes in V1 (OQ-13); expired/revoked access, incompatible route and usage limit each offer a next action; never silently switch provider/environment; local execution never implies local inference.
- **UX-DR41 S08 History, alternatives and memory (spine-only):** retain resume/fork/compare and separate contribution/use/activity controls. Team-wide institutional knowledge is admitted automatically when formally issued or explicitly team-shared (ongoing included), not merely retained. Exclude private drafts/conversations; show originating engagement, period, finding/status changes and current access; historical similarity does not establish a current/repeat Finding. Unknown lineage/access blocks shared recall; cross-company leakage forbidden; external-audit boundaries gated by OQ-15.
- **UX-DR42 S09 Team, policy and retained material (spine-only):** retain assignment/reassignment and policy/category states. First-team enablement includes removal/withdrawal enforcement for enabled routes and derived data, while advanced unattended-job reassignment follows automation. Membership removal blocks subsequent retrieval/recall; share withdrawal removes that route unless another valid exact grant exists; active agents cease revoked use. Already downloaded/exported copies cannot be recalled. No guest portal; no invented reviewer hierarchy.
- **UX-DR43 S10 Sharing and delivery (spine-only):** select file/folder/artifact/review package, selected conversation snapshot or explicitly whole Task; default excludes conversation and does not upload all sources. Show audience, permissions, exact version/scope and supporting-context availability. Verify recipient can actually access selected version/context on their computer; sender-local paths insufficient. Missing/context mismatch/permission denial/partial/uncertain delivery remain explicit; do not widen scope or substitute versions. Retain withdraw-sharing and downloaded-copy limits, operation identity and reconciliation before retry; V1 formal authority external.
- **UX-DR44 S11 Technical investigation (spine-only):** queries/scripts/configuration/security results, isolated alternatives and programmatic evidence within S02/S03; no run differs from a run with no findings; runtime failure, interrupted execution, unavailable specialist service, incomplete coverage and conflicting writes visible with retained outputs and safe resume scope; technical detail available without forcing it on ordinary review; console region uses the dark ink surface locally (no global dark theme).
- **UX-DR45 S12 Secondary clients and context capture (spine-only):** CLI, application-adjacent context, mobile/remote session, voice, physical control, notifications and optional companion continue the same Task with stated source state; voice has explicit recording/transcribing/reviewable-text state; notifications distinguish attention needed from completion; companion mirrors Task state and never Professional Approval; missing live app state, disconnected remote control and unsupported client actions explicit; "Open in Excel" shows the real saved-file handoff or a failure, never a toast-only success. Desktop ships first (OQ-6); secondary clients remain V1 scope.
- **UX-DR46 S13 Native records and migration (V2, spine-only):** Organisation/Workspace mode selection, migration and native lifecycle/history; unconfigured native mode is a V2 setting, not a V1 error; hold conflict, affected approval, migration failure/partial result and unavailable destination explicit; existing authority preserved until the verified migration contract says otherwise. Depends on OQ-11.
- **UX-DR47 Voice and tone microcopy:** terse, factual, sentence case, action verb plus named object plus truthful outcome; use the EXPERIENCE situation table (start, missing source, stop with actual counts, proposed edit Keep/Revert naming affected outputs, execution permission naming recipient and exact content, uncertain delivery, external editing, automation "no exceptions reported in the examined population", permission failure); never "Everything looks good", generic "Approve", "Delivered" from a toast or "Accepted" without a human decision; load-bearing statements in text-primary, supporting information in text-muted.
- **UX-DR48 Keyboard, focus and shortcuts (AS-UX3):** visible controls for every action; Ctrl/Cmd+N New thread and Ctrl/Cmd+K Search only where the host can safely bind them; no interception of browser/system shortcuts outside the client convention; Escape closes the topmost Menu or overlay and returns focus and never stops a Task; "Stop (Esc)" hint only when implemented and exposed; tab order task navigation, main content, contextual artifact/review actions, Composer; no focus traps in scroll areas or editable tables; hover-only actions also on focus and touch; nested targets never trigger their row; after a committed action focus stays with the result or returns to the trigger; background activity never steals focus; panel collapse/expand labelled; any resizer is a keyboard-operable separator with announced value; before discarding unsubmitted work offer retain/discard.
- **UX-DR49 Accessibility floor:** heading/landmark structure for navigation, main work, artifact and contextual review; surface/task changes announced concisely; focus visible and not obscured by Header/Composer/expanded artifact using blue-600; labels, instructions, errors, selected state and status perceivable without colour; text resize and reflow with labelled horizontal scroll for tables/code/diffs; live announcements with urgent failures distinguished from polite updates; reduced motion respected; targets at least 24x24 CSS pixels or a documented exception; contrast 4.5:1 normal text, 3:1 large text and non-text indicators. This is a floor, not a conformance claim; targets follow OQ-8.
- **UX-DR50 Responsive and platform arrangements (AS-UX2):** full desktop composition when navigation, readable thread and artifact minimum fit; rail or collapsed navigation when the Sidebar does not fit; single work area with explicit conversation/artifact switching when thread plus artifact minimum does not fit; Workbook keeps semantic rows/columns with decision controls in a separate visible section when side-by-side fails; CLI/SDK preserve command/session semantics without a decorative shell; application-adjacent/Excel handoff identifies the saved file or actual live selection and detects changed inputs on return; mobile/remote steering offers inspect/steer/interrupt/continue with touch/keyboard semantics and limits; voice/physical controls have declared effects. No dark theme; no promised background synchronisation.
- **UX-DR51 Authority and Delivery distinctions:** the same visual language exposes five separate meanings: permission to execute, proposed/applied artifact edit, human review decision, Professional Approval, and attempted/confirmed/uncertain Delivery; before a consequential external action destination, acting identity, exact content/field change and relevant version are inspectable; afterwards operation identity and verification stay visible; stale proposals return to review; lost responses after possible success enter reconciliation; no blind repeat, reconnect resend or toast-only success; Keep/Revert is not Professional Approval; an agent review is not a human signature.
- **UX-DR52 Prototype anti-patterns to eliminate:** every item opening the R1 demo record; Stop marking pending steps done; Keep issuing an unsaved version claim; toasts pretending Excel/portal delivery happened; "accepted" representing an automated check; the four routes treated as a four-screen product boundary; removal of technical/security work; a universal audit method; the design system read as a production-framework decision; decorative confidence; colour-only status; automatic native-record authority.
- **UX-DR53 Supporting paths SP1 to SP7:** SP1 select capability and work route (S07/S09/S12); SP2 resume, branch and govern recall (S05/S08); SP3 assign, reassign and govern retained work (S09); SP4 inspect or share a bounded output (S10); SP5 programmatic and technical continuation (S11/S12); SP6 capture and continue across clients (S02/S12); SP7 native-record continuation V2 (S13). Each path has its stated steps, climax and failure/recovery wording.
- **UX-DR54 Journey flows UJ-1 to UJ-8:** implement the EXPERIENCE Key Flows step by step with their failure/recovery sections, using PRD fixtures (W1 for UJ-3, W2 for UJ-4, W3 for UJ-5, M1 for UJ-7) rather than the imported demo data.
- **UX-DR55 Desktop shell behaviour:** inherit Sidebar, Header, centred thread and optional artifact area from Shell.jsx dimensions; keep Task identity and selected item visible when an artifact expands; preserve source selection and return focus when switching between thread and artifact; changing a tab never silently authorises or saves a remote update.

### FR Coverage Map

Stable IDs are unchanged; this map follows the approved 17 groups. Detailed old-acceptance and deferred-capability mappings are in `epic-traceability-2026-10-27.json` and `epic-reconciliation-proposal-2026-10-27.md`.

| Requirement | Delivery epics |
| --- | --- |
| FR-1, FR-2 | 1; sharing/current-access extensions 4 |
| FR-3, FR-4 | 1 desktop; 11 secondary surfaces |
| FR-5, FR-6 | 1 local facts; 3 local alternatives; 8 remaining environments/worktrees |
| FR-7, FR-8 | 1 plain private execution; 2 file/Method analysis; 10 delegated continuity |
| FR-9, FR-10 | 2 initial context; 7 browser context; 9 predictions |
| FR-11, FR-12 | 2 analysis/coverage; 3 W1 recomputation; 9 composed execution |
| FR-13, FR-14 | 3 editable artifacts/visuals; 4 sharing; 8 hosted outputs |
| FR-15, FR-16 | 2 research; 7 local browser/computer interfaces |
| FR-17, FR-18 | 5 agent-assisted review/direct technical work; 9 scans/specialist work |
| FR-19, FR-20 | 2 Methods/departures; 3 Method impact; 7 demonstration |
| FR-21, FR-22 | 1 discovery; 2 context/hooks; 9 dynamic tools |
| FR-23, FR-24 | 12 programmatic/unattended/service events |
| FR-25, FR-26 | 10 delegation/branching |
| FR-27, FR-28 | 4 admitted team memory; 10 compaction/activity recall |
| FR-29, FR-30 | 1 initial routes/usage; 9 remaining routes; 10 delegated usage |
| FR-31, FR-32 | 11 convenience/import/snapshots; 4 explicit Task/granular sharing |
| FR-33, FR-34 | 1 initial authority/trust; 2 evidence trust; 4 shared; every later route |
| FR-35, FR-36 | 4 responsibility/basic revocation; 5 private agent review; 10/12 delegation/unattended extensions |
| FR-37 | 1 local-held floor; 4 shared/derived floor; 13 extended governance/reporting |
| FR-38 (V2) | 16 native lifecycle |
| FR-39, FR-41 | 5 reviewable package; 6 practice/fixture delivery; 14 actual destination |
| FR-40, FR-42 (V2) | 16 native practice/migration |
| FR-43, FR-44 | 1 state/register foundations; per-route tests with each capability; 5/6 first-increment integration; 15 full-V1 integration |
| OQ-14, OQ-15, OQ-16 | 1 own identity boundary; 4 actual shared transfer/current grants; OQ-16A direction adopted with SC-1–6 contracts, OQ-16B actual-route and OQ-15 external-client gates retained |
| UX-DR1–55 plus reconciled sharing/reviewer rules | 1 tokens/primitives/shell/initial states; 2 context/Methods; 3 artifact/editor/technical preview; 4 team/sharing/memory; 5 review/export; 6 practice/delivery; 7–15 corresponding later surfaces; 16 native surface |
| NFR-1–10 | Acceptance in each owning capability; enabled-route matrix 6/15; no document check establishes runtime acceptance |

## Epic List

The owner approved this 17-group structure at 17:02 UTC on 2026-10-27 and a consolidated story review instead of per-story pauses at 17:04 UTC. Those approvals do not constitute acceptance of each newly drafted story or resolution of OQ-15/OQ-16. All full-product V1/V2 boundaries remain intact.

### Epic 1: Secure private desktop work
Increment 1; 30 stories; complete group details below.

### Epic 2: Attributable analysis with Methods
Increment 1; 18 stories; complete group details below.

### Epic 3: Editable artifacts and same-file recomputation
Increment 1; 10 stories; complete group details below.

### Epic 4: Accessible team sharing and institutional continuity
Increment 1; 7 stories; complete group details below.

### Epic 5: Agent-assisted review, revision and export
Increment 1; 14 stories; complete group details below.

### Epic 6: Full first-increment practice and delivery-contract validation
Increment 1; 5 stories; complete group details below.

### Epic 7: Local browser and demonstration capabilities
Increment 2 / V1; 5 stories; complete group details below.

### Epic 8: Additional environments and hosted outputs
Increment 2 / V1; 3 stories; complete group details below.

### Epic 9: Extended routes, tools and specialist capabilities
Increment 2 / V1; 14 stories; complete group details below.

### Epic 10: Delegation, branching and longer continuity
Increment 2 / V1; 5 stories; complete group details below.

### Epic 11: Secondary clients, convenience and snapshot sharing
Increment 2 / V1; 8 stories; complete group details below.

### Epic 12: Bounded unattended and service-triggered work
Increment 2 / V1; 8 stories; complete group details below.

### Epic 13: Extended administration and operational reporting
Increment 2 / V1; 2 stories; complete group details below.

### Epic 14: Named external-record delivery
Increment 2 / V1; 1 stories; complete group details below.

### Epic 15: Cross-surface integration acceptance
Increment 2 / V1; 4 stories; complete group details below.

### Epic 16: Native records and deliberate migration
V2; 4 stories; complete group details below.

### Epic 17: Hosted browser/sandbox decision revisit
V2; 1 stories; complete group details below.

## Sequencing and evidence status

- Baseline was 15 epics / 89 stories: 55 first-increment tags, 29 second-increment tags and 5 V2 tags. Those counts describe history, not the revised split story total.
- The full original scope is retained through AC-level traceability; later portions embedded in first-increment story prose now have explicit delivery stories. Basic revocation, actual recipient access, admitted team memory and private agent-assisted review are first-team-enabled work, not deferred administration.
- Epic 1 provides a genuine plain private synthetic Task; Epic 2 adds attributable files and Methods; Epic 3 adds editable artifact/Excel recomputation; Epics 4–5 complete accessible team sharing, private agent review, revision and export; Epic 6 completes original first-increment practice/fixture breadth. Workbook review is an engineering checkpoint, not a narrowing of eventual owner-selected validation tasks or formats.
- Capability register schema and current-route authority tests arrive before real-data route enablement. Each later route supplies its own entry and tests before enablement. Epic 15 checks integration; it does not defer those obligations.
- First fork/build stories can proceed only after their actual cut/toolchain verification. OQ-16A direction and SC-1–6 resolve the concrete identity/service/materialisation/revocation contract gap; OQ-16B still gates actual-route/real-data enablement; OQ-15 separately blocks unresolved external-audit client/independence routes. Neither blocks retaining their product scope. Supplier eligibility, production scheduler, remote execution, actual destination adapter and V2 policy gates remain explicit.
- Story dependencies are earlier implemented capability contracts, not assertions that their runtime tests already passed. Route supply and acceptance fixtures remain unexecuted. No sprint tracking or ready-for-dev status is created here.

## Epic 1: Secure private desktop work

Increment 1. 30 stories. Owner-approved group structure; detailed stories are the consolidated review proposal, not individually approved or ready-for-development statuses. Each acceptance criterion is a requirement, not executed test evidence.

### Story 1.1: Set up the initial Inquello fork from the selected public Codex cut

As the Inquello implementation team,
I want a recorded upstream fork cut and verified build-tool compatibility,
So that later work uses an identified, reproducible foundation.

Increment 1. Origin: old Story 1.1. Requirements/inventory: AD-1, AD-3, AD-4, AD-5, C41, C77.

**Prerequisites:** none; actual fork/toolchain selection remains required.

**Gate:** Select the actual upstream cut and verify toolchain versions; historical version seeds are not current compatibility evidence.

**Acceptance Criteria:**

**AC 1.1.1**
**Given** the inspected upstream revisions are evidence snapshots only
**When** the team selects the delivery fork cut
**Then** the chosen commit SHA, upstream tag/date and the reason for the choice are recorded in the repository (for example `FORK-CUT.md`)
**And** compiler, package and driver compatibility is verified at that cut against Rust 1.99.1 (edition 2024), pnpm 10.34.5, TypeScript 5.9.2, React 19.3.1 and Electron 45.0.0, with any deviation recorded with its reason.

**AC 1.1.2**
**Given** the implementation team has selected the fork cut
**When** the initial project is established during implementation
**Then** the public upstream revision is checked out reproducibly, required configuration/dependency installation is recorded under applicable authority, and the build is verified
**And** this planning story does not itself authorize a current implementation or installation action.

### Story 1.2: Run the packaged runtime over a bounded desktop transport

As the Inquello implementation team,
I want the packaged Rust app-server to start, initialise and shut down predictably over stdio,
So that the desktop can use the selected runtime without protocol corruption.

Increment 1. Origin: old Story 1.1. Requirements/inventory: AD-1, AD-3, AD-4, AD-5, C41, C77.

**Prerequisites:** Story 1.1.

**Acceptance Criteria:**

**AC 1.2.1**
**Given** the fork builds
**When** the desktop application starts
**Then** Electron main launches the packaged Rust app-server as an owned child over stdio, performs protocol initialisation, and handles backpressure, disconnect and shutdown explicitly
**And** child stderr is captured separately and never parsed as protocol output
**And** the generated protocol schema in the client matches the runtime version of the selected cut.

**AC 1.2.2**
**Given** upstream marks the app-server command and WebSocket transport experimental for the remote Code Mode host context
**When** transports are configured
**Then** only the stdio child route is enabled in this story and the warning is recorded as bootstrap transport evidence for import into the capability register once that register exists; no production eligibility is claimed.

### Story 1.3: Isolate desktop renderers from host privilege

As the Inquello implementation team,
I want sandboxed renderers and narrowly validated host operations,
So that untrusted content cannot obtain arbitrary host authority.

Increment 1. Origin: old Story 1.1. Requirements/inventory: AD-1, AD-3, AD-4, AD-5, C41, C77.

**Prerequisites:** Story 1.2.

**Acceptance Criteria:**

**AC 1.3.1**
**Given** the renderer is loaded
**When** its privileges are inspected
**Then** the renderer runs sandboxed and context-isolated without Node authority, the preload exposes only named operations, main validates payload shape and sender, and no general IPC, shell or `child_process` bridge exists
**And** navigation and content boundaries are enforced by main.

### Story 1.4: Keep local working metadata behind domain-owned commands

As the Inquello implementation team,
I want a separate protected working repository implementing domain-owned ports,
So that local state is recoverable without coupling audit semantics to the UI.

Increment 1. Origin: old Story 1.1. Requirements/inventory: AD-1, AD-3, AD-4, AD-5, C41, C77.

**Prerequisites:** Story 1.1, Story 1.3.

**Acceptance Criteria:**

**AC 1.4.1**
**Given** the local domain repository is introduced
**When** its first working metadata is stored
**Then** domain code imports neither Electron nor concrete runtime/storage adapters; adapters implement domain-owned ports
**And** only the entities required by this story exist; general agent tools cannot write the domain store, and the SQLite runtime includes the documented WAL-reset fix (3.51.3+ or a verified fixed backport). No full future record schema is pre-created.

### Story 1.5: Apply the selected typography, tokens and icon semantics

As an Internal Auditor,
I want the exact DESIGN tokens, self-hosted fonts and accessible icons,
So that the workbench has a consistent readable foundation.

Increment 1. Origin: old Story 1.2. Requirements/inventory: NFR-5, UX-DR1, UX-DR26, UX-DR31, UX-DR49, UX-DR8, UX-DR9.

**Prerequisites:** Story 1.1.

**Acceptance Criteria:**

**AC 1.5.1**
**Given** the DESIGN frontmatter token set
**When** the token module is built
**Then** every colour, typography, radius, spacing, layout, shadow and motion value resolves to the exact DESIGN value, source aliases such as `text-faint` and `status-accepted-fg` keep their original values, and `pill` is the literal 999px
**And** the five IBM Plex WOFF2 files are self-hosted with `font-display: swap` and the declared fallbacks.

**AC 1.5.2**
**Given** the 40 Lucide icons
**When** an icon is decorative
**Then** it is hidden from assistive technology; informative icons carry text equivalents.

### Story 1.6: Operate core action and input primitives

As an Internal Auditor,
I want the documented Icon, Button, IconButton, TextField, Switch and Choice variants and keyboard states,
So that each interaction is usable without a mouse.

Increment 1. Origin: old Story 1.2. Requirements/inventory: NFR-5, UX-DR1, UX-DR26, UX-DR31, UX-DR49, UX-DR8, UX-DR9.

**Prerequisites:** Story 1.5.

**Acceptance Criteria:**

**AC 1.6.1**
**Given** the DESIGN and EXPERIENCE contracts for Icon, Button, IconButton, TextField, Switch and Choice
**When** each variant is implemented and rendered
**Then** visual values and interaction semantics match those contracts, including named states, roles, focus, keyboard and announcements
**And** apply muted informative text, ink-900 attention badge text, green-800 accepted chip text, ink-600 essential boundaries and blue-600 focus edge where applicable; no control simulates its later business operation.

**AC 1.6.2**
**Given** a rendered primitive
**When** its text and essential boundaries are measured against adjacent colours
**Then** normal text reaches 4.5:1, large text and non-text indicators 3:1, and the measurement is recorded per adjacent pair and state (AS-UX4 evidence)
**And** `prefers-reduced-motion` removes spin and pulse while a textual running state remains.

### Story 1.7: Navigate and identify work with accessible primitives

As an Internal Auditor,
I want the documented Avatar, Badge, SegmentedControl, Tabs, Menu and StatusChip variants and keyboard states,
So that each interaction is usable without a mouse.

Increment 1. Origin: old Story 1.2. Requirements/inventory: NFR-5, UX-DR1, UX-DR26, UX-DR31, UX-DR49, UX-DR8, UX-DR9.

**Prerequisites:** Story 1.5.

**Acceptance Criteria:**

**AC 1.7.1**
**Given** the DESIGN and EXPERIENCE contracts for Avatar, Badge, SegmentedControl, Tabs, Menu and StatusChip
**When** each variant is implemented and rendered
**Then** visual values and interaction semantics match those contracts, including named states, roles, focus, keyboard and announcements
**And** apply muted informative text, ink-900 attention badge text, green-800 accepted chip text, ink-600 essential boundaries and blue-600 focus edge where applicable; no control simulates its later business operation.

**AC 1.7.2**
**Given** a rendered primitive
**When** its text and essential boundaries are measured against adjacent colours
**Then** normal text reaches 4.5:1, large text and non-text indicators 3:1, and the measurement is recorded per adjacent pair and state (AS-UX4 evidence)
**And** `prefers-reduced-motion` removes spin and pulse while a textual running state remains.

### Story 1.8: Inspect progress and proposed actions with accessible primitives

As an Internal Auditor,
I want the documented JudgmentTag, FileChip, PlanStep, ApprovalCard, DiffLine and Toast variants and keyboard states,
So that each interaction is usable without a mouse.

Increment 1. Origin: old Story 1.2. Requirements/inventory: NFR-5, UX-DR1, UX-DR26, UX-DR31, UX-DR49, UX-DR8, UX-DR9.

**Prerequisites:** Story 1.5.

**Acceptance Criteria:**

**AC 1.8.1**
**Given** the DESIGN and EXPERIENCE contracts for JudgmentTag, FileChip, PlanStep, ApprovalCard, DiffLine and Toast
**When** each variant is implemented and rendered
**Then** visual values and interaction semantics match those contracts, including named states, roles, focus, keyboard and announcements
**And** apply muted informative text, ink-900 attention badge text, green-800 accepted chip text, ink-600 essential boundaries and blue-600 focus edge where applicable; no control simulates its later business operation.

**AC 1.8.2**
**Given** a rendered primitive
**When** its text and essential boundaries are measured against adjacent colours
**Then** normal text reaches 4.5:1, large text and non-text indicators 3:1, and the measurement is recorded per adjacent pair and state (AS-UX4 evidence)
**And** `prefers-reduced-motion` removes spin and pulse while a textual running state remains.

### Story 1.9: Register capability limits before enablement

As an Internal Audit Manager,
I want a protected capability register with disabled, synthetic-only and real-data-eligible states,
So that an unverified capability cannot appear ready.

Increment 1. Origin: old Story 14.3. Requirements/inventory: AD-14, FR-44, NFR-9, OQ-9.

**Prerequisites:** Story 1.4.

**Acceptance Criteria:**

**AC 1.9.1**
**Given** a capability or route is described
**When** its register entry is created
**Then** the entry records owner, supply, versions, limits, identity, formats, processing scope, eligibility and evidence references
**And** no entry or failed/missing evidence means not enabled; synthetic fixture evidence is not real-data eligibility.

**AC 1.9.2**
**Given** the complete C/E inventory
**When** the register is inspected
**Then** every item maps to an enabled capability, a planned delivery group or an explicit unmet deferral
**And** entries and capability-specific acceptance are updated with each enabled route, not postponed until Epic 15.

### Story 1.10: Authenticate an Inquello identity independently of inference

As an Internal Auditor,
I want a trusted Inquello sign-in/session bound to current service-held identity,
So that provider credentials never determine my product permissions.

Increment 1. Origin: old Story 2.1. Requirements/inventory: AD-6, AD-7, C71, OQ-1, OQ-14.

**Prerequisites:** Story 1.4.

**Gate:** OQ-16A direction adopted; AD-18/19 and SC-1/2 define the architect-derived identity/session contract. OQ-16B actual issuer/operator/region and real-data eligibility remain separate; no vendor/spend is chosen here. Synthetic identity conformance is not proof of production issuer integration.

**Acceptance Criteria:**

**AC 1.10.1**
**Given** the OQ-16 identity/session contract has been resolved
**When** a person signs in
**Then** the shared Inquello service supplies authenticated identity, membership/role revisions and session validity; every protected command validates that authority
**And** local metadata caches cannot mint membership or authorize stale access; failed/unavailable validation cannot masquerade as a valid shared-service session.


**AC 1.10.2**
**Given** Wrong issuer/audience/state, matching email on a different subject, and an expired or rotated session are supplied under the adopted SC-1 contract
**When** authentication and refresh are attempted
**Then** no identity merging, stale membership or private disclosure occurs; refresh-family replay is rejected and recovery requires valid sign-in
**And** only current session/principal records and synthetic authority fixtures are required here; later Task/sharing UI is not a prerequisite.


**AC 1.10.3**
**Given** an authenticated session command is interrupted after a potentially committed result
**When** the client retries or queries the same operation ID under SC-2
**Then** the durable receipt resolves the outcome without duplicate mutation; a different payload with the same ID conflicts
**And** credential storage excludes renderer/model/tools/logs and local private work is distinguished from shared-service availability.

### Story 1.11: Enforce internal-company memberships without disclosing private Tasks

As an Internal Audit Manager,
I want Workspace and Engagement membership distinct from private Task grants,
So that team organization does not expose personal work.

Increment 1. Origin: old Story 2.1. Requirements/inventory: AD-6, AD-7, C71, OQ-1, OQ-14.

**Prerequisites:** Story 1.10.

**Gate:** OQ-16A direction adopted; SC-2/3 permission/revision contract applies; OQ-16B before real shared data; OQ-15 before external-audit client/independence routes.

**Acceptance Criteria:**

**AC 1.11.1**
**Given** an internal-audit company Workspace
**When** memberships and roles are applied
**Then** audit function, Engagement memberships and reviewer roles follow configured policy without a hard-coded firm hierarchy
**And** membership alone does not expose another creator’s Task, conversation, drafts or retained private extracts.

**AC 1.11.2**
**Given** a person lacks required membership or an explicit resource grant
**When** the authorization contract is tested with synthetic private-resource references
**Then** the policy result denies access and reveals no protected content; the denial gives only a safe missing-authority explanation
**And** OQ-15 external-audit client relationships and independence attributes remain a separate unresolved route contract, never inferred from the internal-company model.

**AC 1.11.3**
**Given** no guest role exists in V1 (OQ-1)
**When** roles are listed
**Then** only audit-team and reviewer roles are offered and external exchange happens through exports, not guest accounts.


**AC 1.11.4**
**Given** membership removal races with a protected synthetic service command
**When** SC-2 authorization epoch and expected revision are checked in the transaction
**Then** the service establishes one ordering; an operation ordered after removal cannot commit with old membership
**And** administrative membership rights do not create private-resource grants and the current record is not replaced by a stale client revision.

### Story 1.12: Govern the local data actually held by the first private route

As an administrator,
I want explicit access, retention, deletion, export and recovery for local Task history and metadata,
So that the first enabled route does not create ungoverned retained material.

Increment 1. Origin: old Story 12.3. Requirements/inventory: AD-13, AD-14, C75, FR-37, NFR-10, NFR-9, OQ-2, UX-DR42.

**Prerequisites:** Story 1.4, Story 1.9.

**Acceptance Criteria:**

**AC 1.12.1**
**Given** the initial local route holds Task history, working metadata, logs or recovery data
**When** its data policy is inspected
**Then** each enabled category has an effective rule and owner; source extracts, artifacts, shared caches and unattended categories remain disabled until their route controls arrive
**And** unknown policy is a real-data enablement blocker, not an invented retention duration.

**AC 1.12.2**
**Given** an authorized export and reimport of currently held categories
**When** the round trip completes
**Then** declared included content and attribution are reproduced, with omissions/losses explicit
**And** an export is not a transfer of permissions or a claim of authoritative audit-record acceptance.

**AC 1.12.3**
**Given** an authorized deletion of currently held local data
**When** the result is reported
**Then** removed and retained categories are named, including surviving external/exported copies
**And** no V2 hold/native-record lifecycle is silently added to this V1 control.

### Story 1.13: Keep provider credentials separate and protected

As an administrator,
I want provider credential state separate from Inquello identity,
So that connecting or losing inference never grants product authority.

Increment 1. Origin: old Story 2.2. Requirements/inventory: AD-7, AD-8, C53, C54, C54A, C55, C56, C57, OQ-14, UX-DR40.

**Prerequisites:** Story 1.10.

**Gate:** Implement only selected current-route credential adapters; all named provider routes remain in scope, with later adapters gated individually.

**Acceptance Criteria:**

**AC 1.13.1**
**Given** an authenticated Inquello identity and a selected provider adapter
**When** provider credentials connect, expire or are revoked
**Then** the provider adapter changes only inference-route authorization; Inquello identity, membership and grants are unchanged
**And** a contract-level synthetic session test verifies this without requiring a future Task/search surface.

**AC 1.13.2**
**Given** provider credentials in trusted facilities
**When** an initial tool/export/log path is exercised
**Then** credentials do not enter model context, tool subprocess environments beyond the trusted credential adapter, artifacts, exports or logs
**And** later tools and material categories must repeat the same negative protection test before enablement.

### Story 1.14: Organise private Workspaces, Engagements, folders and Tasks

As an Internal Auditor,
I want to create Engagements with objectives, scope, period and members, group Tasks and folders under them, and start ad hoc Tasks outside any Engagement,
So that related work is organised the way audit practice names it without forcing every question into an Engagement (FR-1).

Increment 1. Origin: old Story 1.4. Requirements/inventory: AD-6, AD-7, C02, C05, C13, FR-1, UX-DR27, UX-DR37.

**Prerequisites:** Story 1.4, Story 1.11, Story 1.12.

**Acceptance Criteria:**

**AC 1.14.1**
**Given** a selected Workspace
**When** the user creates an Engagement
**Then** it is stored in the working SQLite with a stable Workspace-scoped identity, optional client/entity, period and membership references validated by the shared service, and appears in the Engagements section
**And** no Engagement field is mandatory for a Task: a new Task from New thread can exist with no Engagement.

**AC 1.14.2**
**Given** an Engagement
**When** the user creates folders and Tasks under it or moves a Task between Engagements
**Then** each Task keeps its stable Task identity, its runtime thread reference and its permitted source/artifact references after the move
**And** the Header shows the supplied client/period and effective Workspace for the open Task.

**AC 1.14.3**
**Given** the domain repository owns writes
**When** a Task record is created or changed
**Then** the mutation goes through a domain command that records operation identity and expected version, and no renderer code or agent tool writes to the working SQLite directly.

**AC 1.14.4**
**Given** a new Task is created or moved
**When** its default visibility is evaluated
**Then** it is private to its creator regardless of Workspace/Engagement membership
**And** moving it retains identity and permitted references but never broadens its grants; explicit sharing is delivered in Epic 4, and no nonfunctional Share control is enabled here.

### Story 1.15: Distinguish execution, checks, review and delivery states

As an Internal Audit Manager,
I want every Task to show its real state: planned, running, blocked, interrupted, produced, checks complete or incomplete, review requested, revision requested, approval and Delivery states,
So that "done" never collapses different meanings into one word (FR-44 seed, AD-6).

Increment 1. Origin: old Story 1.9. Requirements/inventory: AD-6, C13, C41, C61, FR-44, UX-DR20, UX-DR51.

**Prerequisites:** Story 1.14.

**Acceptance Criteria:**

**AC 1.15.1**
**Given** the domain model
**When** a Task, run, artifact, check, human review, Professional Approval or Delivery state changes
**Then** each is stored as a separate state with scope and version, not derived from the runtime turn status alone
**And** no universal state machine forces an advisory answer through approval or delivery steps.

**AC 1.15.2**
**Given** a completed runtime turn
**When** the Task is displayed
**Then** completion of the turn is shown as execution finished, distinct from checks, review and approval, and a green chip or toast never states acceptance.

**AC 1.15.3**
**Given** a UI label for a state outside the StatusChip taxonomy
**When** it renders
**Then** a separate truthful text label is used rather than coercing it into suggested/investigating/open/evidence/accepted.

### Story 1.16: Navigate the desktop shell with keyboard and responsive layout

As an Internal Auditor,
I want the documented Sidebar/Header and adaptive keyboard navigation,
So that I retain context at any supported desktop width.

Increment 1. Origin: old Story 1.3. Requirements/inventory: C01, FR-3, UX-DR27, UX-DR30, UX-DR48, UX-DR50, UX-DR55.

**Prerequisites:** Story 1.5, Story 1.6, Story 1.7, Story 1.8, Story 1.14, Story 1.15.

**Acceptance Criteria:**

**AC 1.16.1**
**Given** the shell is open at desktop width
**When** it renders
**Then** the Sidebar is 264px with the 20px lockup, a Workspace selector, an Engagements section, nested Tasks with NavRow hierarchy and bottom person/settings; the Header is 48px with the 14px title and muted Workspace/Engagement context; the thread is centred at up to 720px with the Composer reachable
**And** collapsing to the 52px rail keeps symbol, labelled actions, counts and the current surface/task.

**AC 1.16.2**
**Given** keyboard-only use
**When** the user tabs through the shell
**Then** order follows task navigation, main content, contextual artifact/review actions, Composer; no scroll area traps focus; hover-only actions appear on focus; Ctrl/Cmd+N and Ctrl/Cmd+K are bound only where Electron can do so safely; Escape closes the topmost Menu or overlay, returns focus and never stops a Task
**And** headings and landmarks identify navigation, main work, artifact and contextual review; surface changes are announced once.

**AC 1.16.3**
**Given** the window is narrower than Sidebar plus thread plus 380px artifact minimum
**When** the layout adapts
**Then** navigation collapses to the rail, then the artifact and conversation become explicitly switchable views with the same selected item and unsent text, and no horizontal page overflow occurs
**And** no dark theme is introduced.

### Story 1.17: Compose a plain private request without claiming later inputs

As an Internal Auditor,
I want a reachable Composer that preserves unsent plain text across navigation,
So that I can prepare a request safely.

Increment 1. Origin: old Story 1.3. Requirements/inventory: C01, FR-3, UX-DR27, UX-DR30, UX-DR48, UX-DR50, UX-DR55.

**Prerequisites:** Story 1.16.

**Acceptance Criteria:**

**AC 1.17.1**
**Given** the Composer holds unsent text
**When** the user navigates away and returns
**Then** the text is preserved and Enter/Shift+Enter/input-method behavior follows the documented mode
**And** attachment and selected-Method state preservation is reserved to Epic 2 when those controls work; disabled capabilities are labelled, not simulated.

### Story 1.18: Inspect effective managed policy and explicit broader modes

As an administrator,
I want organisational managed policy to be computed and shown for each Task and environment, with any no-prompt or full-access mode visible only when policy permits it,
So that an action unavailable here is explained and a broad mode is never mistaken for approval (FR-33, C70).

Increment 1. Origin: old Story 2.5. Requirements/inventory: A15, AD-8, C67, C68, C70, FR-33, UX-DR40.

**Prerequisites:** Story 1.11, Story 1.16.

**Acceptance Criteria:**

**AC 1.18.1**
**Given** organisation requirements, environment overrides and user configuration
**When** a Task starts or changes environment
**Then** S07 shows the effective policy for execution, tools, extensions and approval behaviour and names which organisation rule governs a restricted setting.

**AC 1.18.2**
**Given** a full-access or no-prompt mode
**When** it is enabled
**Then** it requires explicit permitted configuration, its effective reach is shown on the Task, and it is never labelled as review or Professional Approval.

**AC 1.18.3**
**Given** prompt inspection or specialist cyber access is configured later
**When** this story is verified
**Then** the Capability Contract lists both as not enabled, with eligibility verification required before enablement.

### Story 1.19: Bound initial tool reads, writes and network access

As an Internal Auditor,
I want a Task's permission profile explained as which evidence it can read, where it can write and which destinations it can contact,
So that I understand its reach without reading sandbox policy syntax (FR-33, C65).

Increment 1. Origin: old Story 2.3. Requirements/inventory: AD-5, AD-8, C65, FR-33, OQ-13.

**Prerequisites:** Story 1.3, Story 1.14, Story 1.18.

**Acceptance Criteria:**

**AC 1.19.1**
**Given** a private Task uses an approved local tool profile
**When** the runtime applies it
**Then** only its explicitly permitted read/write locations and destinations are reachable; source/output-folder permissions are enforced on synthetic paths
**And** the full evidence-folder experience arrives in Epic 2; no real source attachment capability is claimed here.

**AC 1.19.2**
**Given** an operation outside the profile
**When** the agent attempts it
**Then** the operation is denied or escalated per policy, the denial names the boundary, and the Task continues with retained work.

**AC 1.19.3**
**Given** the local OS sandbox inherited from Codex
**When** execution runs in V1
**Then** enforcement is local (OQ-13) and the Capability Contract records that no hosted sandbox exists; this is labelled "V2 revisit (OQ-13)".

**AC 1.19.4**
**Given** a network restriction
**When** a tool contacts an unlisted destination
**Then** the attempt is blocked and reported with the destination named.

### Story 1.20: Authorize specific actions without granting professional approval

As an Internal Auditor,
I want consequential actions presented as what will happen, to which destination, with what content, and command rules that allow, prompt or forbid,
So that permission to act is explicit and never confused with reviewing or approving audit work (FR-33, C66, C69).

Increment 1. Origin: old Story 2.4. Requirements/inventory: AD-11, C66, C69, FR-33, UX-DR24, UX-DR51.

**Prerequisites:** Story 1.8, Story 1.18, Story 1.19.

**Acceptance Criteria:**

**AC 1.20.1**
**Given** the agent proposes an action requiring permission
**When** the ApprovalCard renders
**Then** it names the exact action, content or command, destination and consequences, offers permitted alternatives, and its primary button carries the action verb (for example "Send this request to [recipient]"), never a bare "Approve".

**AC 1.20.2**
**Given** the user denies the action
**When** the Task continues
**Then** the denied action is not performed, no alternative widens scope, and unresolved work is preserved.

**AC 1.20.3**
**Given** command rules allow, prompt or forbid command prefixes
**When** a matching command is attempted
**Then** the most restrictive matching rule wins, the decision and controlling rule are shown with the analysis action and destination described, and an allowed command still runs within the sandbox profile.

**AC 1.20.4**
**Given** the inherited automatic approval reviewer is enabled by policy
**When** it evaluates a request
**Then** it operates under the same sandbox and policy, cannot widen access, and its decision is labelled as an automated permission review, not analytical review or Professional Approval.

### Story 1.21: Discover current tools and connection states honestly

As an Internal Auditor,
I want S07 to list built-in tools, connected apps, MCP servers and installed plugins with identity, dependencies, installed/enabled/callable state and limits,
So that missing access is never mistaken for missing functionality (FR-21, C33 to C36).

Increment 1. Origin: old Story 8.1. Requirements/inventory: C33, C36, FR-21, OQ-4, UX-DR40.

**Prerequisites:** Story 1.9, Story 1.13, Story 1.16, Story 1.18.

**Acceptance Criteria:**

**AC 1.21.1**
**Given** configured capabilities
**When** S07 renders
**Then** each capability shows its source (built-in, app, MCP server, plugin), version, dependencies, effective permission and whether it is installed, enabled and callable now, and an unavailable connection explains the missing route.

**AC 1.21.2**
**Given** a plugin package is installed
**When** its tools are listed
**Then** installation grants no connector credentials; a tool needing a connection shows that connection as unauthenticated until the user connects it.

**AC 1.21.3**
**Given** an expired or revoked connection
**When** it is shown
**Then** the applicable next action is offered without silent fallback.

**AC 1.21.4**
**Given** a provider sign-in completes
**When** its state is displayed
**Then** S07 shows the provider session separately from the Inquello identity, with the effective route and its capability limits, and no Workspace, Engagement or review permission changes.

### Story 1.22: Configure initial processing routes without silent fallback

As an administrator,
I want each documented route (ChatGPT/OpenAI sign-in, API key, Azure Foundry/Azure OpenAI, Bedrock, GCP/Vertex, organisation gateway, local model; Claude API key selected; subscription conditional on official permission and integration eligibility) configurable with its effective provider, deployment and capability limits shown per Task,
So that an unsupported operation never silently switches route (FR-29, C53 to C57, OQ-9).

Increment 1. Origin: old Story 8.5. Requirements/inventory: A15, AD-8, C53, C57, FR-29, NFR-8, NFR-9, OQ-14, OQ-9, UX-DR40.

**Prerequisites:** Story 1.9, Story 1.13, Story 1.19, Story 1.20, Story 1.21.

**Gate:** Owner selected Claude API-key access as the initial additional route (Sentinel_1ee4b9e93af48191bd5a2f035d7b74c6). CR-1 now records the native Messages adapter ownership/normalization contract; Story 1.22 implements it at the selected fork cut. Current inspected Responses-only configuration is not plug-and-play. Actual account/model/processing eligibility remains separate. Subscription access is conditional per AD-23, not an API-key prerequisite. No paid calls, credentials, region, spend or implementation authorized.

**Acceptance Criteria:**

**AC 1.22.1**
**Given** a configured route
**When** a Task uses it
**Then** S07 and the Task show provider, deployment or endpoint identity, region where applicable, and the capabilities available on that route, with execution, inference and connector data flows listed separately.

**AC 1.22.2**
**Given** an operation the route does not support
**When** requested
**Then** the request fails with the limit named and no other route is used.

**AC 1.22.3**
**Given** provider credentials
**When** configured
**Then** they are supplied outside prompts and artifacts (the earlier applicable capability contract) and the route's eligibility status (not verified / verified for synthetic / verified for real data) is recorded in its Capability Contract.

**AC 1.22.4**
**Given** the inherited default and one organisation-approved route are candidates for Increment 1
**When** each is configured
**Then** its capability/identity/processing contract is recorded separately and it stays synthetic-only until its current-route negative and eligibility checks pass
**And** remaining named routes, including conditional Claude subscription integration, remain explicit later supply/eligibility gates.


**AC 1.22.5**
**Given** the owner-selected Claude API-key route and the actual selected fork cut
**When** CR-1 adapter planning is checked before implementation
**Then** exact provider-dispatch, request/history/tool/stream mapping, credential isolation, capability limits and error/retry boundaries are recorded with shared schema fixtures
**And** changing a URL/key is not counted as Messages compatibility; no fixture is mislabelled as a live provider test or real-data eligibility.

**AC 1.22.6**
**Given** Claude subscription login is desired only where Anthropic permits it
**When** available routes and their status are presented
**Then** the selected API-key route is distinct from any conditional official-binary integration or prior-approved custom subscription integration
**And** no Claude.ai token collection/reuse, hidden local-model fallback, silent harness replacement or unapproved paid call occurs.

### Story 1.23: Show local execution separately from inference

As an IT Auditor,
I want to select an approved environment for a Task and see where execution happens separately from where model processing happens,
So that a local window is never taken as proof of local inference (FR-5, NFR-8, C10, C07).

Increment 1. Origin: old Story 4.5. Requirements/inventory: A15, AD-8, C07, C10, FR-5, NFR-8, UX-DR40.

**Prerequisites:** Story 1.16, Story 1.22.

**Acceptance Criteria:**

**AC 1.23.1**
**Given** a Task
**When** its environment panel renders
**Then** it shows execution location (local host) and inference location (configured provider/deployment facts or "no route") as separate facts, and the unavailable remote environments are listed as not enabled with their gate.

**AC 1.23.2**
**Given** an environment becomes unavailable
**When** the user starts work
**Then** the failure names the environment and the Task is not silently moved elsewhere.

### Story 1.24: Choose reasoning and inspect attributable usage

As an Internal Auditor,
I want to choose effort and speed per Task, see consumption across main and delegated work, and have inherited plan or Workspace limits enforced visibly,
So that costs are attributable to deliverables and a stop is explained (FR-30, C53, OQ-5).

Increment 1. Origin: old Story 8.6. Requirements/inventory: C53, FR-30, NFR-6, OQ-5.

**Prerequisites:** Story 1.15, Story 1.22.

**Acceptance Criteria:**

**AC 1.24.1**
**Given** a Task
**When** the user changes reasoning or speed
**Then** the setting is stored with the resulting outputs so two runs can be compared, and the choice is never presented as evidence quality.

**AC 1.24.2**
**Given** an inherited usage limit is reached
**When** work would exceed it
**Then** the Task stops or escalates with the limit and next action explained, and retained work is preserved.

**AC 1.24.3**
**Given** a plain Task has completed or failed runs
**When** consumption is inspected
**Then** tool/model usage including failed and repeated runs is attributable to the Task
**And** artifact attribution extends with artifact delivery in Epic 3; delegated consumption extends with Epic 10 and is not claimed here.

### Story 1.25: Start a real plain-text private Task on a configured route

As an Internal Auditor,
I want a real private request to start on one configured synthetic-approved route without files or a Method,
So that the first increment has working execution rather than a mocked Task.

Increment 1. Origin: old Story 1.5. Requirements/inventory: C01, C02, C11, C33, FR-7, UX-DR22, UX-DR29, UX-DR33, UX-DR47.

**Prerequisites:** Story 1.2, Story 1.14, Story 1.15, Story 1.17, Story 1.19, Story 1.20, Story 1.22, Story 1.23, Story 1.24.

**Acceptance Criteria:**

**AC 1.25.1**
**Given** New thread opens the Start surface
**When** it renders
**Then** focus begins at the request and the prompt is “What should we work on?”; an empty request disables Send with an explanation
**And** applied-Method and file controls remain truthfully unavailable until Epic 2, never decorative promises.

**AC 1.25.2**
**Given** a nonempty plain request and a configured synthetic-approved initial route
**When** the user submits synthetic test content
**Then** the domain creates a creator-private Task, binds its runtime thread to the actual request and acting identity, and opens the Active surface
**And** a missing route, invalid identity or denied policy preserves the draft and performs no unapproved fallback; this does not enable real-data use before the earlier applicable capability contract.

**AC 1.25.3**
**Given** optional remote capabilities are unavailable
**When** a local Task is requested
**Then** execution proceeds only if current identity/policy and the selected inference route are actually available
**And** unavailable dependencies are named; this is not a whole-product offline promise.

### Story 1.26: Follow actual basic progress and truthful results

As an Internal Auditor,
I want to watch what the agent is doing, see its plan, its tool activity and its results with calculations, observations, suggestions, decisions and gaps told apart,
So that I can judge the work while it happens rather than after (FR-7, S02).

Increment 1. Origin: old Story 1.6. Requirements/inventory: AD-5, AD-6, C11, C12, C14, C15, C41, C76, FR-7, UX-DR13, UX-DR21, UX-DR23, UX-DR34.

**Prerequisites:** Story 1.8, Story 1.15, Story 1.25.

**Acceptance Criteria:**

**AC 1.26.1**
**Given** a running Task
**When** runtime events stream
**Then** the thread shows messages, tool activity and edits translated into Task progress, PlanStep items are done only when the step actually finished, running shows the blue state and pending stays neutral
**And** input needs (questions, approval requests) are shown in context with focus staying on the user's control.

**AC 1.26.2**
**Given** the agent produces a result
**When** it is displayed
**Then** calculations, observations, suggestions, decisions and gaps are labelled with JudgmentTag text and a decision names its human or policy basis
**And** the result distinguishes checked, unchecked and incomplete work in words, not colour alone.

**AC 1.26.3**
**Given** no artifact exists yet
**When** the artifact region renders
**Then** "no artifact yet" is distinct from "artifact failed".

### Story 1.27: Reject untrusted instructions in initial tool output

As an Internal Auditor,
I want instructions found inside evidence, retrieved pages, tool results or examples to be recognised as content under examination,
So that a document telling the assistant to ignore an exception cannot change what I authorised (FR-34, C73, M1).

Increment 1. Origin: old Story 2.6. Requirements/inventory: A07, AD-8, C3, C73, FR-34.

**Prerequisites:** Story 1.19, Story 1.25, Story 1.26.

**Acceptance Criteria:**

**AC 1.27.1**
**Given** a permitted synthetic local tool returns content telling the agent to expand its mandate
**When** the Task consumes that output
**Then** the injected instruction is treated as attributed data and cannot widen authorization
**And** this tests the current route, not all future evidence/browser/Method mechanisms.

**AC 1.27.2**
**Given** a blocked or inspected action
**When** it is reported
**Then** the relevant limits are disclosed and the report does not claim that every untrusted input was detected.

### Story 1.28: Gate current-route real-data use on negative authorization evidence

As an Internal Audit Manager,
I want a repeatable suite of negative tests across Workspaces, Engagements, Sources, delegation, memory, artifacts and sharing,
So that no route carries real data until prohibited access and actions are proven blocked (NFR-3, SM-C3, OQ-9).

Increment 1. Origin: old Story 2.7. Requirements/inventory: A14, C3, C65, C70, C72, NFR-3, OQ-9.

**Prerequisites:** Story 1.9, Story 1.11, Story 1.12, Story 1.19, Story 1.20, Story 1.22, Story 1.25, Story 1.27.

**Acceptance Criteria:**

**AC 1.28.1**
**Given** two test Workspaces and two members within one Workspace with distinct private Tasks
**When** one attempts unauthorized reads or tool actions currently supplied
**Then** cross-company access and peer-private disclosure fail without content leakage; current service membership removal denies subsequent current-route protected use
**And** delegation, admitted memory, shared artifacts and unattended tests are reserved to the epics that introduce those routes; disabled routes are not counted as passing.

**AC 1.28.2**
**Given** a route enabled in Increment 1
**When** the suite runs against it
**Then** the results are attached to that route's Capability Contract and the route is marked eligible for real data only after the suite passes and organisational eligibility is confirmed.

**AC 1.28.3**
**Given** an enabled initial route and current OQ-16 authority-validation contract
**When** the route’s synthetic negative tests and organizational eligibility review finish
**Then** real-data eligibility is enabled only if evidence actually passes and approval is current
**And** failure or unknown freshness blocks real-data protected use; this story does not claim fixtures have already run.

**AC 1.28.4**
**Given** membership or current-route authority is revoked while a private Task is running
**When** the runtime would next use protected context, emit a derived answer
**Then** the active agent stops revoked use and affected cached/derived context is invalidated, suppressed or quarantined before further disclosure under OQ-16
**And** current held-category logs, current-category exports and recovery cannot bypass revocation; uncertainty fails closed. Already exported copies cannot be recalled.

### Story 1.29: Steer, stop and recover the same private Task

As an Internal Auditor,
I want to redirect, interrupt and later resume a Task, including long-running goals and background work, and see exactly what was done and what remains,
So that stopping never hides applied effects and resuming never pretends to roll back (FR-8).

Increment 1. Origin: old Story 1.7. Requirements/inventory: AD-7, AD-8, C13, C14, C16, C17, FR-8, UX-DR11, UX-DR23, UX-DR37, UX-DR47.

**Prerequisites:** Story 1.15, Story 1.25, Story 1.26, Story 1.28.

**Acceptance Criteria:**

**AC 1.29.1**
**Given** a running Task
**When** the user sends a steering instruction
**Then** it is queued or applied to the running turn as the runtime supports, and a scope change identifies results it affects.

**AC 1.29.2**
**Given** a running Task with three completed and two pending steps
**When** the user presses Stop
**Then** the message states "Work interrupted. 3 steps completed; 2 remain." with actual counts, pending steps stay pending, effects actually supported and applied on this route (for example confirmed tool-side effects) remain listed and nothing claims rollback
**And** the Stop control requests interruption only; Escape does not trigger it.

**AC 1.29.3**
**Given** a stopped or closed Task
**When** the user resumes it
**Then** the domain rechecks source access and Task authority first, missing context or changed access is stated, and the Task continues from its retained runtime thread with its currently held history and metadata; artifact continuity is tested when artifacts arrive in Epic 3
**And** if the runtime thread cannot be linked to the Task record, the Task is shown as unlinked/uncertain rather than a new thread being replayed silently.

**AC 1.29.4**
**Given** a long-running goal or a background Task
**When** it continues while the user works elsewhere
**Then** its status, completion conditions and requests for input are visible in navigation and it never steals focus
**And** a session loss or crash preserves the last confirmed history and working metadata and reports interrupted work on restart (NFR-4).

**AC 1.29.5**
**Given** access or membership changed before resume
**When** the real resume path revalidates identity and retained context
**Then** revoked private/shared-dependent content is not reused or emitted; affected work stops or is safely rebased
**And** this extends the current-route gate with the resume operation now implemented; it is not presumed covered by earlier command-only tests.

### Story 1.30: Find and reopen only permitted saved work

As an Internal Audit Manager,
I want to search accessible Tasks, files and Engagements, pin and archive work, and see which Tasks await input, review or Delivery,
So that I can find and prioritise work without being shown anything I cannot access (FR-2, S05).

Increment 1. Origin: old Story 1.8. Requirements/inventory: AD-8, C02, C05, C49, C61, FR-2, UX-DR13, UX-DR30, UX-DR38.

**Prerequisites:** Story 1.14, Story 1.15, Story 1.16, Story 1.21, Story 1.28, Story 1.29.

**Acceptance Criteria:**

**AC 1.30.1**
**Given** the Search surface (Ctrl/Cmd+K or Sidebar)
**When** the user searches
**Then** only current private Tasks and Engagements; file results are added when file context exists, and then remain within effective access are returned; no workspaces, no matches and search unavailable are separate states; the term is kept on failure; focus returns to the trigger on close.

**AC 1.30.2**
**Given** a Task
**When** the user pins, archives or reopens it
**Then** pinning and archiving change navigation only, archiving states that no authoritative record is deleted, and reopening exposes saved progress and currently held metadata; artifact reopen is completed with Epic 3.

**AC 1.30.3**
**Given** current Tasks awaiting input and synthetic read-model fixtures for later review/Delivery categories
**When** navigation renders
**Then** each state is shown with text and a count badge that names the category, and the Inbox route lists actual available items only; synthetic fixtures establish the distinct category semantics without claiming review or delivery is enabled without implying approval.

**AC 1.30.4**
**Given** access to a Task was revoked after indexing
**When** the user searches
**Then** the stale index does not reveal the revoked content.

**AC 1.30.5**
**Given** a user signed in to Inquello but not to any provider
**When** they open a Task
**Then** they can organise, search and inspect work, and S07 states that no inference route is available without implying the product lacks the capability.

**AC 1.30.6**
**Given** a provider session expires or is revoked
**When** the user continues
**Then** Inquello authority is unchanged, the Task keeps its retained work, and the user is offered the applicable reconnect action.

**AC 1.30.7**
**Given** a Task was indexed before authority was revoked
**When** the real search/reopen path runs
**Then** the stale index, result snippet and resumed history reveal no revoked content
**And** negative evidence for this newly supplied path is attached to its capability entry before real-data search enablement.

## Epic 2: Attributable analysis with Methods

Increment 1. 18 stories. Owner-approved group structure; detailed stories are the consolidated review proposal, not individually approved or ready-for-development statuses. Each acceptance criterion is a requirement, not executed test evidence.

### Story 2.1: Understand an existing work folder with precise references

As an Internal Auditor,
I want the assistant to read my Engagement folder (xlsx, docx, pptx, csv, pdf, text, images) and cite the sheet, range, page or passage behind each statement,
So that I can trace an explanation to the exact material (FR-9, C18).

Increment 1. Origin: old Story 3.1. Requirements/inventory: AD-8, C18, C33, FR-9, OQ-2, UX-DR22.

**Prerequisites:** completed Epic 1 delivery and earlier required contracts; no later epic is required.

**Acceptance Criteria:**

**AC 2.1.1**
**Given** a folder with supported files
**When** the agent answers from them
**Then** each relied-on statement carries a reference to file, version/modified time and location (sheet and range, page, passage or slide), and the retained extract is stored with that reference without automatically uploading a full source copy; retained extracts remain private unless admitted by an authorized explicit share or formal issue.

**AC 2.1.2**
**Given** a file that is inaccessible and a file that is unreadable
**When** the folder is examined
**Then** both are listed separately from the files actually searched, with the reason, and the answer states that Coverage excludes them.

**AC 2.1.3**
**Given** the agent received only part of the requested material
**When** it reports
**Then** the result names the incomplete input set and does not describe it as full Coverage.

**AC 2.1.4**
**Given** this route introduces private source references and relied-on extracts
**When** the category is enabled and its current policy exercised
**Then** access, retention, deletion, export and recovery rules are implemented and tested for the actual held category before real-data use
**And** unknown policy blocks enablement; no duration is invented. Revocation suppresses retained/derived disclosure, recovery cannot resurrect grants, exports disclose losses and surviving external copies; neither shared controls in Epic 4 nor broader controls in Epic 13 substitute for this local floor.

### Story 2.2: Use images and screenshots as attributable context

As an IT Auditor,
I want to supply screenshots and diagrams and have their provenance, capture context and interpretation uncertainty kept beside the analysis,
So that a visible configuration is never mistaken for proof of completeness or timing (FR-9, C22).

Increment 1. Origin: old Story 3.2. Requirements/inventory: AD-8, C22, FR-9.

**Prerequisites:** 2.1.

**Acceptance Criteria:**

**AC 2.2.1**
**Given** an attached screenshot of an access-administration screen and an approved-role matrix
**When** the user asks which visible entitlements differ
**Then** the answer lists differences with references to the image region and matrix row, and states that the image does not establish history, hidden records or the period in force.

**AC 2.2.2**
**Given** an image without supplied provenance
**When** it is used
**Then** the analysis records capture time and source as unknown and labels conclusions accordingly.

### Story 2.3: Capture selections and application snapshots with saved or live scope stated

As an Internal Auditor,
I want to attach a selected file region or the current application window to a Task and have Inquello state whether it is saved file state or a live snapshot and when it was taken,
So that the agent and I never work from different versions unknowingly (FR-10, C27, C24).

Increment 1. Origin: old Story 3.3. Requirements/inventory: A16, AD-9, C24, C26, C27, FR-10.

**Prerequisites:** 2.2.

**Acceptance Criteria:**

**AC 2.3.1**
**Given** a selected range in a saved workbook
**When** it is attached
**Then** the attachment records file identity, version, the range and "saved state"; if the host exposes a live selection, it is recorded as "live state" with its time.

**AC 2.3.2**
**Given** an application snapshot
**When** it is attached
**Then** the capture time, application/source identity and the coverage of the capture are recorded, and a snapshot older than the current file version is marked stale when the agent relies on it.

**AC 2.3.3**
**Given** composer assistance is unavailable on this client
**When** the user types
**Then** no suggestion is shown and the Capability Contract records the feature as not enabled rather than silently absent.

### Story 2.4: Attach connector identity, entity scope and extraction context to evidence

As an Internal Audit Manager,
I want evidence retrieved through a connected app or MCP tool to carry the acting account, entity scope and extraction time,
So that a complete-looking dataset is read with the principal that produced it (FR-21, C34, C35, C72).

Increment 1. Origin: old Story 8.2. Requirements/inventory: A10, AD-8, C34, C35, C72, FR-21, NFR-7.

**Prerequisites:** 2.3.

**Acceptance Criteria:**

**AC 2.4.1**
**Given** a read-only database tool
**When** it returns a population
**Then** the result records source identity, the account used, entity scope and observation time, and the thread shows them before the data is relied on.

**AC 2.4.2**
**Given** a write-capable tool
**When** a mutation is proposed
**Then** the acting account and destination are shown in the ApprovalCard and the write is reviewed separately from reads.

### Story 2.5: Run calculations, queries and scripts with retained derivations

As an IT Auditor,
I want executable analysis to keep its code, input identifiers, parameters, reconciliation checks and outputs with the result,
So that another auditor can inspect and reperform the calculation (FR-11, C19, C33).

Increment 1. Origin: old Story 3.4. Requirements/inventory: AD-9, C19, C20, C33, FR-11, NFR-2, UX-DR44.

**Prerequisites:** 2.4.

**Acceptance Criteria:**

**AC 2.5.1**
**Given** a request to recalculate expected payroll from approved inputs
**When** the agent runs a script
**Then** the script, its input file identities and versions, parameters and output are stored as an Analysis linked to the Task, and the result references that Analysis.

**AC 2.5.2**
**Given** an input file changes after the Analysis ran
**When** the Task continues
**Then** the agent either recomputes and shows the difference or marks the prior result stale with the changed input named.

**AC 2.5.3**
**Given** a script fails
**When** the failure is shown
**Then** a minimal inspectable execution-error detail view is supplied here for technical users (the fuller S11 surface follows), the ordinary thread states what failed and what retained outputs exist, and no partial output is presented as a result.

**AC 2.5.4**
**Given** this route introduces private derived Analysis inputs, scripts, parameters and results
**When** the category is enabled and its current policy exercised
**Then** access, retention, deletion, export and recovery rules are implemented and tested for the actual held category before real-data use
**And** unknown policy blocks enablement; no duration is invented. Revocation suppresses retained/derived disclosure, recovery cannot resurrect grants, exports disclose losses and surviving external copies; neither shared controls in Epic 4 nor broader controls in Epic 13 substitute for this local floor.

### Story 2.6: Apply standing instructions and Workspace guidance with provenance

As an Internal Auditor,
I want Workspace, Engagement and folder instructions applied to my Task with their source shown, and any material instruction labelled as policy, procedure, memory or current request,
So that I know which conventions shaped a result and which authority each has (FR-19, FR-20, C39, C52).

Increment 1. Origin: old Story 7.1. Requirements/inventory: AD-10, C39, C52, FR-19, FR-20, UX-DR39.

**Prerequisites:** 2.5.

**Acceptance Criteria:**

**AC 2.6.1**
**Given** Workspace and Engagement instruction files
**When** a Task runs
**Then** the effective guidance list shows each applied instruction with its file and scope, and conflicts are shown rather than silently resolved.

**AC 2.6.2**
**Given** a material instruction influencing an output
**When** the output is inspected
**Then** its origin is labelled as policy, procedure (Method), memory or the current request.

### Story 2.7: Define, select and validate a Method before Task invocation

As an Internal Auditor,
I want an identifiable Method definition with required inputs, outputs, dependencies and verification steps,
So that I can select a real procedure before execution.

Increment 1. Origin: old Story 7.2. Requirements/inventory: C36, C37, FR-19, OQ-4, UX-DR39.

**Prerequisites:** 2.6.

**Acceptance Criteria:**

**AC 2.7.1**
**Given** a user authors or selects a permitted skill
**When** its definition is registered
**Then** its identity, version, criteria references, required inputs, outputs and verification steps are inspectable under inherited Workspace/local/plugin distribution
**And** an instruction or skill cannot grant execution or source authority.

**AC 2.7.2**
**Given** a missing dependency (tool, reference or file)
**When** preflight validates an attempted invocation
**Then** the missing item is named and the draft Task is kept.

**AC 2.7.3**
**Given** S06
**When** no reusable Method exists
**Then** creation or selection from permitted guidance is offered; incompatible version and denied distribution are distinct states.

### Story 2.8: Start a Task with actual files and a selected Method

As an Internal Auditor,
I want to describe the outcome I need, attach permitted files and optionally apply a procedure before starting,
So that the Task begins with exactly the context and guidance I chose (FR-7 start, S01).

Increment 1. Origin: old Story 1.5. Requirements/inventory: C01, C02, C11, C33, FR-7, UX-DR22, UX-DR29, UX-DR33, UX-DR47.

**Prerequisites:** 2.7.

**Acceptance Criteria:**

**AC 2.8.1**
**Given** the Start surface after New thread
**When** it renders
**Then** focus starts at the request, the prompt reads "What should we work on?", the applied-method row shows Applied or Not applied from actual inclusion, and suggested existing files are those accessible in the current Workspace
**And** an empty request keeps Send disabled with the reason shown.

**AC 2.8.2**
**Given** text, attached files and an applied Method
**When** the user sends
**Then** a Task is created with a stable identity, the actual text, file references and Method identity are passed to the runtime thread, and the Active surface opens with those visible
**And** an unreadable or inaccessible attachment stays identified on its FileChip and the draft is preserved rather than discarded.

### Story 2.9: Retain Composer attachments and selected Method during navigation

As an Internal Auditor,
I want a desktop shell with Workspace selection, an Engagements section, Task navigation, a header that keeps my context visible and a Composer that is always reachable,
So that I can move between work without losing where I am (FR-3 desktop, UX-DR27 to UX-DR30, UX-DR48, UX-DR50, UX-DR55).

Increment 1. Origin: old Story 1.3. Requirements/inventory: C01, FR-3, UX-DR27, UX-DR30, UX-DR48, UX-DR50, UX-DR55.

**Prerequisites:** 2.8.

**Acceptance Criteria:**

**AC 2.9.1**
**Given** the Composer holds unsent text
**When** the user navigates to another surface and back
**Then** the unsent text, attachments and selected Method remain in the session
**And** Enter submits only in the advertised mode, Shift+Enter inserts a newline and input-method composition never sends.

### Story 2.10: Execute and verify a registered Method on its supplied inputs

As an Internal Auditor,
I want the selected versioned Method to run its helpers and produce verified outputs,
So that the procedure is executable rather than a label.

Increment 1. Origin: old Story 7.2. Requirements/inventory: C36, C37, FR-19, OQ-4, UX-DR39.

**Prerequisites:** 2.9.

**Acceptance Criteria:**

**AC 2.10.1**
**Given** a bank-reconciliation skill with required inputs
**When** invoked with this month's files
**Then** the Task records the skill identity, version and parameters, runs its helpers, and produces the declared outputs with verification evidence.

### Story 2.11: Record Task-specific departures separately from Method changes

As an Internal Auditor,
I want to record what differs from the Method on this Task, the Method version, my rationale and the affected scope, without changing the maintained Method,
So that departures are visible with the relied-on work and never become policy by accident (FR-20, AD-10).

Increment 1. Origin: old Story 7.3. Requirements/inventory: AD-10, FR-20, UJ-7.

**Prerequisites:** 2.10.

**Acceptance Criteria:**

**AC 2.11.1**
**Given** an applied Method
**When** the user records a departure
**Then** the departure stores Method identity and version, what differs, rationale, affected outputs, and the person; the Method itself is unchanged.

**AC 2.11.2**
**Given** a denied departure
**When** policy rejects it
**Then** it remains unapplied with its draft rationale preserved and no override occurs.

**AC 2.11.3**
**Given** a relied-on output
**When** it is inspected or reviewed
**Then** its recorded departures are shown beside it.

### Story 2.12: Show population, exclusions, sampling and actual Coverage

As an Internal Audit Manager,
I want every analysis to show whether it was full-population or sample-based, the counts, exclusions, duplicate treatment, sampling parameters and the Coverage actually examined,
So that a successful run never implies complete Coverage (FR-12, UX-DR32).

Increment 1. Origin: old Story 3.6. Requirements/inventory: AD-9, FR-12, NFR-2, UX-DR32.

**Prerequisites:** 2.11.

**Acceptance Criteria:**

**AC 2.12.1**
**Given** an Analysis over a population
**When** it is displayed in Workbook
**Then** the view shows population count, excluded items with reasons, duplicate treatment, the chosen Method's sampling parameters if sample-based, and examined Coverage as a count and share, with a semantic table whose rows link to evidence.

**AC 2.12.2**
**Given** the user's Method does not define sampling
**When** sample-based work is requested
**Then** Inquello asks for or records the Method's parameters and never applies an invented universal sampling rule.

**AC 2.12.3**
**Given** Workbook content wider than the panel
**When** it renders
**Then** horizontal overflow is reachable by keyboard with a labelled boundary and values are not shrunk to fit.

### Story 2.13: Inspect technical investigation detail without forcing it on ordinary review

As an IT Auditor,
I want a technical surface within the Active and Review surfaces showing queries, scripts, outputs, errors and run coverage,
So that technical detail is available on demand while ordinary review stays readable (UX-DR44, FR-11).

Increment 1. Origin: old Story 3.7. Requirements/inventory: AD-5, FR-11, UX-DR44.

**Prerequisites:** 2.12.

**Acceptance Criteria:**

**AC 2.13.1**
**Given** a Task with executed analysis
**When** the user opens the technical view
**Then** selected source, output or error is focused, "no run" is distinct from "run with no findings", and the console region uses the dark ink surface locally without a global dark theme.

**AC 2.13.2**
**Given** an interrupted execution or unavailable specialist service
**When** the view renders
**Then** retained outputs and the safe resume or re-run scope are shown explicitly.

### Story 2.14: Show attributable parallel reads and complete analysis progress

As an Internal Auditor,
I want to watch what the agent is doing, see its plan, its tool activity and its results with calculations, observations, suggestions, decisions and gaps told apart,
So that I can judge the work while it happens rather than after (FR-7, S02).

Increment 1. Origin: old Story 1.6. Requirements/inventory: AD-5, AD-6, C11, C12, C14, C15, C41, C76, FR-7, UX-DR13, UX-DR21, UX-DR23, UX-DR34.

**Prerequisites:** 2.13.

**Acceptance Criteria:**

**AC 2.14.1**
**Given** a running Task
**When** runtime events stream
**Then** the thread shows messages, tool activity and edits translated into Task progress, PlanStep items are done only when the step actually finished, running shows the blue state and pending stays neutral
**And** input needs (questions, approval requests) are shown in context with focus staying on the user's control.

**AC 2.14.2**
**Given** the agent produces a result
**When** it is displayed
**Then** calculations, observations, suggestions, decisions and gaps are labelled with JudgmentTag text and a decision names its human or policy basis
**And** the result distinguishes checked, unchecked and incomplete work in words, not colour alone.

**AC 2.14.3**
**Given** the agent reads several independent sources
**When** the inherited parallel read-only lookups run
**Then** each retrieved item keeps its source and Workspace/Engagement scope in the displayed context.

### Story 2.15: Run hooks with observable outcomes and defined mandatory-check consequences

As a method owner,
I want lifecycle hooks (before/after tool, compaction, task and subagent events) whose success, failure and blocking decisions are visible, with the consequence of a failed mandatory audit check defined,
So that a claimed check is never silently skipped (FR-22, C40).

Increment 1. Origin: old Story 8.3. Requirements/inventory: AD-14, C40, FR-22.

**Prerequisites:** 2.14.

**Acceptance Criteria:**

**AC 2.15.1**
**Given** a mandatory lifecycle hook checks an attributable Analysis output for its population source and parameters
**When** the current analysis/script output is written
**Then** passed, warning, blocked and failed-to-run outcomes are shown and recorded
**And** the synthetic output is not a claim of editable workbook support; the equivalent workbook hook case is completed in Epic 3.

**AC 2.15.2**
**Given** a mandatory check hook that fails to run
**When** the Task continues
**Then** the configured consequence applies (for example the artifact is marked "checks incomplete" and delivery is blocked) rather than the upstream default of proceeding silently.

**AC 2.15.3**
**Given** an unsupported hook version
**When** loaded
**Then** it fails intelligibly with the version named.

### Story 2.16: Keep M1 evidence and retrieved-source instructions subordinate

As an Internal Auditor,
I want instructions found inside evidence, retrieved pages, tool results or examples to be recognised as content under examination,
So that a document telling the assistant to ignore an exception cannot change what I authorised (FR-34, C73, M1).

Increment 1. Origin: old Story 2.6. Requirements/inventory: A07, AD-8, C3, C73, FR-34.

**Prerequisites:** 2.15.

**Acceptance Criteria:**

**AC 2.16.1**
**Given** the M1 evidence containing "ignore exceptions" and "bypass review" instructions
**When** the agent analyses it under the approved procedure
**Then** the exceptions are reported, review is not bypassed, and the investigation record marks the embedded instruction as evidence-originated content that was evaluated, not followed.

**AC 2.16.2**
**Given** a retrieved web page or tool result containing instructions
**When** it enters context
**Then** the trusted task and policy instructions keep their authority and the content is attributed to its source.

**AC 2.16.3**
**Given** a blocked or inspected action
**When** it is reported
**Then** the relevant limits are disclosed and the report does not claim that every untrusted input was detected.

### Story 2.17: Research with attributable sources and labelled limits

As an Internal Auditor,
I want research answers to cite each public or permitted source with its retrieval time and to label estimates and source limitations,
So that material claims can be checked and retrieved text never directs the Task (FR-15, C25 search).

Increment 1. Origin: old Story 6.1. Requirements/inventory: A01, A02, C25, FR-15, FR-34, UJ-1, UJ-6.

**Prerequisites:** 2.16.

**Acceptance Criteria:**

**AC 2.17.1**
**Given** a research question
**When** the agent answers using web search
**Then** each material claim carries a reference with URL/title, retrieval time and the quoted or paraphrased basis, and estimates are labelled with their assumption.

**AC 2.17.2**
**Given** a retrieved page containing instructions
**When** it is used
**Then** the Task's authority is unchanged and the instruction is treated as content (the earlier applicable capability contract).

**AC 2.17.3**
**Given** search is unavailable on the current route
**When** requested
**Then** the limit is stated without silent route substitution.

### Story 2.18: Verify source authority before enabling attributable analysis

As an Internal Auditor,
I want a Task's permission profile explained as which evidence it can read, where it can write and which destinations it can contact,
So that I understand its reach without reading sandbox policy syntax (FR-33, C65).

Increment 1. Origin: old Story 2.3. Requirements/inventory: AD-5, AD-8, C65, FR-33, OQ-13.

**Prerequisites:** 2.17.

**Acceptance Criteria:**

**AC 2.18.1**
**Given** an Engagement with a source folder and an output folder
**When** a Task starts under the default scoped profile
**Then** the agent can read the source folder, write only to the Engagement output folder and cannot change source extracts; the effective profile is shown in S07 in audit terms (sources, working copies, outputs, external destinations).

**AC 2.18.2**
**Given** an input reference or local search index is stale or unauthorized
**When** the Task reads, resumes or searches it
**Then** current authority is checked and inaccessible content is excluded, with the gap visible
**And** no private extract becomes Workspace-visible merely by being retained.

## Epic 3: Editable artifacts and same-file recomputation

Increment 1. 10 stories. Owner-approved group structure; detailed stories are the consolidated review proposal, not individually approved or ready-for-development statuses. Each acceptance criterion is a requirement, not executed test evidence.

### Story 3.1: Create and revise workbooks and CSV with format-aware changes

As an Internal Auditor,
I want Inquello to create and revise .xlsx and .csv files preserving formulas, named ranges, comments, formatting and unrelated sheets, and to show changes as cells and formulas,
So that I can review what changed and keep working in Excel (FR-13, NFR-1, C21, C31, C58).

Increment 1. Origin: old Story 4.1. Requirements/inventory: A04, AD-9, C21, C31, C58, FR-13, NFR-1, OQ-6, UX-DR25.

**Prerequisites:** completed Epic 2 delivery and earlier required contracts; no later epic is required.

**Acceptance Criteria:**

**AC 3.1.1**
**Given** an existing workbook with formulas, a named range, comments, number formatting and an unrelated sheet
**When** the agent revises one sheet
**Then** the reopened workbook retains every untouched feature byte-meaningfully (formulas still formulas, named range intact, comments present, unrelated sheet unchanged) and the change view lists changed cells with before/after values and formulas.

**AC 3.1.2**
**Given** a feature outside the declared supported set (for example a macro or external link)
**When** a change would alter or drop it
**Then** the limit is disclosed before any destructive write and the user can cancel or proceed knowingly.

**AC 3.1.3**
**Given** a stale calculated value cache
**When** the agent reads the workbook
**Then** it detects that cached values may not match formulas and says so before relying on them (A04).

**AC 3.1.4**
**Given** a hook that checks an exception workbook records its population source and parameters
**When** it runs after the write
**Then** the outcome (passed, warning, blocked, failed to run) is shown on the Task and recorded.

**AC 3.1.5**
**Given** this route introduces private editable artifacts and versions
**When** the category is enabled and its current policy exercised
**Then** access, retention, deletion, export and recovery rules are implemented and tested for the actual held category before real-data use
**And** unknown policy blocks enablement; no duration is invented. Revocation suppresses retained/derived disclosure, recovery cannot resurrect grants, exports disclose losses and surviving external copies; neither shared controls in Epic 4 nor broader controls in Epic 13 substitute for this local floor.

### Story 3.2: Create and revise Word documents preserving review metadata

As an Internal Auditor,
I want .docx workpapers created and revised with comments, tracked changes, footnotes, tables, bookmarks and attribution preserved, and passage-level change views,
So that reviewers keep their marks and I can continue in Word (FR-13, NFR-1, W2 preservation).

Increment 1. Origin: old Story 4.2. Requirements/inventory: A05, AD-9, FR-13, NFR-1, UX-DR25.

**Prerequisites:** 3.1.

**Acceptance Criteria:**

**AC 3.2.1**
**Given** the W2 workpaper with comments, a tracked deletion, a footnote, a table, a bookmark and author attribution
**When** the agent revises rejected wording
**Then** the reopened document retains all of them with attribution intact and the change comparison shows the revised passages.

**AC 3.2.2**
**Given** a citation in the document points to missing evidence
**When** the document is analysed
**Then** the broken citation is reported with its location.

**AC 3.2.3**
**Given** an attribution or feature cannot be preserved by the supported writer
**When** a revision is proposed
**Then** the limit is disclosed before change and a reviewable alternative (for example a proposed-text comment) is offered.

### Story 3.3: Create and revise presentations preserving theme, charts and notes

As an Internal Auditor,
I want .pptx options papers created and revised with the declared theme, chart references and speaker notes preserved and assertions linked to analysis,
So that an advisory presentation stays editable and traceable (FR-13, FR-14 visuals, A17).

Increment 1. Origin: old Story 4.3. Requirements/inventory: A17, FR-13, FR-14, NFR-1, UJ-6.

**Prerequisites:** 3.2.

**Acceptance Criteria:**

**AC 3.3.1**
**Given** a presentation with a theme, a chart bound to analysis data and speaker notes
**When** the agent revises slides
**Then** the reopened file retains theme, chart references and notes, and each material assertion slide links to its Analysis or Source.

**AC 3.3.2**
**Given** an estimate without support
**When** it appears on a slide
**Then** it is labelled as an unsupported estimate in the slide and the review view.

### Story 3.4: Continue the same saved file in Excel, Word or PowerPoint and return

As an Internal Auditor,
I want to open the real saved file in its application, edit and save, and have Inquello detect my changes on return and recompute or mark results stale, raising a conflict when edits collide,
So that external editing is a normal part of the workflow and never loses my work (FR-13, UJ-3 steps 3 to 5, A04, NFR-4).

Increment 1. Origin: old Story 4.4. Requirements/inventory: A04, AD-9, C01, C21, C31, FR-13, NFR-4, UJ-3, UX-DR45, UX-DR47, UX-DR50.

**Prerequisites:** 3.3.

**Acceptance Criteria:**

**AC 3.4.1**
**Given** a saved workbook in the Task
**When** the user chooses "Open this saved workbook in Excel"
**Then** the actual file opens in the registered application, or a handoff failure is shown if no supported route exists; a toast alone never completes the step.

**AC 3.4.2**
**Given** the user saves an external edit and asks Inquello to continue
**When** the Task resumes
**Then** Inquello compares file version and content, lists the changed inputs, preserves unrelated changes, and either recomputes or marks the earlier result stale with the reason.

**AC 3.4.3**
**Given** the agent has a pending proposed change and the file changed externally in the same region
**When** the proposal would be applied
**Then** the conflict blocks only that write, both versions are identifiable, and the user can compare, reload or leave the proposal unapplied; no silent overwrite occurs.

**AC 3.4.4**
**Given** the external save state is uncertain (for example the application reported an error)
**When** Inquello reports
**Then** it says the save outcome is unconfirmed and asks the user to check before continuing.

**AC 3.4.5**
**Given** a Task has saved artifacts, an interrupted run or a crash/session loss
**When** it is reopened or resumed after restart
**Then** the same Task/runtime linkage and last confirmed saved artifact identities/versions remain available, current source/grant access is rechecked and uncertain/unlinked work is exposed
**And** external human edits survive; interruption lists completed versus pending work and applied effects without inventing rollback; missing artifacts and unconfirmed saves are explicit.

### Story 3.5: Work in isolated alternatives and promote deliberately

As an Internal Auditor,
I want to analyse alternatives in isolated copies of an artifact with a recorded baseline, compare results and promote selected changes while the original is preserved,
So that competing approaches never overwrite each other or shared files (FR-6, C47, C10 worktree mode).

Increment 1. Origin: old Story 4.6. Requirements/inventory: A08, AD-9, C10, C47, FR-6.

**Prerequisites:** 3.4.

**Acceptance Criteria:**

**AC 3.5.1**
**Given** a baseline workbook
**When** the user creates two isolated alternatives
**Then** each copy records its origin artifact and baseline version, works in its own location, and the baseline remains unchanged.

**AC 3.5.2**
**Given** a completed alternative
**When** the user promotes it
**Then** Inquello compares the baseline version with the existing local baseline file, potentially edited externally, applies the promotion only if unchanged or after explicit reconciliation, and records the promotion history on the artifact.

**AC 3.5.3**
**Given** concurrent edits to the existing local baseline file during the alternative's life
**When** promotion is attempted
**Then** the conflict is shown with both versions and nothing is replaced until resolved.

### Story 3.6: Generate explanatory visuals labelled distinct from evidence

As an Internal Auditor,
I want to generate or edit explanatory illustrations for reports and presentations,
So that an illustration is useful but never mistaken for captured evidence (FR-14, C23).

Increment 1. Origin: old Story 4.7. Requirements/inventory: C23, FR-14.

**Prerequisites:** 3.5.

**Acceptance Criteria:**

**AC 3.6.1**
**Given** a request for an illustration of role separation
**When** the image is generated
**Then** it is saved as an artifact labelled "explanatory visual, generated" with its prompt and version, and the thread states it is not observed evidence.

**AC 3.6.2**
**Given** generation is unavailable on the current route
**When** requested
**Then** the limit is stated and no substitute route is used silently.

### Story 3.7: Render source and artifact previews without decision authority

As an Internal Auditor,
I want to watch what the agent is doing, see its plan, its tool activity and its results with calculations, observations, suggestions, decisions and gaps told apart,
So that I can judge the work while it happens rather than after (FR-7, S02).

Increment 1. Origin: old Story 1.6. Requirements/inventory: AD-5, AD-6, C11, C12, C14, C15, C41, C76, FR-7, UX-DR13, UX-DR21, UX-DR23, UX-DR34.

**Prerequisites:** 3.6.

**Acceptance Criteria:**

**AC 3.7.1**
**Given** an artifact preview is shown beside the thread
**When** it renders
**Then** it is in a separate sandboxed context without the workbench preload or domain bridge, and nothing inside the preview can submit a human decision.

**AC 3.7.2**
**Given** no artifact exists yet
**When** the artifact region renders
**Then** "no artifact yet" is distinct from "artifact failed".

### Story 3.8: Reconcile the W1 ledger-to-bank fixture exactly

As an Internal Auditor,
I want the W1 reconciliation to produce the exact expected matches, totals and excess, and to update correctly when a saved input changes,
So that analytical reliability is demonstrated on a known result before real data (FR-11, FR-12, A03, NFR-2).

Increment 1. Origin: old Story 3.5. Requirements/inventory: A03, FR-11, FR-12, NFR-2, UJ-3, UX-DR32.

**Prerequisites:** 3.7.

**Acceptance Criteria:**

**AC 3.8.1**
**Given** the W1 ledger (five rows) and bank (six rows) inputs
**When** the reconciliation runs
**Then** rows are assigned L01 to L05 and B01 to B06 in order, equal reference/amount pairs match by ascending source ID so L03 matches B03 and B04 stays unmatched, three exact matches are reported, totals are 4,600 and 4,750, and the excess is 150
**And** all five ledger and six bank source rows are preserved in the workbook.

**AC 3.8.2**
**Given** R5 is saved as 800 in the ledger file
**When** the user asks Inquello to continue
**Then** the ledger total becomes 4,700 and the excess 50, the difference is explained against the changed input, and the duplicate B03/B04 identity remains traceable.

**AC 3.8.3**
**Given** the workbook contains named ranges, comments, formatting and an unrelated sheet
**When** the reconciliation writes results
**Then** those remain intact and no source transaction is changed.

### Story 3.9: Identify affected outputs when a Method changes; pass M1

As an Internal Audit Manager,
I want a new Method version to identify outputs produced under the old version, and a case correction to stay with its case unless deliberately promoted,
So that method evolution is controlled and reviewable (FR-20, A07).

Increment 1. Origin: old Story 7.4. Requirements/inventory: A07, AD-10, FR-20, UJ-7.

**Prerequisites:** 3.8.

**Acceptance Criteria:**

**AC 3.9.1**
**Given** procedure v1 used to draft an output, with the M1 evidence
**When** v2 is introduced
**Then** the outputs produced under v1 are listed as affected with the changed elements, approved guidance identity and loaded references are recorded, and embedded evidence instructions were treated as untrusted (the earlier applicable capability contract).

**AC 3.9.2**
**Given** a correction made on one Task
**When** the Task completes
**Then** the correction is not written into the shared Method; promoting it is a separate explicit action under the team's distribution mechanism.

### Story 3.10: Attribute artifact effort to its producing Task

As an Internal Auditor,
I want to choose effort and speed per Task, see consumption across main and delegated work, and have inherited plan or Workspace limits enforced visibly,
So that costs are attributable to deliverables and a stop is explained (FR-30, C53, OQ-5).

Increment 1. Origin: old Story 8.6. Requirements/inventory: C53, FR-30, NFR-6, OQ-5.

**Prerequisites:** 3.9.

**Acceptance Criteria:**

**AC 3.10.1**
**Given** a produced artifact
**When** its cost is inspected
**Then** tool and model consumption for the Task, including failed or repeated runs, is attributable to it (SM-3).

## Epic 4: Accessible team sharing and institutional continuity

Increment 1. 7 stories. Owner-approved group structure; detailed stories are the consolidated review proposal, not individually approved or ready-for-development statuses. Each acceptance criterion is a requirement, not executed test evidence.

### Story 4.1: Bind explicit share grants to private resources

As an Internal Auditor,
I want a deliberate file, folder, review-package or whole-Task grant,
So that I can share work without exposing my entire conversation.

Increment 1. New detail for confirmed hybrid/private-sharing/admission/revocation/agent-review decisions (RR-1 to RR-5); source scope retained. Requirements: FR-14, FR-32, FR-33, FR-35, FR-43.

**Prerequisites:** completed Epic 3 delivery and earlier required contracts; no later epic is required.

**Gate:** OQ-16A direction adopted; AD-19/20 and SC-2/3/4 define the implementation contract; OQ-16B before real-data route enablement; external-audit client/independence routes remain OQ-15 gated.

**Acceptance Criteria:**

**AC 4.1.1**
**Given** a creator-private Task and material they are authorized to share
**When** the creator chooses a share scope and permitted team audience
**Then** the grant identifies Workspace, actor, audience, object/version or declared folder scope, permissions and current revision
**And** file/folder/package shares exclude conversation/history unless separately included; whole-Task sharing is explicit; assignment or membership never silently creates that grant.

**AC 4.1.2**
**Given** a share draft
**When** the user inspects it before issuance
**Then** included content, evidence/context, recipients and omissions are visible
**And** changing scope, audience or version requires deliberate confirmation and current authority; no automatic full-source upload occurs.


**AC 4.1.3**
**Given** a folder share or individually shared package is prepared under SC-3
**When** the person confirms its audience and version scope
**Then** enumerated versions are the default, future registered-version inclusion requires explicit choice, and no filesystem watcher uploads unselected material
**And** an individual recipient grant does not admit company-wide memory and no grant exceeds delegable source rights.

### Story 4.2: Make the exact shared version usable on the recipient computer

As an Internal Audit Manager,
I want the submitted artifact and authorized supporting context to open on my computer,
So that review does not depend on a sender-local path.

Increment 1. New detail for confirmed hybrid/private-sharing/admission/revocation/agent-review decisions (RR-1 to RR-5); source scope retained. Requirements: FR-9, FR-13, FR-14, FR-43.

**Prerequisites:** 4.1.

**Gate:** OQ-16A direction adopted; AD-20 / SC-4 exact-version materialization contract applies; OQ-16B storage/processing eligibility before real shared data.

**Acceptance Criteria:**

**AC 4.2.1**
**Given** a permitted recipient on a different computer
**When** they retrieve a shared package
**Then** the exact immutable submitted version and authorized relied-on evidence/Method/departure/coverage context are actually available or explicitly blocked/partial
**And** sender-local paths alone fail the handoff; checksums/version identities and missing context are reported; the latest file cannot silently replace the submitted version.

**AC 4.2.2**
**Given** the sender shares one artifact
**When** the recipient opens it
**Then** unshared Task messages, drafts and unrelated source files are inaccessible
**And** authorized copies/materialisation are deliberate; the service is not a V1 native authoritative audit-record store.

**AC 4.2.3**
**Given** a submission/reviewer basis depends on policy
**When** the package is assembled or opened
**Then** applicable policy identities, versions and effective periods accompany evidence, Method and departures
**And** missing policy makes affected checks incomplete; changed policy marks dependent review applicability stale before reliance.


**AC 4.2.4**
**Given** upload chunks are interrupted, a hash is wrong, a blob is missing, or the commit response is lost
**When** SC-4 transfer resumes or the operation receipt is queried
**Then** only verified exact bytes become a committed accessible version, partial staging remains unpublished, and retries do not duplicate registration
**And** recipient materialization does not overwrite an existing edited local file and missing context remains component-level incomplete.

### Story 4.3: Stop revoked shared retrieval and active-agent use

As an administrator,
I want Workspace removal and share withdrawal to stop subsequent protected use,
So that revocation changes effective access rather than only the UI.

Increment 1. Origin: old Story 12.1. Requirements/inventory: A14, AD-12, AD-8, C71, FR-36, NFR-3.

**Prerequisites:** 4.2.

**Gate:** OQ-16A clarified connectivity direction adopted; AD-21 / SC-5 current-access and active-run contract applies; OQ-16B actual host/service enforcement must pass before real-data sharing.

**Acceptance Criteria:**

**AC 4.3.1**
**Given** a Workspace member is removed
**When** the former member or their active agent next retrieves, searches, recalls, resumes or uses shared content
**Then** access is denied and active execution ceases revoked use; retained outputs cannot continue leaking that content
**And** running work reports already-applied effects, purges or quarantines affected context according to the resolved contract and does not claim external rollback.

**AC 4.3.2**
**Given** a single share is withdrawn
**When** effective access is recomputed
**Then** that access route ends; another current valid grant may independently preserve access
**And** all access paths are checked rather than revoking unrelated valid grants, and downloaded/exported copies cannot be magically recalled.

**AC 4.3.3**
**Given** revocation happens during an in-flight tool or model call
**When** the pending result returns
**Then** subsequent presentation, action, recall and derived use must not consume revoked returned material; affected work stops or is rebased under the resolved OQ-16 contract
**And** already transmitted historical disclosure cannot be unsent; no invented instantaneous-delivery or latency guarantee is claimed.

**AC 4.3.4**
**Given** live admitted-memory retrieval is not yet enabled
**When** these control contracts are validated
**Then** current share/retained-category paths and synthetic derivative-lineage objects are tested now
**And** actual admitted-memory retrieval and its revocation are then exercised in later story IDs 4.5 and 4.6 (deferred live-memory regressions, not prerequisites for current control completion) before memory real-data enablement; this is not a dependency on a future live memory implementation to complete current controls.


**AC 4.3.5**
**Given** shared-derived work loses its live authority channel or receives an invalidation cursor gap
**When** SC-5 governs its next read, tool/model dispatch, output use, export or resume
**Then** affected work pauses, stale in-flight output is suppressed, and reconnect requires current authorization before resuming
**And** loss of the cloud-model connection also pauses affected private agent work; local files/tools do not imply offline inference, local models are not a current priority, and no automatic local fallback or offline editor is introduced; a runtime unable to isolate/remove revoked context terminates and requires a fresh permitted-context rebase, never relabelling the same shared-derived context as private.

### Story 4.4: Apply revocation to derived knowledge and shared held-data controls

As an administrator,
I want shared artifacts, extracts, indexes and derived memories to obey current grants and held-data policy,
So that retained summaries cannot bypass revocation.

Increment 1. Origin: old Story 12.3. Requirements/inventory: AD-13, AD-14, C75, FR-37, NFR-10, NFR-9, OQ-2, UX-DR42.

**Prerequisites:** 4.3.

**Acceptance Criteria:**

**AC 4.4.1**
**Given** a source grant changes or shared content is deleted
**When** derived extracts, embeddings, summaries, search indexes, caches and recall candidates are accessed
**Then** lineage/current-grant checks suppress or invalidate revoked content and its derivatives before disclosure
**And** derived knowledge cannot serve as a permission-free copy; uncertain lineage blocks affected recall or triggers a broader rebuild/recheck.

**AC 4.4.2**
**Given** a shared retained category is enabled
**When** its policy is inspected or exercised
**Then** access, retention, deletion, export and recovery rules cover that actual category with declared losses and audit events
**And** recovery cannot resurrect revoked grants; exports state surviving external copies; V1 controls do not claim V2 native hold/amendment authority.

**AC 4.4.3**
**Given** live admitted-memory retrieval is not yet enabled
**When** these control contracts are validated
**Then** current share/retained-category paths and synthetic derivative-lineage objects are tested now
**And** actual admitted-memory retrieval and its revocation are then exercised in later story IDs 4.5 and 4.6 (deferred live-memory regressions, not prerequisites for current control completion) before memory real-data enablement; this is not a dependency on a future live memory implementation to complete current controls.


**AC 4.4.4**
**Given** a shared derived item depends on source versions A and B and A has two independent grants
**When** one A grant is withdrawn and access to B is denied
**Then** SC-3/5 preserves the alternative A grant but withholds the combined derivation because all source dependencies must be permitted
**And** an allowed subset must be re-derived with new lineage, not obtained by relabelling the blocked item.


**AC 4.4.5**
**Given** backup metadata predates a revocation or deletion
**When** SC-6 recovery restores it
**Then** the service remains quarantined until current restrictions and blob manifests are reconciled; prior sessions are not revived and unavailable current restrictions block serving
**And** no recovery service level or V2 authoritative-record lifecycle is inferred.

### Story 4.5: Admit team knowledge without publishing private exploration

As an Internal Auditor,
I want team-wide continuity from formally issued or explicitly team-shared work,
So that different auditors can investigate prior findings without exposing private drafts.

Increment 1. Origin: old Story 9.4. Requirements/inventory: AD-10, C50, FR-27, OQ-3.

**Prerequisites:** 4.4.

**Acceptance Criteria:**

**AC 4.5.1**
**Given** work is formally issued or explicitly shared with the internal-audit company team
**When** knowledge admission is evaluated
**Then** eligible ongoing or completed work contributes automatically under applicable access, with originating engagement, auditor/source, period, status and changes retained
**And** private exploratory drafts/conversations remain excluded; a generic memory-contribution toggle is not an admission grant, and turning it on cannot publish private work.

**AC 4.5.2**
**Given** two different auditors and different engagements in the same company Workspace
**When** one asks about relevant previous findings and status
**Then** permitted admitted work from the other is retrievable with provenance, period/status/history and current grants
**And** historical similarity does not establish a current or repeat finding; current-source investigation is required. A different company Workspace is never searched; external-audit cross-client boundaries remain OQ-15 gated.

**AC 4.5.3**
**Given** memory contribution/use is disabled or a memory deleted
**When** the outcome is inspected
**Then** capture/use controls remain distinct and effective policy is visible
**And** deletion reports the affected memory without claiming historic conversations or exported copies were erased; revoked source derivatives cannot leak via recall.

**AC 4.5.4**
**Given** a work item is considered formally issued
**When** admission is evaluated
**Then** the issued state is attributable to an actual authorized issue action and preserved version/status history
**And** Task completion, agent success or a green status never establishes issue; ongoing explicitly team-shared work remains separately eligible.

**AC 4.5.5**
**Given** S08 memory controls are opened
**When** the user inspects or changes contribution and use
**Then** separate contribution/use controls expose effective policy and unavailable/denied states; recalled context is labelled recalled, distinct from evidence
**And** neither switch bypasses admission/current grants; a historical result is not current evidence.

### Story 4.6: Prove private/shared memory and revocation boundaries

As an Internal Audit Manager,
I want two-computer and two-auditor negative tests before team sharing is enabled,
So that team continuity never rests on an assumed local link or unconditional Workspace visibility.

Increment 1. Origin: old Story 2.7. Requirements/inventory: A14, C3, C65, C70, C72, NFR-3, OQ-9.

**Prerequisites:** 4.5.

**Acceptance Criteria:**

**AC 4.6.1**
**Given** two auditors in company Workspace A and a separate company Workspace B
**When** the suite shares one package, leaves another Task private, admits an ongoing team-shared finding and performs retrieval
**Then** the permitted recipient can open the exact package and recall eligible history; private Task/notes and all Workspace-B content remain undisclosed
**And** a local-path-only handoff, missing evidence and version mismatch fail or report partial, never pass.

**AC 4.6.2**
**Given** the suite removes Workspace membership or withdraws a share during active agent work
**When** retrieval, recall, cached search, derivative reuse and resumption are attempted
**Then** revoked routes fail and active use ceases; a separate valid grant is honored only when current
**And** downloaded/exported copies are explicitly outside recall guarantees; shared routes stay disabled for real data until these cases pass.

**AC 4.6.3**
**Given** a reviewer-private Task exists later
**When** the same authorization suite is extended
**Then** private reviewer notes remain invisible until human-selected issuance
**And** this extension is a requirement of Epic 5, not evidence already passed here.

**AC 4.6.4**
**Given** a tool/model request is in flight when the test revokes its source/share/Workspace authority
**When** the delayed result returns after revocation
**Then** the suite verifies no subsequent display, action, recall or derived answer uses the revoked result/context and affected work stops or safely rebases
**And** the evidence records the race and already-transmitted disclosure limit; no invented instantaneous recall or latency guarantee is tested.

### Story 4.7: Assign Task and Human Review responsibility with attribution

As an Internal Audit Manager,
I want to assign who prepares and who reviews a Task within Workspace and Engagement membership, and have each review decision record the person, scope and reviewed version,
So that responsibility is identifiable without a hard-coded hierarchy (FR-35, OQ-1, C71).

Increment 1. Origin: old Story 5.4. Requirements/inventory: AD-13, AD-6, C71, FR-35, OQ-1, UX-DR12, UX-DR42.

**Prerequisites:** 4.6.

**Acceptance Criteria:**

**AC 4.7.1**
**Given** an Engagement Task
**When** a manager assigns a preparer and a reviewer from Engagement members
**Then** assignment requires authority and an explicit grant to the necessary submitted material; both responsibilities are stored with the assigning person and time, multiple responsibilities may coexist where policy permits, and non-members cannot be assigned.

**AC 4.7.2**
**Given** a reviewer records a decision
**When** it is saved
**Then** the decision names the person, scope and reviewed artifact version, the Avatar shows the decided state only for that recorded decision, and the Task states whether the Method requires formal acceptance in the external authority (recorded as pending until confirmed there).

**AC 4.7.3**
**Given** no assignee
**When** S09 renders
**Then** "no assignee" is shown as a scoped result distinct from "no access".

## Epic 5: Agent-assisted review, revision and export

Increment 1. 14 stories. Owner-approved group structure; detailed stories are the consolidated review proposal, not individually approved or ready-for-development statuses. Each acceptance criterion is a requirement, not executed test evidence.

### Story 5.1: Open a private reviewer Task anchored to the submission

As an Internal Audit Manager,
I want my own private agent Task bound to the submitted artifact version and evidence,
So that I can investigate critically without disclosing my exploratory thoughts.

Increment 1. New detail for confirmed hybrid/private-sharing/admission/revocation/agent-review decisions (RR-1 to RR-5); source scope retained. Requirements: FR-17, FR-35, FR-43.

**Prerequisites:** completed Epic 4 delivery and earlier required contracts; no later epic is required.

**Acceptance Criteria:**

**AC 5.1.1**
**Given** a valid submitted package and reviewer assignment
**When** the reviewer starts an investigation
**Then** a reviewer-owned private Task records the immutable submitted version, sources, Method, parameters, departures and actual coverage
**And** private reviewer messages and drafts are not visible to the preparer; absent evidence or changed access blocks the affected check.

**AC 5.1.2**
**Given** the reviewer agent inspects the submission
**When** it runs tools
**Then** the submitted file is not silently mutated; calculations or proposed revisions use attributable analysis/working copies
**And** agent agreement or a reviewer role name cannot confer professional independence or human approval.

**AC 5.1.3**
**Given** a submission/reviewer basis depends on policy
**When** the package is assembled or opened
**Then** applicable policy identities, versions and effective periods accompany evidence, Method and departures
**And** missing policy makes affected checks incomplete; changed policy marks dependent review applicability stale before reliance.

### Story 5.2: Reperform the analysis and challenge its basis

As an Internal Audit Manager,
I want my agent to redo source-based computations and challenge Method, coverage and conclusions,
So that review tests the work rather than merely summarizing it.

Increment 1. New detail for confirmed hybrid/private-sharing/admission/revocation/agent-review decisions (RR-1 to RR-5); source scope retained. Requirements: FR-11, FR-12, FR-17, FR-27.

**Prerequisites:** 5.1.

**Acceptance Criteria:**

**AC 5.2.1**
**Given** a submitted workbook with source data and Method
**When** the reviewer asks for reperformance
**Then** the agent independently reruns the permitted calculations using tools and compares results, inputs, parameters, excluded/duplicate records and actual coverage
**And** it checks effective Method/period/departures, unsupported conclusions, contradictory evidence and limits; unavailable source inputs are identified, not filled from memory.

**AC 5.2.2**
**Given** admitted team history suggests a similar prior finding
**When** the reviewer compares it with current evidence
**Then** prior origin, period, status and changes remain visible and differences are investigated
**And** historical recall is a lead, not proof of repetition, and agreeing agents do not establish independence.

### Story 5.3: Request a review with evidence-anchored findings

As an Internal Audit Manager,
I want to ask for a review of a workpaper, workbook or change and receive prioritised findings anchored to cells, passages, records and evidence under the Engagement's criteria,
So that review notes land on the affected material without editing it (FR-17, C28, E01, E03).

Increment 1. Origin: old Story 5.1. Requirements/inventory: C28, E01, E03, FR-17, NFR-2, UX-DR21.

**Prerequisites:** 5.2.

**Acceptance Criteria:**

**AC 5.3.1**
**Given** a revised reconciliation workbook
**When** a review is requested
**Then** findings list an excluded account, a broken formula and an unsupported conclusion, each with cell or passage anchors, the criterion applied and the evidence or gap, and nothing in the file is changed by the review.

**AC 5.3.2**
**Given** Engagement review criteria and a one-off focus comment
**When** the review runs
**Then** the applicable criteria version and the one-off focus are shown with the findings, and unsupported findings are labelled separately from established errors.

**AC 5.3.3**
**Given** findings
**When** they are shown
**Then** significance follows the Engagement's scheme, not developer severity labels, and no finding is closed or approved by the review itself.

### Story 5.4: Let the reviewer issue only human-selected anchored notes

As an Internal Audit Manager,
I want to choose, edit and issue precise review notes from my private investigation,
So that the preparer sees actionable instructions rather than my private draft conversation.

Increment 1. New detail for confirmed hybrid/private-sharing/admission/revocation/agent-review decisions (RR-1 to RR-5); source scope retained. Requirements: FR-17, FR-35.

**Prerequisites:** 5.3.

**Acceptance Criteria:**

**AC 5.4.1**
**Given** the agent drafted review observations
**When** the human selects notes to issue
**Then** each issued note identifies submitted version, cell/range/passage/record anchor, claim, criterion, supporting evidence or gap and requested action
**And** unselected notes and private reviewer conversation stay private; issuance records human attribution and is not automatic Professional Approval.

**AC 5.4.2**
**Given** an anchor is stale or ambiguous
**When** issuance or response is attempted
**Then** the UI requires comparison/re-anchoring or identifies the unresolved scope
**And** no silent assignment to a different current version occurs.

### Story 5.5: Review evidence, choose a treatment and Keep or Revert a proposal

As an Internal Audit Manager,
I want the Review surface to show the selected evidence, the agent's explanation with claim types, treatment choices, my rationale and the affected-output changes, and to let me Keep or Revert a proposed change after a version check,
So that a local change decision is explicit and separate from professional sign-off (FR-17, UX-DR35, C30, C58).

Increment 1. Origin: old Story 5.2. Requirements/inventory: C30, C58, FR-17, UJ-4, UX-DR14, UX-DR16, UX-DR25, UX-DR35.

**Prerequisites:** 5.4.

**Acceptance Criteria:**

**AC 5.5.1**
**Given** a review item opened from Inbox
**When** S03 renders
**Then** it opens the selected evidence and version (never a fixed demo item), focuses its heading, shows observation, calculation, suggestion, decision and gap tags, offers treatment Choice options and a rationale field, and lists affected outputs as DiffLines.

**AC 5.5.2**
**Given** a treatment and rationale entered
**When** the user chooses Keep
**Then** the current artifact version is checked against the proposal's base version, the declared local change is applied only to an authorized revision working copy if unchanged; the immutable submitted version remains intact, the rationale is saved with person, scope and version, and the state is "applied locally", not Professional Approval.

**AC 5.5.3**
**Given** Revert
**When** chosen
**Then** the proposal outcome is recorded as reverted and the original remains unchanged.

**AC 5.5.4**
**Given** a save or validation failure
**When** it occurs
**Then** the entered rationale and choice are retained in the session and the failing field is identified.

**AC 5.5.5**
**Given** no review items or inaccessible items
**When** S03 opens
**Then** the two states are shown distinctly.

### Story 5.6: Maintain the reviewed basis and mark affected decisions stale

As an Internal Audit Manager,
I want every review decision to reference a reviewed-basis revision (outputs, Sources, Method and departures, policy versions) and to see decisions marked stale when any of those change,
So that a prior decision is preserved but never silently relied on after its basis moved (AD-6, AD-9, FR-17, NFR-7).

Increment 1. Origin: old Story 5.3. Requirements/inventory: AD-6, AD-9, C58, FR-17, NFR-7.

**Prerequisites:** 5.5.

**Acceptance Criteria:**

**AC 5.6.1**
**Given** a recorded review decision
**When** a relied-on Source, Analysis, Method version or policy version changes
**Then** the decision's applicability is marked stale with the changed element named, the historical decision and its attribution remain immutable, and the Task shows which outputs and approvals are affected.

**AC 5.6.2**
**Given** a stale decision
**When** the user attempts to deliver work relying on it
**Then** delivery is blocked until the applicability is resolved under the Method, and the comparison of old and new basis is available.

**AC 5.6.3**
**Given** change impact cannot be determined precisely
**When** a decision or output is reassessed
**Then** the uncertain scope is marked for broader recheck instead of falsely labelled unchanged
**And** byte-identical output is not proof that changed evidence, Method or policy leaves its basis valid.

### Story 5.7: Correct, recheck and keep closure separate; pass W2

As an Internal Auditor,
I want to apply an authorised correction, have the agent recheck the result and see that the Finding stays open until the authorised person decides,
So that a corrected artifact is never confused with a closed matter (FR-17, E04, E14, A05).

Increment 1. Origin: old Story 5.5. Requirements/inventory: A05, E04, E14, FR-17, UJ-4.

**Prerequisites:** 5.6.

**Acceptance Criteria:**

**AC 5.7.1**
**Given** the W2 workpaper (policy v1, threshold 5,000, order 7,800, approvals A before and B after)
**When** the analysis runs
**Then** it reports one prior and one later approval, preserves review metadata and evidence links, and Professional Approval remains pending until the authorised reviewer acts.

**AC 5.7.2**
**Given** policy v2 raises the threshold to 10,000
**When** reassessment is requested
**Then** the agent establishes the effective period of v2 before reassessing and reports which outputs the change affects.

**AC 5.7.3**
**Given** a correction is applied and rechecked
**When** the recheck passes
**Then** the Finding's status does not change automatically and the recheck result is attached as evidence for the human decision.

### Story 5.8: Resolve notes with the preparer agent and return a precise handoff

As an Internal Auditor,
I want my agent to help resolve issued notes and summarize exactly what changed,
So that the reviewer can recheck the changed and impacted work efficiently.

Increment 1. New detail for confirmed hybrid/private-sharing/admission/revocation/agent-review decisions (RR-1 to RR-5); source scope retained. Requirements: FR-17, FR-20, FR-43.

**Prerequisites:** 5.7.

**Acceptance Criteria:**

**AC 5.8.1**
**Given** human-issued notes reference a submitted version
**When** the preparer authorizes agent-assisted revision
**Then** the agent prepares a new version with each note’s disposition, exact changed ranges/passages, evidence/Method/parameter changes, calculation reruns and remaining disagreements
**And** the old submission and human notes remain immutable; a fix does not silently promote a case correction to a team Method.

**AC 5.8.2**
**Given** the revised package is returned
**When** the handoff is inspected
**Then** it lists old/new version identities, resolved/unresolved notes, precise changed and impacted outputs, recheck evidence, missing evidence and uncertainty
**And** unknown impact explicitly requests broader review; “unchanged” requires an evidenced basis.

### Story 5.9: Recheck the revision with the reviewer agent before human acceptance

As an Internal Audit Manager,
I want my private agent to reperform changed and impacted work against the revised package,
So that human acceptance follows a checkable revision cycle.

Increment 1. New detail for confirmed hybrid/private-sharing/admission/revocation/agent-review decisions (RR-1 to RR-5); source scope retained. Requirements: FR-17, FR-35, FR-43, FR-44.

**Prerequisites:** 5.8.

**Acceptance Criteria:**

**AC 5.9.1**
**Given** a new version and precise change-impact handoff arrive
**When** the reviewer agent rechecks
**Then** it verifies note resolution and reruns affected calculations/evidence/Method/coverage checks, widening scope where impact is uncertain
**And** checks and unresolved disagreements remain attributable; acceptance/closure still requires the authorized human under the external authoritative process.

**AC 5.9.2**
**Given** reviewer-private context and issued notes exist
**When** authorization tests inspect disclosure
**Then** only deliberately issued notes and permitted submitted material are available to the preparer/team
**And** reviewer-private drafts remain excluded from team memory unless separately eligible through explicit sharing.

### Story 5.10: Retain code, configuration and security review for IT audit

As an IT Auditor,
I want to inspect code and configuration directly, run permitted security analysis, keep saved scans, findings and history, and reassess an inherited backlog with original IDs preserved,
So that technical assurance work keeps the same evidence and review discipline (FR-18, C28, C29, C67, E10 to E13).

Increment 1. Origin: old Story 5.6. Requirements/inventory: A06, A16, AD-8, C28, C29, C67, E10, E13, FR-18.

**Prerequisites:** 5.9.

**Acceptance Criteria:**

**AC 5.10.1**
**Given** authorised application code or configuration
**When** the IT Auditor requests inspection
**Then** the agent reads it, returns findings anchored to files and lines with evidence, and the source and scripts remain accessible in S11.

**AC 5.10.2**
**Given** the W3 access-review population
**When** technical review is requested alongside it
**Then** script results and findings are available with their coverage limits and the specialist route used is named.

**AC 5.10.3**
**Given** scan and backlog features are not yet enabled
**When** the capability list renders
**Then** they are shown as not enabled with their eligibility gate, not as absent.

### Story 5.11: Export and import a reviewable package with declared losses

As an Internal Audit Manager,
I want to export a reporting or review package (artifacts, review state, evidence references, Method and departures) with declared losses, and import a package back with the same content verified,
So that the external authority receives usable work and V1 transfer limits are explicit (FR-39, FR-41 fallback, A11, E17, NFR-9).

Increment 1. Origin: old Story 13.3. Requirements/inventory: A11, AD-13, E17, FR-39, FR-41, NFR-9, OQ-6, UJ-2, UX-DR43.

**Prerequisites:** 5.10.

**Acceptance Criteria:**

**AC 5.11.1**
**Given** a reviewed package
**When** exported
**Then** S10 shows audience, included content and version, the export declares what is omitted or converted, the external Record Authority is named as holding formal acceptance, and the artifact state becomes "exported" not "delivered".

**AC 5.11.2**
**Given** an exported package
**When** reimported
**Then** the reimport reproduces the declared content, keeps artifact identities and review attribution, and reports any loss.

**AC 5.11.3**
**Given** a failed export
**When** it occurs
**Then** the package and selected audience are retained and no broader fallback is used.

**AC 5.11.4**
**Given** the exported review package is opened on a recipient computer
**When** its declared contents are verified
**Then** the actual authorized version and included supporting context are usable, with missing/omitted material and transfer losses explicit
**And** no sender-local path is presented as transferred evidence, and export alone is not confirmed receipt or formal acceptance.

### Story 5.12: Preserve Task context across editor, environment, delegation, review and resume boundaries

As an Internal Auditor,
I want sources, Method, artifacts, decisions and actual status to remain accessible when I switch editor or environment, delegate, hand to review or resume, with any unsupported transfer stating what is missing,
So that I never reconstruct the Engagement at each boundary (FR-43, A09 context part, SP6).

Increment 1. Origin: old Story 14.1. Requirements/inventory: A09, AD-6, FR-43, UX-DR53, UX-DR55.

**Prerequisites:** 5.11.

**Acceptance Criteria:**

**AC 5.12.1**
**Given** a Task continued in Excel, then reviewed in S03, then resumed next day
**When** each boundary is crossed
**Then** within a person’s continued Task its identity is retained; preparer and reviewer retain distinct private Task identities linked through the shared submission/origin and artifact version, Source references, Method and authorized issued decisions; private messages or exploratory notes are never copied across that handoff.

**AC 5.12.2**
**Given** a transfer the route does not support (for example live state to a remote host)
**When** attempted
**Then** the missing context is named and the user is offered a supported continuation; no success is simulated.

### Story 5.13: Expose the complete state model including Delivery and Professional Approval links

As an Internal Audit Manager,
I want every Task and artifact to show planned, running, blocked, interrupted, produced, checks incomplete or complete, review requested, revision requested, Professional Approval (with external authority link in V1) and attempted, confirmed or uncertain Delivery as distinct states,
So that completion claims are inspectable (FR-44, AD-6, AD-13).

Increment 1. Origin: old Story 14.2. Requirements/inventory: AD-13, AD-6, FR-44, UX-DR20, UX-DR51, UX-DR52.

**Prerequisites:** 5.12.

**Acceptance Criteria:**

**AC 5.13.1**
**Given** an artifact is exported and later-state read-model fixtures are available
**When** the current state view is checked
**Then** export is labelled exported, not delivered; synthetic published/remote-update events verify distinct attempted/confirmed/uncertain states and operation identity
**And** actual fixture, hosted and production writeback routes must exercise their real state transitions when delivered in Epics 6, 8 and 14; synthetic events do not prove an external effect.

**AC 5.13.2**
**Given** Professional Approval recorded in the external authority
**When** it is confirmed
**Then** the Task links the authority, person, scope and version; before confirmation it shows pending.

**AC 5.13.3**
**Given** the prototype anti-patterns list
**When** the UI is audited
**Then** none occurs: Stop never marks steps done, Keep never claims a saved version, toasts never claim delivery, "accepted" never represents an automated check, and no item routes to a fixed demo record.

### Story 5.14: Demonstrate the workbook-to-review-to-export engineering checkpoint

As an Internal Audit Manager,
I want a known-result end-to-end engineering checkpoint across editing, review and export,
So that component success does not hide a broken working journey.

Increment 1. Origin: old Story 14.4. Requirements/inventory: A01, A16, A18, C1, C4, FR-44, NFR-2, NFR-4, OQ-10, OQ-7, UX-DR54.

**Prerequisites:** 5.13.

**Acceptance Criteria:**

**AC 5.14.1**
**Given** synthetic W1/W2/M1 and two authorized desktop users
**When** the workflow analyzes a workbook, saves it, continues the same file in Excel, recomputes, shares a fixed package, reviews with a private agent Task, resolves notes and exports
**Then** artifact identity, source/Method basis, exact revised versions and human decision attribution survive every boundary
**And** failure, stale formula, contradictory evidence, missing context, conflict, revocation and uncertain impact produce truthful states rather than a green completion claim.

**AC 5.14.2**
**Given** interruption, conflict, revocation and uncertain current share/export/handoff cases (future remote-writeback cases are not claimed here)
**When** injected
**Then** retained work, applied effects, recovery steps and human recovery effort are recorded (SM-4, SM-C4).

**AC 5.14.3**
**Given** validation runs with the internal audit team
**When** effort data is captured
**Then** total effort through acceptance, wall time, reviewer correction burden, wrong or missed results, tool and model costs and denominators are recorded per task class without numeric thresholds (OQ-7).

## Epic 6: Full first-increment practice and delivery-contract validation

Increment 1. 5 stories. Owner-approved group structure; detailed stories are the consolidated review proposal, not individually approved or ready-for-development statuses. Each acceptance criterion is a requirement, not executed test evidence.

### Story 6.1: Plan, scope and run procedures with the practice's own terminology

As an Internal Auditor,
I want to plan and scope an Engagement, define procedures and record results using my Method's terms (assertions and materiality for external audit, options for advisory, technical assets for IT audit) without a mandatory control or deficiency object,
So that each practice works its own way on one workbench (FR-39, A02, E15, C78).

Increment 1. Origin: old Story 13.1. Requirements/inventory: A02, C78, E15, FR-39, UJ-2, UJ-6.

**Prerequisites:** completed Epic 5 delivery and earlier required contracts; no later epic is required.

**Acceptance Criteria:**

**AC 6.1.1**
**Given** an external-audit Engagement
**When** procedures are planned
**Then** the plan expresses objective, population, procedure, criteria, expected output and outstanding evidence using assertions and materiality supplied by the Method, and no control or deficiency fields are required.

**AC 6.1.2**
**Given** an advisory Task
**When** options are developed
**Then** facts, assumptions and recommendations are distinguishable, management responsibilities and assumptions per option are stated, and no deficiency workflow is imposed.

**AC 6.1.3**
**Given** a plan generated by the agent
**When** shown
**Then** it is labelled a proposed plan, not an authorised work programme.

### Story 6.2: Track evidence requests and receipt and prepare stakeholder communications

As an Internal Auditor,
I want to record evidence requests, receipt and gaps against procedures, and draft stakeholder communications in the team's approved tools with exact content and recipient shown before sending,
So that Coverage of evidence is visible and no message leaves without authority (FR-39, UJ-2 step 2, UX-DR47).

Increment 1. Origin: old Story 13.2. Requirements/inventory: AD-11, FR-39, UJ-2, UX-DR47.

**Prerequisites:** 6.1.

**Acceptance Criteria:**

**AC 6.2.1**
**Given** procedures with required evidence
**When** evidence is requested and received
**Then** each item shows requested, received, missing or inaccessible with source and version, and the Task's Coverage reflects only received items.

**AC 6.2.2**
**Given** a drafted request to a stakeholder
**When** prepared
**Then** the exact content and named recipient are shown; sending requires the configured permission and the draft is otherwise exported to the approved tool.

### Story 6.3: Inspect, authorise and verify a bounded external update against a fixture destination; pass W3

As an Internal Audit Manager,
I want to see the destination, current record version, exact proposed field changes and supporting evidence, authorise the update, and verify the resulting state by read-back, with stale and uncertain outcomes sent to reconciliation,
So that remote updates are bounded, verified and never blindly retried (FR-41, A10, W3, AD-11).

Increment 1. Origin: old Story 13.4. Requirements/inventory: A10, AD-11, FR-41, UJ-8, UX-DR24, UX-DR51.

**Prerequisites:** 6.2.

**Acceptance Criteria:**

**AC 6.3.1**
**Given** the W3 approved finding and a fixture destination
**When** the update is proposed
**Then** the ApprovalCard shows destination identity, record and version, the approved fields with before/after values, and the evidence; unrelated fields are listed as untouched.

**AC 6.3.2**
**Given** the destination record changed after review
**When** the update is attempted
**Then** the version check fails, the proposal returns to review with a comparison, and nothing is written.

**AC 6.3.3**
**Given** the response is lost after a possible success
**When** the operation is reconciled
**Then** the read-back using the operation identity determines confirmed or uncertain state before any retry is offered.

**AC 6.3.4**
**Given** revoked credentials
**When** the update runs
**Then** it fails with the identity named and no partial write occurs.

**AC 6.3.5**
**Given** the destination lacks conditional update or deduplication
**When** configured
**Then** the limit is declared in its Capability Contract and the reconciliation path is required.

### Story 6.4: Handle responses, actions and retests without agent closure

As an Internal Audit Manager,
I want management responses, agreed actions, completion evidence and retest results recorded against Findings with the closure decision reserved for the authorised person,
So that remediation is traced and an agent run never closes a Finding (FR-39, E14, UJ-8 steps 5 to 6).

Increment 1. Origin: old Story 13.5. Requirements/inventory: AD-13, E14, FR-39, UJ-8, UX-DR51.

**Prerequisites:** 6.3.

**Acceptance Criteria:**

**AC 6.4.1**
**Given** a Finding with an agreed action
**When** retest evidence is added by a Task
**Then** the retest result is attached with evidence and Coverage, the Finding status is unchanged, and the closure control names the authorised person and Method basis.

**AC 6.4.2**
**Given** a corrected artifact
**When** displayed
**Then** it is distinguished from an operating control proven effective.

### Story 6.5: Complete first-increment fixture validation and deferral accounting

As an Internal Audit Manager,
I want an automated harness that runs W1, W2, W3 (fixture destination) and M1 and the applicable A01 to A18 scenarios for enabled routes, records results, and maintains a ledger of deferred requirements as unmet acceptance,
So that validation evidence is repeatable and deferrals are never silently dropped (FR-44, OQ-10, A16, A18 inputs).

Increment 1. Origin: old Story 14.4. Requirements/inventory: A01, A16, A18, C1, C4, FR-44, NFR-2, NFR-4, OQ-10, OQ-7, UX-DR54.

**Prerequisites:** 6.4.

**Acceptance Criteria:**

**AC 6.5.1**
**Given** the harness
**When** run
**Then** W1 reconciles exactly (the earlier applicable capability contract), W2 reports approval timing and preserves metadata (the earlier applicable capability contract), W3 preserves seven accounts and reconciles the fixture update (the earlier applicable capability contract), M1 separates guidance from evidence (the earlier applicable capability contract), and each result is stored with the route and versions used.

**AC 6.5.2**
**Given** interruption, conflict, revocation and uncertain-delivery cases
**When** injected
**Then** retained work, applied effects, recovery steps and human recovery effort are recorded (SM-4, SM-C4).

**AC 6.5.3**
**Given** the deferral ledger
**When** published
**Then** every story marked Increment 2 or V2 appears with its unmet acceptance IDs, and no deferral is counted as demonstrated parity.

**AC 6.5.4**
**Given** validation runs with the internal audit team
**When** effort data is captured
**Then** total effort through acceptance, wall time, reviewer correction burden, wrong or missed results, tool and model costs and denominators are recorded per task class without numeric thresholds (OQ-7).

**AC 6.5.5**
**Given** the workbook engineering checkpoint succeeded
**When** the team chooses validation tasks
**Then** all originally retained first-increment Word/PowerPoint/CSV/research/practice workflows remain eligible and their applicable fixtures are run
**And** the engineering checkpoint neither selects the owner’s validation workload nor proves full V1/V2 or production adapter readiness.

## Epic 7: Local browser and demonstration capabilities

Increment 2 / V1. 5 stories. Owner-approved group structure; detailed stories are the consolidated review proposal, not individually approved or ready-for-development statuses. Each acceptance criterion is a requirement, not executed test evidence.

### Story 7.1: Inspect pages in the local built-in browser profile

As an Internal Auditor,
I want the agent to open and inspect public pages and local tools in a separate local browser profile,
So that observations carry source location and time while no signed-in account is implied (FR-16, C25, OQ-13).

Increment 2 (V1). Origin: old Story 6.2. Requirements/inventory: AD-8, C25, FR-16, OQ-13.

**Prerequisites:** completed Epic 6 delivery and earlier required contracts; no later epic is required.

**Acceptance Criteria:**

**AC 7.1.1**
**Given** a browser task
**When** the agent inspects a page
**Then** the observation records URL, time and the acting profile, and the Task shows that the browser route is local.

**AC 7.1.2**
**Given** a page requiring a signed-in session
**When** encountered
**Then** the agent reports the unavailable context rather than guessing or using another profile.

### Story 7.2: Anchor questions to selected page content and site-exposed tools

As an Internal Auditor,
I want to select a passage in a supported browser surface or use a site's exposed tools with the page identity preserved,
So that a question or action is tied to the exact material and permission boundary (FR-10, FR-16, C26, E20).

Increment 2 (V1). Origin: old Story 6.3. Requirements/inventory: A16, C26, E20, FR-10, FR-16, UX-DR45.

**Prerequisites:** 7.1.

**Acceptance Criteria:**

**AC 7.2.1**
**Given** a selected clause in an online procedure
**When** sent to the Task
**Then** the selection, its page identity and available metadata are attached as context, distinguishable from the user's instruction.

**AC 7.2.2**
**Given** a site exposes tools
**When** the agent uses one
**Then** the page/source identity and permission boundary are recorded, changed state is verified, and tool disappearance on navigation is reported.

### Story 7.3: Operate supported applications with Computer Use under the acting identity

As an IT Auditor,
I want the agent to observe or operate a permitted application in a test environment with each action's account, destination and outcome identified,
So that a visible session never becomes blanket authority (FR-16, C25 Computer Use).

Increment 2 (V1). Origin: old Story 6.4. Requirements/inventory: AD-11, C25, FR-16, OQ-13.

**Prerequisites:** 7.2.

**Acceptance Criteria:**

**AC 7.3.1**
**Given** an authorised vendor-onboarding test workflow
**When** the agent operates it
**Then** each step records the application, acting account, the action and the observed outcome, and consequential steps require the ApprovalCard.

**AC 7.3.2**
**Given** an uncertain action outcome
**When** reported
**Then** it is marked uncertain and the user is asked to verify before any retry.

**AC 7.3.3**
**Given** the platform's foreground or lock conditions
**When** Computer Use runs
**Then** the limit is disclosed and the Capability Contract records platform-specific conditions.

### Story 7.4: Teach a routine by demonstration where eligible

As an Internal Auditor,
I want to demonstrate a repeatable routine and get an inspectable draft skill that I refine and validate on a second case before reuse,
So that demonstrated routines become reusable without hidden assumptions (FR-19, C38).

Increment 2 (V1). Origin: old Story 7.5. Requirements/inventory: A16, C38, FR-19.

**Prerequisites:** 7.3.

**Gate:** Demonstration-to-skill requires verified host/platform eligibility and the now-supplied Computer Use route; reference behavior is macOS-specific, not a promise for every desktop.

**Acceptance Criteria:**

**AC 7.4.1**
**Given** a recorded demonstration
**When** the draft skill is generated
**Then** its steps, inputs and verification guidance are inspectable and the captured assumptions are listed for review.

**AC 7.4.2**
**Given** replay on a second representative case
**When** it runs
**Then** replay exceptions are reported and the skill is marked validated only after the user accepts the second-case result.

### Story 7.5: Complete browser-context and page-origin trust checks

As an Internal Auditor,
I want browser annotations to retain page/source identity and capture freshness,
So that a selected page passage never masquerades as a fresh saved file.

Increment 2 (V1). Origin: old Story 3.3. Requirements/inventory: A16, AD-9, C24, C26, C27, FR-10.

**Prerequisites:** 7.4.

**Acceptance Criteria:**

**AC 7.5.1**
**Given** a supported local browser selection
**When** it is sent into the Task
**Then** page identity, selected passage, capture time and available version metadata are retained
**And** stale or missing context is explicit; malicious page instructions stay data; site-tool authorization and outcomes use the earlier action contracts.

## Epic 8: Additional environments and hosted outputs

Increment 2 / V1. 3 stories. Owner-approved group structure; detailed stories are the consolidated review proposal, not individually approved or ready-for-development statuses. Each acceptance criterion is a requirement, not executed test evidence.

### Story 8.1: Enable approved remote/cloud execution without confusing collaboration hosting

As an IT Auditor,
I want to select an approved environment for a Task and see where execution happens separately from where model processing happens,
So that a local window is never taken as proof of local inference (FR-5, NFR-8, C10, C07).

Increment 2 (V1). Origin: old Story 4.5. Requirements/inventory: A15, AD-8, C07, C10, FR-5, NFR-8, UX-DR40.

**Prerequisites:** completed Epic 7 delivery and earlier required contracts; no later epic is required.

**Gate:** Name and prove remote execution service, identity, context transfer, mutation ownership, policy eligibility and recovery before enabling this route. The shared collaboration service is not evidence of hosted execution.

**Acceptance Criteria:**

**AC 8.1.1**
**Given** an approved remote/cloud route has resolved its supply contract
**When** a Task selects it
**Then** execution location, inference location, transferred context/version and authority are separately visible
**And** unavailable or unsupported transfer fails without silent relocation or success; no automatic source upload occurs.

**AC 8.1.2**
**Given** an environment becomes unavailable
**When** the user starts work
**Then** the failure names the environment and the Task is not silently moved elsewhere.

### Story 8.2: Isolate versioned text alternatives with Git worktrees

As an Internal Auditor,
I want to analyse alternatives in isolated copies of an artifact with a recorded baseline, compare results and promote selected changes while the original is preserved,
So that competing approaches never overwrite each other or shared files (FR-6, C47, C10 worktree mode).

Increment 2 (V1). Origin: old Story 4.6. Requirements/inventory: A08, AD-9, C10, C47, FR-6.

**Prerequisites:** 8.1.

**Acceptance Criteria:**

**AC 8.2.1**
**Given** versioned text material with an identified repository baseline
**When** an isolated alternative is created and promoted
**Then** the upstream worktree mechanism retains origin and isolates writes; promotion checks current baseline and conflicts
**And** all original artifact-copy protections remain, and repository authority is separate from source-system authority.

### Story 8.3: Prepare published or hosted outputs under audience and destination authority

As an Internal Audit Manager,
I want to build a reviewable exception dashboard or small tool, inspect its data, audience and destination, and publish only through an authorised route with the outcome verified,
So that generation, publication and verified delivery stay distinguishable (FR-14, C32, E16 writeups).

Increment 2 (V1). Origin: old Story 4.8. Requirements/inventory: A16, AD-11, C32, E16, FR-14, UX-DR43.

**Prerequisites:** 8.2.

**Acceptance Criteria:**

**AC 8.3.1**
**Given** a dashboard draft built from an Analysis
**When** it is reviewed
**Then** it shows source period, calculation definitions and evidence links, and is marked generated until published.

**AC 8.3.2**
**Given** a publish request
**When** the ApprovalCard shows audience, included content and destination
**Then** publication proceeds only through the configured route, the resulting state is read back, and the artifact state becomes published or uncertain accordingly; a broader fallback audience is never used to make publication succeed.

## Epic 9: Extended routes, tools and specialist capabilities

Increment 2 / V1. 14 stories. Owner-approved group structure; detailed stories are the consolidated review proposal, not individually approved or ready-for-development statuses. Each acceptance criterion is a requirement, not executed test evidence.

### Story 9.1: Supply client tools bound to the current artifact

As an IT Auditor,
I want the workbench to expose task-specific tools (for example fetch the selected sample's evidence references) bound to the current artifact and Engagement,
So that bounded operations run under host authority on the right material (FR-22, C42, C41).

Increment 2 (V1). Origin: old Story 8.4. Requirements/inventory: A16, C41, C42, FR-22.

**Prerequisites:** completed Epic 8 delivery and earlier required contracts; no later epic is required.

**Gate:** Dynamic-tools API is experimental; verify host-side enforcement and eligible runtime/host versions before enabling.

**Acceptance Criteria:**

**AC 9.1.1**
**Given** a workpaper view exposing a tool
**When** the agent calls it
**Then** the host validates the arguments against the current artifact/entity identity, returns a structured result or error, and rejects identifiers outside the Task's scope.

### Story 9.2: Supply and verify the ChatGPT/OpenAI subscription sign-in route

As an administrator,
I want the ChatGPT/OpenAI subscription sign-in route supplied and verified independently,
So that one provider’s eligibility never stands in for another’s.

Increment 2 (V1). Origin: old Story 8.5. Requirements/inventory: A15, AD-8, C53, C57, FR-29, NFR-8, NFR-9, OQ-14, OQ-9, UX-DR40.

**Prerequisites:** Story 1.13, Story 1.19, Story 1.22, Story 1.28 and the applicable earlier capability contracts; no other new provider route is a prerequisite.

**Gate:** Resolve this named route’s concrete adapter/supply and eligibility before implementation/enablement; preserve provider credentials outside model context. No vendor deployment, region, spend or compatibility is inferred.

**Acceptance Criteria:**

**AC 9.2.1**
**Given** the ChatGPT/OpenAI subscription sign-in route is in scope and its concrete supply/adapter choice is authorized
**When** the adapter is implemented or an already enabled initial adapter is regression-tested
**Then** the actual route establishes credential handling, supported model/tool/protocol operations, configuration and observable errors under its declared contract
**And** initially enabled routes require regression rather than duplicate implementation; an absent adapter is explicit implementation work, never assumed present.

**AC 9.2.2**
**Given** a configured route
**When** a Task uses it
**Then** S07 and the Task show provider, deployment or endpoint identity, region where applicable, and the capabilities available on that route, with execution, inference and connector data flows listed separately.

**AC 9.2.3**
**Given** an operation the route does not support
**When** requested
**Then** the request fails with the limit named and no other route is used.

**AC 9.2.4**
**Given** provider credentials
**When** configured
**Then** they are supplied outside prompts and artifacts (the earlier applicable capability contract) and the route's eligibility status (not verified / verified for synthetic / verified for real data) is recorded in its Capability Contract.

**AC 9.2.5**
**Given** a remaining route is proposed for enablement
**When** its adapters and capability tests run
**Then** its identity, processing, allowed features, version limits and negative authority evidence are recorded separately
**And** one passing route never certifies another; unsupported image/browser/tool features fail without silent substitution.

### Story 9.3: Supply and verify the OpenAI API-key route

As an administrator,
I want the OpenAI API-key route supplied and verified independently,
So that one provider’s eligibility never stands in for another’s.

Increment 2 (V1). Origin: old Story 8.5. Requirements/inventory: A15, AD-8, C53, C57, FR-29, NFR-8, NFR-9, OQ-14, OQ-9, UX-DR40.

**Prerequisites:** Story 1.13, Story 1.19, Story 1.22, Story 1.28 and the applicable earlier capability contracts; no other new provider route is a prerequisite.

**Gate:** Resolve this named route’s concrete adapter/supply and eligibility before implementation/enablement; preserve provider credentials outside model context. No vendor deployment, region, spend or compatibility is inferred.

**Acceptance Criteria:**

**AC 9.3.1**
**Given** the OpenAI API-key route is in scope and its concrete supply/adapter choice is authorized
**When** the adapter is implemented or an already enabled initial adapter is regression-tested
**Then** the actual route establishes credential handling, supported model/tool/protocol operations, configuration and observable errors under its declared contract
**And** initially enabled routes require regression rather than duplicate implementation; an absent adapter is explicit implementation work, never assumed present.

**AC 9.3.2**
**Given** a configured route
**When** a Task uses it
**Then** S07 and the Task show provider, deployment or endpoint identity, region where applicable, and the capabilities available on that route, with execution, inference and connector data flows listed separately.

**AC 9.3.3**
**Given** an operation the route does not support
**When** requested
**Then** the request fails with the limit named and no other route is used.

**AC 9.3.4**
**Given** provider credentials
**When** configured
**Then** they are supplied outside prompts and artifacts (the earlier applicable capability contract) and the route's eligibility status (not verified / verified for synthetic / verified for real data) is recorded in its Capability Contract.

**AC 9.3.5**
**Given** a remaining route is proposed for enablement
**When** its adapters and capability tests run
**Then** its identity, processing, allowed features, version limits and negative authority evidence are recorded separately
**And** one passing route never certifies another; unsupported image/browser/tool features fail without silent substitution.

### Story 9.4: Supply and verify the Azure Foundry route

As an administrator,
I want the Azure Foundry route supplied and verified independently,
So that one provider’s eligibility never stands in for another’s.

Increment 2 (V1). Origin: old Story 8.5. Requirements/inventory: A15, AD-8, C53, C57, FR-29, NFR-8, NFR-9, OQ-14, OQ-9, UX-DR40.

**Prerequisites:** Story 1.13, Story 1.19, Story 1.22, Story 1.28 and the applicable earlier capability contracts; no other new provider route is a prerequisite.

**Gate:** Resolve this named route’s concrete adapter/supply and eligibility before implementation/enablement; preserve provider credentials outside model context. No vendor deployment, region, spend or compatibility is inferred.

**Acceptance Criteria:**

**AC 9.4.1**
**Given** the Azure Foundry route is in scope and its concrete supply/adapter choice is authorized
**When** the adapter is implemented or an already enabled initial adapter is regression-tested
**Then** the actual route establishes credential handling, supported model/tool/protocol operations, configuration and observable errors under its declared contract
**And** initially enabled routes require regression rather than duplicate implementation; an absent adapter is explicit implementation work, never assumed present.

**AC 9.4.2**
**Given** a configured route
**When** a Task uses it
**Then** S07 and the Task show provider, deployment or endpoint identity, region where applicable, and the capabilities available on that route, with execution, inference and connector data flows listed separately.

**AC 9.4.3**
**Given** an operation the route does not support
**When** requested
**Then** the request fails with the limit named and no other route is used.

**AC 9.4.4**
**Given** provider credentials
**When** configured
**Then** they are supplied outside prompts and artifacts (the earlier applicable capability contract) and the route's eligibility status (not verified / verified for synthetic / verified for real data) is recorded in its Capability Contract.

**AC 9.4.5**
**Given** a remaining route is proposed for enablement
**When** its adapters and capability tests run
**Then** its identity, processing, allowed features, version limits and negative authority evidence are recorded separately
**And** one passing route never certifies another; unsupported image/browser/tool features fail without silent substitution.

### Story 9.5: Supply and verify the Azure OpenAI route

As an administrator,
I want the Azure OpenAI route supplied and verified independently,
So that one provider’s eligibility never stands in for another’s.

Increment 2 (V1). Origin: old Story 8.5. Requirements/inventory: A15, AD-8, C53, C57, FR-29, NFR-8, NFR-9, OQ-14, OQ-9, UX-DR40.

**Prerequisites:** Story 1.13, Story 1.19, Story 1.22, Story 1.28 and the applicable earlier capability contracts; no other new provider route is a prerequisite.

**Gate:** Resolve this named route’s concrete adapter/supply and eligibility before implementation/enablement; preserve provider credentials outside model context. No vendor deployment, region, spend or compatibility is inferred.

**Acceptance Criteria:**

**AC 9.5.1**
**Given** the Azure OpenAI route is in scope and its concrete supply/adapter choice is authorized
**When** the adapter is implemented or an already enabled initial adapter is regression-tested
**Then** the actual route establishes credential handling, supported model/tool/protocol operations, configuration and observable errors under its declared contract
**And** initially enabled routes require regression rather than duplicate implementation; an absent adapter is explicit implementation work, never assumed present.

**AC 9.5.2**
**Given** a configured route
**When** a Task uses it
**Then** S07 and the Task show provider, deployment or endpoint identity, region where applicable, and the capabilities available on that route, with execution, inference and connector data flows listed separately.

**AC 9.5.3**
**Given** an operation the route does not support
**When** requested
**Then** the request fails with the limit named and no other route is used.

**AC 9.5.4**
**Given** provider credentials
**When** configured
**Then** they are supplied outside prompts and artifacts (the earlier applicable capability contract) and the route's eligibility status (not verified / verified for synthetic / verified for real data) is recorded in its Capability Contract.

**AC 9.5.5**
**Given** a remaining route is proposed for enablement
**When** its adapters and capability tests run
**Then** its identity, processing, allowed features, version limits and negative authority evidence are recorded separately
**And** one passing route never certifies another; unsupported image/browser/tool features fail without silent substitution.

### Story 9.6: Supply and verify the Amazon Bedrock route

As an administrator,
I want the Amazon Bedrock route supplied and verified independently,
So that one provider’s eligibility never stands in for another’s.

Increment 2 (V1). Origin: old Story 8.5. Requirements/inventory: A15, AD-8, C53, C57, FR-29, NFR-8, NFR-9, OQ-14, OQ-9, UX-DR40.

**Prerequisites:** Story 1.13, Story 1.19, Story 1.22, Story 1.28 and the applicable earlier capability contracts; no other new provider route is a prerequisite.

**Gate:** Resolve this named route’s concrete adapter/supply and eligibility before implementation/enablement; preserve provider credentials outside model context. No vendor deployment, region, spend or compatibility is inferred.

**Acceptance Criteria:**

**AC 9.6.1**
**Given** the Amazon Bedrock route is in scope and its concrete supply/adapter choice is authorized
**When** the adapter is implemented or an already enabled initial adapter is regression-tested
**Then** the actual route establishes credential handling, supported model/tool/protocol operations, configuration and observable errors under its declared contract
**And** initially enabled routes require regression rather than duplicate implementation; an absent adapter is explicit implementation work, never assumed present.

**AC 9.6.2**
**Given** a configured route
**When** a Task uses it
**Then** S07 and the Task show provider, deployment or endpoint identity, region where applicable, and the capabilities available on that route, with execution, inference and connector data flows listed separately.

**AC 9.6.3**
**Given** an operation the route does not support
**When** requested
**Then** the request fails with the limit named and no other route is used.

**AC 9.6.4**
**Given** provider credentials
**When** configured
**Then** they are supplied outside prompts and artifacts (the earlier applicable capability contract) and the route's eligibility status (not verified / verified for synthetic / verified for real data) is recorded in its Capability Contract.

**AC 9.6.5**
**Given** a remaining route is proposed for enablement
**When** its adapters and capability tests run
**Then** its identity, processing, allowed features, version limits and negative authority evidence are recorded separately
**And** one passing route never certifies another; unsupported image/browser/tool features fail without silent substitution.

### Story 9.7: Supply and verify the GCP/Vertex route

As an administrator,
I want the GCP/Vertex route supplied and verified independently,
So that one provider’s eligibility never stands in for another’s.

Increment 2 (V1). Origin: old Story 8.5. Requirements/inventory: A15, AD-8, C53, C57, FR-29, NFR-8, NFR-9, OQ-14, OQ-9, UX-DR40.

**Prerequisites:** Story 1.13, Story 1.19, Story 1.22, Story 1.28 and the applicable earlier capability contracts; no other new provider route is a prerequisite.

**Gate:** Resolve this named route’s concrete adapter/supply and eligibility before implementation/enablement; preserve provider credentials outside model context. No vendor deployment, region, spend or compatibility is inferred.

**Acceptance Criteria:**

**AC 9.7.1**
**Given** the GCP/Vertex route is in scope and its concrete supply/adapter choice is authorized
**When** the adapter is implemented or an already enabled initial adapter is regression-tested
**Then** the actual route establishes credential handling, supported model/tool/protocol operations, configuration and observable errors under its declared contract
**And** initially enabled routes require regression rather than duplicate implementation; an absent adapter is explicit implementation work, never assumed present.

**AC 9.7.2**
**Given** a configured route
**When** a Task uses it
**Then** S07 and the Task show provider, deployment or endpoint identity, region where applicable, and the capabilities available on that route, with execution, inference and connector data flows listed separately.

**AC 9.7.3**
**Given** an operation the route does not support
**When** requested
**Then** the request fails with the limit named and no other route is used.

**AC 9.7.4**
**Given** provider credentials
**When** configured
**Then** they are supplied outside prompts and artifacts (the earlier applicable capability contract) and the route's eligibility status (not verified / verified for synthetic / verified for real data) is recorded in its Capability Contract.

**AC 9.7.5**
**Given** a remaining route is proposed for enablement
**When** its adapters and capability tests run
**Then** its identity, processing, allowed features, version limits and negative authority evidence are recorded separately
**And** one passing route never certifies another; unsupported image/browser/tool features fail without silent substitution.

### Story 9.8: Supply and verify the organisation gateway route

As an administrator,
I want the organisation gateway route supplied and verified independently,
So that one provider’s eligibility never stands in for another’s.

Increment 2 (V1). Origin: old Story 8.5. Requirements/inventory: A15, AD-8, C53, C57, FR-29, NFR-8, NFR-9, OQ-14, OQ-9, UX-DR40.

**Prerequisites:** Story 1.13, Story 1.19, Story 1.22, Story 1.28 and the applicable earlier capability contracts; no other new provider route is a prerequisite.

**Gate:** Resolve this named route’s concrete adapter/supply and eligibility before implementation/enablement; preserve provider credentials outside model context. No vendor deployment, region, spend or compatibility is inferred.

**Acceptance Criteria:**

**AC 9.8.1**
**Given** the organisation gateway route is in scope and its concrete supply/adapter choice is authorized
**When** the adapter is implemented or an already enabled initial adapter is regression-tested
**Then** the actual route establishes credential handling, supported model/tool/protocol operations, configuration and observable errors under its declared contract
**And** initially enabled routes require regression rather than duplicate implementation; an absent adapter is explicit implementation work, never assumed present.

**AC 9.8.2**
**Given** a configured route
**When** a Task uses it
**Then** S07 and the Task show provider, deployment or endpoint identity, region where applicable, and the capabilities available on that route, with execution, inference and connector data flows listed separately.

**AC 9.8.3**
**Given** an operation the route does not support
**When** requested
**Then** the request fails with the limit named and no other route is used.

**AC 9.8.4**
**Given** provider credentials
**When** configured
**Then** they are supplied outside prompts and artifacts (the earlier applicable capability contract) and the route's eligibility status (not verified / verified for synthetic / verified for real data) is recorded in its Capability Contract.

**AC 9.8.5**
**Given** a remaining route is proposed for enablement
**When** its adapters and capability tests run
**Then** its identity, processing, allowed features, version limits and negative authority evidence are recorded separately
**And** one passing route never certifies another; unsupported image/browser/tool features fail without silent substitution.

### Story 9.9: Supply and verify the local model route

As an administrator,
I want the local model route supplied and verified independently,
So that one provider’s eligibility never stands in for another’s.

Increment 2 (V1). Origin: old Story 8.5. Requirements/inventory: A15, AD-8, C53, C57, FR-29, NFR-8, NFR-9, OQ-14, OQ-9, UX-DR40.

**Prerequisites:** Story 1.13, Story 1.19, Story 1.22, Story 1.28 and the applicable earlier capability contracts; no other new provider route is a prerequisite.

**Gate:** Resolve this named route’s concrete adapter/supply and eligibility before implementation/enablement; preserve provider credentials outside model context. No vendor deployment, region, spend or compatibility is inferred.

**Acceptance Criteria:**

**AC 9.9.1**
**Given** the local model route is in scope and its concrete supply/adapter choice is authorized
**When** the adapter is implemented or an already enabled initial adapter is regression-tested
**Then** the actual route establishes credential handling, supported model/tool/protocol operations, configuration and observable errors under its declared contract
**And** initially enabled routes require regression rather than duplicate implementation; an absent adapter is explicit implementation work, never assumed present.

**AC 9.9.2**
**Given** a configured route
**When** a Task uses it
**Then** S07 and the Task show provider, deployment or endpoint identity, region where applicable, and the capabilities available on that route, with execution, inference and connector data flows listed separately.

**AC 9.9.3**
**Given** an operation the route does not support
**When** requested
**Then** the request fails with the limit named and no other route is used.

**AC 9.9.4**
**Given** provider credentials
**When** configured
**Then** they are supplied outside prompts and artifacts (the earlier applicable capability contract) and the route's eligibility status (not verified / verified for synthetic / verified for real data) is recorded in its Capability Contract.

**AC 9.9.5**
**Given** a remaining route is proposed for enablement
**When** its adapters and capability tests run
**Then** its identity, processing, allowed features, version limits and negative authority evidence are recorded separately
**And** one passing route never certifies another; unsupported image/browser/tool features fail without silent substitution.

### Story 9.10: Extend and verify the selected and conditionally permitted Claude routes

As an administrator,
I want the Claude (supply/adapter unresolved) route supplied and verified independently,
So that one provider’s eligibility never stands in for another’s.

Increment 2 (V1). Origin: old Story 8.5. Requirements/inventory: A15, AD-8, C53, C57, FR-29, NFR-8, NFR-9, OQ-14, OQ-9, UX-DR40.

**Prerequisites:** Story 1.13, Story 1.19, Story 1.22, Story 1.28 and the applicable earlier capability contracts; no other new provider route is a prerequisite.

**Gate:** Claude API-key route preference is selected; implement/regress the recorded CR-1 adapter contract and verify actual eligibility rather than asking for provider selection again. Regress an initial adapter already delivered in 1.22, then extend later capabilities. Subscription integration stays conditional per AD-23/Claude companion and must not bypass native-flow/credential restrictions or silently replace the Codex harness. No deployment, region, spending or implementation is inferred.

**Acceptance Criteria:**

**AC 9.10.1**
**Given** the Claude (supply/adapter unresolved) route is in scope and its concrete supply/adapter choice is authorized
**When** the adapter is implemented or an already enabled initial adapter is regression-tested
**Then** the actual route establishes credential handling, supported model/tool/protocol operations, configuration and observable errors under its declared contract
**And** initially enabled routes require regression rather than duplicate implementation; an absent adapter is explicit implementation work, never assumed present.

**AC 9.10.2**
**Given** a configured route
**When** a Task uses it
**Then** S07 and the Task show provider, deployment or endpoint identity, region where applicable, and the capabilities available on that route, with execution, inference and connector data flows listed separately.

**AC 9.10.3**
**Given** an operation the route does not support
**When** requested
**Then** the request fails with the limit named and no other route is used.

**AC 9.10.4**
**Given** provider credentials
**When** configured
**Then** they are supplied outside prompts and artifacts (the earlier applicable capability contract) and the route's eligibility status (not verified / verified for synthetic / verified for real data) is recorded in its Capability Contract.

**AC 9.10.5**
**Given** a remaining route is proposed for enablement
**When** its adapters and capability tests run
**Then** its identity, processing, allowed features, version limits and negative authority evidence are recorded separately
**And** one passing route never certifies another; unsupported image/browser/tool features fail without silent substitution.

### Story 9.11: Inspect prompts and specialist-model eligibility where permitted

As an administrator,
I want eligible prompt inspection and specialist cyber access to have explicit policy and route limits,
So that later specialist capabilities are delivered without weakening authority.

Increment 2 (V1). Origin: old Story 2.5. Requirements/inventory: A15, AD-8, C67, C68, C70, FR-33, UX-DR40.

**Prerequisites:** Story 1.18, Story 1.19 and an eligible independently supplied specialist route; no future provider story is assumed.

**Acceptance Criteria:**

**AC 9.11.1**
**Given** prompt inspection or specialist cyber access is configured on an eligible client/route
**When** a permitted user invokes it
**Then** the supported inspection or specialist capability operates with current policy, identity and visibility limits, and the Capability Contract records its tested scope
**And** unsupported or ineligible access stays blocked with the reason; no private prompt/credential or different client’s context is exposed.

### Story 9.12: Offer eligible composer predictions without changing instructions

As an Internal Auditor,
I want supported composer suggestions that I can inspect and choose,
So that convenience does not silently change the request.

Increment 2 (V1). Origin: old Story 3.3. Requirements/inventory: A16, AD-9, C24, C26, C27, FR-10.

**Prerequisites:** Story 2.3 and an eligible supported client; no future story is required.

**Gate:** Composer prediction is eligibility-limited beta; declare the actual supported client and verify its scope before enabling.

**Acceptance Criteria:**

**AC 9.12.1**
**Given** composer prediction is supported and eligible on this client
**When** suggestions appear
**Then** the user can accept, edit or ignore them before submission, with no automatic send or authority change
**And** unsupported clients show not enabled and retain typed text; prediction is not proof of source freshness.

### Story 9.13: Compose tool work programmatically with preserved provenance

As an IT Auditor,
I want eligible Code Mode programmatic composition with per-call provenance and failures,
So that composition does not hide inputs, authority or partial execution.

Increment 2 (V1). Origin: old Story 3.4. Requirements/inventory: AD-9, C19, C20, C33, FR-11, NFR-2, UX-DR44.

**Prerequisites:** Story 2.5, Story 1.19 and Story 9.1 host enforcement.

**Gate:** Experimental feature is off by default until host enforcement and eligibility are verified.

**Acceptance Criteria:**

**AC 9.13.1**
**Given** Code Mode is explicitly enabled on an eligible route
**When** a composed program calls permitted tools
**Then** each call preserves Task/actor/source identity, input/version/parameters, returned results and policy checks
**And** a failed or partial composed call is inspectable; derived results are recomputed or stale when inputs change, and no composed function bypasses approval.

### Story 9.14: Retain security scans, findings and inherited backlog

As an IT Auditor,
I want eligible scan workbench, change/bulk scans and backlog reassessment with original IDs,
So that technical assurance retains its actual specialist workflows.

Increment 2 (V1). Origin: old Story 5.6. Requirements/inventory: A06, A16, AD-8, C28, C29, C67, E10, E13, FR-18.

**Prerequisites:** Story 5.10, Story 9.11 and supplied eligible scan services.

**Acceptance Criteria:**

**AC 9.14.1**
**Given** an authorized code/configuration population and eligible scan service
**When** change or bulk scans run and backlog findings are reassessed
**Then** saved scans/findings/history retain original IDs, source/script references, tested coverage, status and uncertainty
**And** no absent scan or specialist model is simulated; a reassessment never grants human acceptance or closes an audit Finding automatically.

## Epic 10: Delegation, branching and longer continuity

Increment 2 / V1. 5 stories. Owner-approved group structure; detailed stories are the consolidated review proposal, not individually approved or ready-for-development statuses. Each acceptance criterion is a requirement, not executed test evidence.

### Story 10.1: Delegate bounded work to focused agents and consolidate with disagreements visible

As an IT Auditor,
I want to delegate population analysis, criteria research, evidence inspection or workpaper review to separate agents, follow their progress, and get a consolidated result that shows sources, disagreements and unexamined scope,
So that parallel work is traceable and an agent review never looks like a human decision (FR-25, C45, A08).

Increment 2 (V1). Origin: old Story 9.1. Requirements/inventory: A08, AD-7, C45, FR-25, UJ-5.

**Prerequisites:** completed Epic 9 delivery and earlier required contracts; no later epic is required.

**Acceptance Criteria:**

**AC 10.1.1**
**Given** three delegated agents checking approvals, recalculating interest and reviewing notifications
**When** they complete
**Then** each result carries its scope, source references and Method, the consolidation lists agreements, disagreements and gaps explicitly, and no count of agreeing agents is presented as corroboration.

**AC 10.1.2**
**Given** two agents propose writes to the same artifact
**When** they finish
**Then** writes are coordinated through the domain or isolated into alternatives; no silent merge occurs.

**AC 10.1.3**
**Given** an agent named "reviewer"
**When** its output is shown
**Then** it is labelled as agent output and cannot be recorded as a Human Review decision.

### Story 10.2: Explore side chats, forks and references without losing origin

As an Internal Auditor,
I want to open a side investigation or fork an alternative interpretation from the current context and bring a conclusion back with its branch reference, seeing which conclusion was adopted or superseded,
So that alternatives never masquerade as the accepted result (FR-26, C46, C13 fork).

Increment 2 (V1). Origin: old Story 9.2. Requirements/inventory: AD-6, C13, C46, FR-26, UX-DR41.

**Prerequisites:** 10.1.

**Acceptance Criteria:**

**AC 10.2.1**
**Given** a Task
**When** the user forks it
**Then** the fork records its origin Task, thread and version, keeps the parent unchanged, and S08 shows both with their relation.

**AC 10.2.2**
**Given** a conclusion adopted from a fork
**When** it is referenced in the parent
**Then** the reference names the branch and the adopted or superseded status is shown; rejoining never overwrites another agent's or person's changes.

**AC 10.2.3**
**Given** a failed merge or promotion
**When** it occurs
**Then** the original branch context is preserved.

### Story 10.3: Compact and resume long work with durable references

As an Internal Auditor,
I want long Tasks to compact earlier history while evidence identifiers, criteria references and material decisions stay in durable artifacts, and resumption to state missing context or changed access,
So that a multi-day analysis continues without silently reusing superseded evidence (FR-27, C48, C49, A09).

Increment 2 (V1). Origin: old Story 9.3. Requirements/inventory: A09, AD-8, C48, C49, FR-27, UX-DR41.

**Prerequisites:** 10.2.

**Acceptance Criteria:**

**AC 10.3.1**
**Given** a Task near its context limit
**When** compaction runs
**Then** the continuation state lists objective, completed work and next steps, and evidence identifiers and decisions are reopened from their durable records rather than the summary.

**AC 10.3.2**
**Given** a resumed Task whose Source access changed
**When** resumption runs
**Then** the changed access and any missing context are stated before work continues, and cancellation history never claims external rollback.

### Story 10.4: Control permitted application and site activity recall

As an Internal Auditor,
I want optional recall of my recent application and site activity scoped to allowed apps, with capture controls, original references and explicit gaps,
So that I can find what I examined earlier without ambient summaries standing in for evidence (FR-28, C51).

Increment 2 (V1). Origin: old Story 9.5. Requirements/inventory: A16, AD-10, C51, FR-28.

**Prerequisites:** 10.3.

**Gate:** Activity recall requires declared supported apps and verified host eligibility; reference is macOS-specific, not permission for ambient capture everywhere.

**Acceptance Criteria:**

**AC 10.4.1**
**Given** activity recall enabled for selected apps
**When** the user asks what they examined before revising a workpaper
**Then** the answer is labelled activity-derived, links to the original file, and excludes apps and sites outside the allowed set.

**AC 10.4.2**
**Given** recall disabled or paused
**When** asked
**Then** nothing is claimed as captured for that period.

### Story 10.5: Carry current grants, revocation and cost through delegated work

As an administrator,
I want delegated agents to stop revoked use and retain attributable costs,
So that delegation cannot evade the controls already enforced on private and shared Tasks.

Increment 2 (V1). Origin: old Story 12.1. Requirements/inventory: A14, AD-12, AD-8, C71, FR-36, NFR-3.

**Prerequisites:** 10.4.

**Acceptance Criteria:**

**AC 10.5.1**
**Given** a delegated agent holds scoped context
**When** a source/share/Workspace grant is revoked
**Then** subsequent retrieval, resumed context and returned derived output are checked and revoked use ceases
**And** consolidation cannot leak revoked material; already applied effects remain reported and main/child usage including failures is attributable to the parent artifact.

## Epic 11: Secondary clients, convenience and snapshot sharing

Increment 2 / V1. 8 stories. Owner-approved group structure; detailed stories are the consolidated review proposal, not individually approved or ready-for-development statuses. Each acceptance criterion is a requirement, not executed test evidence.

### Story 11.1: Continue the same Task from the CLI with audit-labelled session controls

As an IT Auditor,
I want the CLI to open, resume, fork, plan, review, change model effort and inspect the same Tasks as the desktop with audit-friendly labels and power-user commands retained,
So that technical practitioners get the same work and authority through a terminal (FR-3, FR-4, C03, C04).

Increment 2 (V1). Origin: old Story 11.1. Requirements/inventory: A16, AD-4, C03, C04, FR-3, FR-4, UX-DR50.

**Prerequisites:** completed Epic 10 delivery and earlier required contracts; no later epic is required.

**Acceptance Criteria:**

**AC 11.1.1**
**Given** a Task created on the desktop
**When** resumed in the CLI
**Then** it is the same Task identity with the same effective authority, structured output semantics are preserved, and no decorative shell is reproduced in text.

**AC 11.1.2**
**Given** an experimental remote or cloud command
**When** listed
**Then** its maturity label is shown and unavailable commands are reported rather than simulated.

### Story 11.2: Assist beside an open workbook or document with stated context scope

As an Internal Auditor,
I want contextual assistance inside a supported host application that maps my selection to a stable range, paragraph or slide reference and states whether context is saved or live,
So that the agent and I never work from different versions (FR-3, FR-4, C06).

Increment 2 (V1). Origin: old Story 11.2. Requirements/inventory: A16, AD-9, C06, FR-3, FR-4, UX-DR45, UX-DR50.

**Prerequisites:** 11.1.

**Acceptance Criteria:**

**AC 11.2.1**
**Given** a selected exceptions table in a supported Excel integration
**When** the user asks a question
**Then** the Task receives the range reference, file identity, version and "live" or "saved" scope, and proposed changes are inspectable before application.

**AC 11.2.2**
**Given** no supported integration
**When** the user tries
**Then** the saved-file route (the earlier applicable capability contract) is offered instead of a simulated live link.

### Story 11.3: Steer and review work from a mobile or remote client

As an Internal Audit Manager,
I want to inspect, steer, interrupt and continue a Task from a supported remote device with concise findings and accessible evidence,
So that I can direct work away from the desk with the same authority and clear capability limits (FR-3, C08).

Increment 2 (V1). Origin: old Story 11.3. Requirements/inventory: A16, AD-7, C08, FR-3, UX-DR50.

**Prerequisites:** 11.2.

**Acceptance Criteria:**

**AC 11.3.1**
**Given** a connected execution host
**When** the remote client opens a Task
**Then** it shows the same Task identity, status and authority, supports inspect/steer/interrupt/continue with touch and keyboard semantics, and names unavailable actions with a permitted continuation path.

**AC 11.3.2**
**Given** a disconnected remote control
**When** the user acts
**Then** the action is reported as not delivered, never as executed.

### Story 11.4: Bind optional physical controls to named Tasks and actions

As an Internal Auditor,
I want optional physical controls bound to named Tasks and actions with status indication,
So that a shortcut stays understandable when several Engagements are active (FR-4, C09).

Increment 2 (V1). Origin: old Story 11.4. Requirements/inventory: A16, C09, FR-4.

**Prerequisites:** 11.3.

**Acceptance Criteria:**

**AC 11.4.1**
**Given** bindings configured
**When** a key is pressed
**Then** the bound Task or action is named before any consequential effect, and a physical "approve" never records Professional Approval.

### Story 11.5: Dictate instructions with a correctable transcript

As an Internal Auditor,
I want voice input with explicit recording, transcribing and reviewable-text states, and confirmation of ambiguous amounts, dates and entity names before consequential use,
So that a misheard identifier never redirects testing (FR-31, C60).

Increment 2 (V1). Origin: old Story 11.5. Requirements/inventory: A16, C60, FR-31, UX-DR45.

**Prerequisites:** 11.4.

**Acceptance Criteria:**

**AC 11.5.1**
**Given** voice capture
**When** the user speaks an instruction
**Then** the states recording, transcribing and reviewable text are shown, the text is editable before sending, and an ambiguous amount or name prompts confirmation.

### Story 11.6: Notify attention needs and offer an optional companion

As an Internal Auditor,
I want notifications that separate completed analysis, detected exception, missing evidence and review needed, and an optional floating companion that mirrors Task state without exposing client names,
So that I return to the exact item needing me (FR-31, C61, C62).

Increment 2 (V1). Origin: old Story 11.6. Requirements/inventory: C61, C62, FR-31, UX-DR13, UX-DR45.

**Prerequisites:** 11.5.

**Acceptance Criteria:**

**AC 11.6.1**
**Given** a Task event
**When** a notification is sent
**Then** it names the category (attention needed versus completed) and links to the Task; a "done" indicator never states assurance.

**AC 11.6.2**
**Given** the companion enabled
**When** shown above another application
**Then** it reflects the same Task state, uses discreet labels, and its absence leaves all state reachable in S02.

### Story 11.7: Import setup and recent history with declared losses

As an Internal Auditor,
I want to import instructions, skills, agent definitions and recent Tasks from another agent tool with each imported item, its scope and transfer limits reported,
So that conventions carry over without silently mixing client context or credentials (FR-32, C63).

Increment 2 (V1). Origin: old Story 11.7. Requirements/inventory: AD-8, C63, FR-32, NFR-9.

**Prerequisites:** 11.6.

**Acceptance Criteria:**

**AC 11.7.1**
**Given** an import
**When** it completes
**Then** the inventory lists imported, skipped and attention items with Engagement/client scope, and connections require reauthorisation rather than copied credentials.

**AC 11.7.2**
**Given** imported memories or instructions
**When** listed
**Then** their source and scope are shown and Record Authority is unchanged.

### Story 11.8: Share a read-only conversation snapshot to a selected audience

As an Internal Audit Manager,
I want to share a fixed snapshot of an investigation with a permitted audience, see what evidence and execution detail the snapshot omits, and revoke the link,
So that a snapshot informs review without standing in for the evidence package (FR-32, C64, A14 sharing part).

Increment 2 (V1). Origin: old Story 11.8. Requirements/inventory: A14, C64, FR-32, OQ-1, UX-DR43.

**Prerequisites:** 11.7.

**Acceptance Criteria:**

**AC 11.8.1**
**Given** a Task
**When** a snapshot is prepared
**Then** the preview shows included content, the selected audience within the team model, and an explicit list of omitted evidence and tool details; sensitive items can be excluded before sharing.

**AC 11.8.2**
**Given** a shared link
**When** revoked
**Then** access ends and the revocation is recorded.

## Epic 12: Bounded unattended and service-triggered work

Increment 2 / V1. 8 stories. Owner-approved group structure; detailed stories are the consolidated review proposal, not individually approved or ready-for-development statuses. Each acceptance criterion is a requirement, not executed test evidence.

### Story 12.1: Run a procedure non-interactively with structured, versioned results

As an IT Auditor,
I want to run a saved audit procedure from the CLI or SDK without a foreground session and receive machine-readable progress, Coverage, errors and completion under a declared result schema version,
So that repeatable jobs feed other tools without bypassing policy (FR-23, C03, C43, E19, E18).

Increment 2 (V1). Origin: old Story 10.1. Requirements/inventory: A16, AD-4, C03, C43, E18, E19, FR-23, NFR-6.

**Prerequisites:** completed Epic 11 delivery and earlier required contracts; no later epic is required.

**Acceptance Criteria:**

**AC 12.1.1**
**Given** a saved access-review procedure
**When** run via `codex exec`-style non-interactive execution against an approved export
**Then** the stream and final result carry Task identity, procedure version, input versions, progress, examined Coverage, errors and completion state under a versioned schema, and an exceptions file is produced.

**AC 12.1.2**
**Given** a bulk run across several entities
**When** one entity fails
**Then** the result reports missing or failed entities separately from successes and supports resuming the campaign.

**AC 12.1.3**
**Given** a programmatic caller
**When** it requests an action outside policy
**Then** the same sandbox, permission and approval rules apply as in the desktop.

### Story 12.2: Bind service identities before unattended enablement

As an administrator,
I want unattended runs to execute under an identifiable workflow owner or service identity with expiry and revocation,
So that findings remain attributable when the reader differs from the executing principal (C57, FR-23, FR-24).

Increment 2 (V1). Origin: old Story 10.2. Requirements/inventory: AD-12, C57, FR-23, FR-24, OQ-14.

**Prerequisites:** 12.1.

**Acceptance Criteria:**

**AC 12.2.1**
**Given** an unattended route is being configured but is not yet enabled
**When** its acting identity is bound
**Then** workflow owner, Inquello service identity, source identity, expiry and initiating event contract are inspectable
**And** synthetic invocation verifies expired/revoked identities cannot execute; no schedule is needed to complete this identity contract.

**AC 12.2.2**
**Given** the service credential expires or is revoked
**When** a synthetic due-run request is evaluated against the identity contract
**Then** the run does not execute as a departed or expired identity and the failure is visible in current CLI/domain status; S04 must expose the same failure when the automation surface arrives.

### Story 12.3: Revoke unattended credentials without assuming seat removal is enough

As an administrator,
I want owned unattended credentials to be explicitly revoked or transferred,
So that a departed person cannot leave executable automation behind.

Increment 2 (V1). Origin: old Story 12.1. Requirements/inventory: A14, AD-12, AD-8, C71, FR-36, NFR-3.

**Prerequisites:** 12.2.

**Acceptance Criteria:**

**AC 12.3.1**
**Given** automation credentials owned by the revoked person
**When** the seat is removed
**Then** owned tokens are listed for revocation or transfer; removing the seat alone does not count as revoking them.

### Story 12.4: Reassign work, reviews and unattended jobs on departure

As an administrator,
I want to reassign Tasks, review responsibilities and unattended jobs when someone changes role or leaves, with orphaned jobs surfaced,
So that work and jobs always have a known responsible person (FR-36, C71, A14).

Increment 2 (V1). Origin: old Story 12.2. Requirements/inventory: A14, AD-12, C71, FR-36, UX-DR42.

**Prerequisites:** 12.3.

**Acceptance Criteria:**

**AC 12.4.1**
**Given** a departing member and draft or enabled work/review/job responsibilities
**When** S09 lists reassignment options
**Then** Tasks, reviews, jobs and retained material are shown and can be reassigned only under current memberships/grants
**And** no access is implicitly granted or material erased; a draft mandate can be reassigned before automation is enabled.

**AC 12.4.2**
**Given** an orphaned job
**When** detected
**Then** it is flagged, does not run as the departed user, and awaits reassignment under policy.

**AC 12.4.3**
**Given** only a draft job-responsibility record exists under the prior service-identity contract
**When** a departure/reassignment is tested before scheduler enablement
**Then** its owner, acting service identity, scope and unresolved status are inspected and reassigned under current grants
**And** this is a domain contract test with no active scheduler or due-run promise; live orphaned-job regression is mandatory when the actual schedule/event route arrives.

### Story 12.5: Configure schedule and event mandates in Automations

As an Internal Audit Manager,
I want to configure a schedule or supported business event with trigger, inputs, Method, acting identity, limits, destination and escalation, see its effective enablement and ownership, and have each run bound to an immutable mandate revision,
So that automated work is bounded and changes never silently rebind running work (FR-24, C59, C44, E02, E05, AD-12).

Increment 2 (V1). Origin: old Story 10.3. Requirements/inventory: A13, AD-12, C44, C59, E02, E05, FR-24, UX-DR15, UX-DR36.

**Prerequisites:** 12.4.

**Acceptance Criteria:**

**AC 12.5.1**
**Given** S04
**When** the user creates an automation
**Then** the mandate stores trigger, input scope, Method version, acting identity, limits, destination and escalation, the Switch shows effective enablement only after confirmation, and "New automation" persists real state.

**AC 12.5.2**
**Given** a mandate change while a run is in progress
**When** saved
**Then** the change applies prospectively; the running work keeps its mandate revision unless a trusted explicit rebind records authority and impact checks.

**AC 12.5.3**
**Given** the schedule is disabled
**When** a run is in progress
**Then** future eligibility ends and the running work is handled separately and visibly.

**AC 12.5.4**
**Given** no production scheduler route is proven
**When** this story is attempted
**Then** it remains blocked by its supply gate and the Capability Contract states schedules are not enabled.

### Story 12.6: Report run outcomes and prevent duplicate effects

As an Internal Audit Manager,
I want each run to show received/not received, not run, running, incomplete, failed and completed-with-no-reported-exceptions, with population and Coverage, and duplicate events to be deduplicated,
So that a quiet monitor never hides a missed week (FR-24, A13, E09).

Increment 2 (V1). Origin: old Story 10.4. Requirements/inventory: A13, AD-11, AD-12, E09, FR-24, NFR-10, UX-DR47.

**Prerequisites:** 12.5.

**Acceptance Criteria:**

**AC 12.6.1**
**Given** a Monday vendor-master comparison
**When** the computer was unavailable
**Then** the run shows "not run" with the reason, distinct from "no exceptions reported".

**AC 12.6.2**
**Given** the same event delivered twice
**When** processed
**Then** the second delivery is recognised by event identity and no repeated effect occurs; the duplicate is recorded.

**AC 12.6.3**
**Given** a completed run
**When** displayed
**Then** the message reads "Run completed; no exceptions reported in the examined population" with period, source version and Coverage, and the run never carries a human-decision appearance.

### Story 12.7: Receive Tasks and change-triggered reviews from connected services

As an Internal Audit Manager,
I want a permitted mention, ticket transition or configured service event to create or continue a scoped Task and return findings to the originating item,
So that review work starts where it is requested, with the requester and audience preserved (C44, E06 to E09, FR-24).

Increment 2 (V1). Origin: old Story 10.5. Requirements/inventory: A16, AD-11, C44, E06, E09, FR-24.

**Prerequisites:** 12.6.

**Acceptance Criteria:**

**AC 12.7.1**
**Given** a configured adapter
**When** a qualifying event arrives
**Then** a Task is created with the originating item identity, requester, Engagement resolved explicitly when ambiguous, and accessible evidence recorded; why the item matched is logged.

**AC 12.7.2**
**Given** results are returned to the originating item
**When** posted
**Then** the audience of that item is distinguished from access to full evidence and consequential outgoing messages pass the ApprovalCard.

### Story 12.8: Verify revocation and duplicate-effect safety for unattended routes

As an Internal Audit Manager,
I want actual scheduled/event routes to pass their current authority and effect tests,
So that earlier desktop tests are not mistaken for unattended proof.

Increment 2 (V1). Origin: old Story 2.7. Requirements/inventory: A14, C3, C65, C70, C72, NFR-3, OQ-9.

**Prerequisites:** 12.7.

**Acceptance Criteria:**

**AC 12.8.1**
**Given** an actual supplied schedule/event adapter
**When** removal, credential expiry, source revocation, duplicate events and uncertain outcomes are injected
**Then** unauthorized runs fail, active work ceases revoked use, duplicates cannot blindly repeat effects and outcomes are reconciled
**And** no route receives real data solely because desktop or fixture tests passed; missing/not received/not run/no-exceptions states remain distinct.

## Epic 13: Extended administration and operational reporting

Increment 2 / V1. 2 stories. Owner-approved group structure; detailed stories are the consolidated review proposal, not individually approved or ready-for-development statuses. Each acceptance criterion is a requirement, not executed test evidence.

### Story 13.1: Extend retained-material policy to all remaining enabled categories

As an administrator,
I want working files/history, evidence references and retained extracts, logs and telemetry governed by separate access, retention, deletion, export and recovery policy, distinct from the external authoritative record,
So that Inquello-held material is governed without pretending to be the audit record (FR-37, C75, OQ-2).

Increment 2 (V1). Origin: old Story 12.3. Requirements/inventory: AD-13, AD-14, C75, FR-37, NFR-10, NFR-9, OQ-2, UX-DR42.

**Prerequisites:** completed Epic 12 delivery and earlier required contracts; no later epic is required.

**Acceptance Criteria:**

**AC 13.1.1**
**Given** S09
**When** policy is inspected
**Then** each category (working files/history, evidence references and relied-on extracts, logs/telemetry, backups, unattended work) shows its own retention, deletion, export and recovery rules.

**AC 13.1.2**
**Given** an export of a Task's retained material
**When** produced
**Then** it declares included items and losses, respects access, and reimport reproduces the declared content.

**AC 13.1.3**
**Given** a deletion
**When** executed
**Then** the result states what was removed and what remains (for example exported files or external records), never claiming erasure beyond the held categories.

### Story 13.2: Report usage and compliance events separately from accepted work

As an Internal Audit Manager,
I want adoption and operational analytics that state which data source supports each figure and never present task or token counts as accepted work or Coverage,
So that monitoring the tool is not confused with assurance (FR-37, C74, NFR-10).

Increment 2 (V1). Origin: old Story 12.4. Requirements/inventory: AD-14, C74, FR-37, NFR-10, OQ-5.

**Prerequisites:** 13.1.

**Acceptance Criteria:**

**AC 13.2.1**
**Given** a usage report
**When** rendered
**Then** task volume, completed tests, exceptions and accepted work are separate series with their sources named, and token usage is shown apart from them.

## Epic 14: Named external-record delivery

Increment 2 / V1. 1 stories. Owner-approved group structure; detailed stories are the consolidated review proposal, not individually approved or ready-for-development statuses. Each acceptance criterion is a requirement, not executed test evidence.

### Story 14.1: Deliver to a named external audit-record destination

As an Internal Audit Manager,
I want the bounded-update contract connected to the team's actual audit-record system with its read/write, conditional-update, concurrency and verification behaviour declared,
So that real deliveries follow the verified contract (FR-41, E17).

Increment 2 (V1). Origin: old Story 13.6. Requirements/inventory: A10, AD-11, AD-14, E17, FR-41, OQ-6.

**Prerequisites:** completed Epic 13 delivery and earlier required contracts; no later epic is required.

**Acceptance Criteria:**

**AC 14.1.1**
**Given** a named destination adapter
**When** certified
**Then** its Capability Contract declares identity, supported operations, conditional-update and deduplication support, stale-state behaviour and the read-back path, and the earlier applicable capability contract's scenarios pass against it before real data.

## Epic 15: Cross-surface integration acceptance

Increment 2 / V1. 4 stories. Owner-approved group structure; detailed stories are the consolidated review proposal, not individually approved or ready-for-development statuses. Each acceptance criterion is a requirement, not executed test evidence.

### Story 15.1: Verify continuity across all enabled surfaces and delegation

As an Internal Auditor,
I want sources, Method, artifacts, decisions and actual status to remain accessible when I switch editor or environment, delegate, hand to review or resume, with any unsupported transfer stating what is missing,
So that I never reconstruct the Engagement at each boundary (FR-43, A09 context part, SP6).

Increment 2 (V1). Origin: old Story 14.1. Requirements/inventory: A09, AD-6, FR-43, UX-DR53, UX-DR55.

**Prerequisites:** completed Epic 14 delivery and earlier required contracts; no later epic is required.

**Acceptance Criteria:**

**AC 15.1.1**
**Given** a Task continued in Excel, then reviewed in S03, then resumed next day
**When** each boundary is crossed
**Then** within a person’s continued Task its identity is retained; preparer and reviewer retain distinct private Task identities linked through the shared submission/origin and artifact version, Source references, Method and authorized issued decisions; private messages or exploratory notes are never copied across that handoff.

**AC 15.1.2**
**Given** a transfer the route does not support (for example live state to a remote host)
**When** attempted
**Then** the missing context is named and the user is offered a supported continuation; no success is simulated.

### Story 15.2: Verify truthful state and approval meanings across every enabled route

As an Internal Audit Manager,
I want every Task and artifact to show planned, running, blocked, interrupted, produced, checks incomplete or complete, review requested, revision requested, Professional Approval (with external authority link in V1) and attempted, confirmed or uncertain Delivery as distinct states,
So that completion claims are inspectable (FR-44, AD-6, AD-13).

Increment 2 (V1). Origin: old Story 14.2. Requirements/inventory: AD-13, AD-6, FR-44, UX-DR20, UX-DR51, UX-DR52.

**Prerequisites:** 15.1.

**Acceptance Criteria:**

**AC 15.2.1**
**Given** the state model
**When** an artifact is exported, published or updated remotely
**Then** Delivery shows attempted, confirmed or uncertain with operation identity, separate from review and approval states.

**AC 15.2.2**
**Given** Professional Approval recorded in the external authority
**When** it is confirmed
**Then** the Task links the authority, person, scope and version; before confirmation it shows pending.

**AC 15.2.3**
**Given** the prototype anti-patterns list
**When** the UI is audited
**Then** none occurs: Stop never marks steps done, Keep never claims a saved version, toasts never claim delivery, "accepted" never represents an automated check, and no item routes to a fixed demo record.

### Story 15.3: Reconcile the complete Capability Contract register

As an Internal Audit Manager,
I want a maintained register where each enabled capability and route declares its owner, implementation or service supply, identity, processing and source limits, versions, supported formats and features, and its capability-specific acceptance evidence,
So that scope and readiness claims rest on recorded evidence (FR-44, AD-14).

Increment 2 (V1). Origin: old Story 14.3. Requirements/inventory: AD-14, FR-44, NFR-9, OQ-9.

**Prerequisites:** 15.2.

**Acceptance Criteria:**

**AC 15.3.1**
**Given** the register
**When** a capability is enabled
**Then** its entry exists with owner, supply, limits, versions, eligibility status and linked test evidence, and S07 shows the user-facing parts.

**AC 15.3.2**
**Given** a capability with no entry or failed evidence
**When** a user attempts to rely on it
**Then** it is shown as not enabled with its gate.

**AC 15.3.3**
**Given** the mapped inventory
**When** the register is reviewed
**Then** each C and E entry maps to an enabled capability, a planned story or a recorded deferral.

### Story 15.4: Run full-V1 integration evidence and preserve remaining V2 deferrals

As an Internal Audit Manager,
I want an automated harness that runs W1, W2, W3 (fixture destination) and M1 and the applicable A01 to A18 scenarios for enabled routes, records results, and maintains a ledger of deferred requirements as unmet acceptance,
So that validation evidence is repeatable and deferrals are never silently dropped (FR-44, OQ-10, A16, A18 inputs).

Increment 2 (V1). Origin: old Story 14.4. Requirements/inventory: A01, A16, A18, C1, C4, FR-44, NFR-2, NFR-4, OQ-10, OQ-7, UX-DR54.

**Prerequisites:** 15.3.

**Acceptance Criteria:**

**AC 15.4.1**
**Given** the harness
**When** run
**Then** W1 reconciles exactly (the earlier applicable capability contract), W2 reports approval timing and preserves metadata (the earlier applicable capability contract), W3 preserves seven accounts and reconciles the fixture update (the earlier applicable capability contract), M1 separates guidance from evidence (the earlier applicable capability contract), and each result is stored with the route and versions used.

**AC 15.4.2**
**Given** interruption, conflict, revocation and uncertain-delivery cases
**When** injected
**Then** retained work, applied effects, recovery steps and human recovery effort are recorded (SM-4, SM-C4).

**AC 15.4.3**
**Given** the deferral ledger
**When** published
**Then** every story marked Increment 2 or V2 appears with its unmet acceptance IDs, and no deferral is counted as demonstrated parity.

**AC 15.4.4**
**Given** validation runs with the internal audit team
**When** effort data is captured
**Then** total effort through acceptance, wall time, reviewer correction burden, wrong or missed results, tool and model costs and denominators are recorded per task class without numeric thresholds (OQ-7).

## Epic 16: Native records and deliberate migration

V2. 4 stories. Owner-approved group structure; detailed stories are the consolidated review proposal, not individually approved or ready-for-development statuses. Each acceptance criterion is a requirement, not executed test evidence.

### Story 16.1: Select the permitted record mode at Organisation or Workspace level

As an administrator,
I want to select external-record or native-record mode within organisation policy, with Tasks and Engagements unable to change authority on their own,
So that record authority is a deliberate configuration (FR-42, A11 V2 part).

V2. Origin: old Story 15.1. Requirements/inventory: A11, FR-42, OQ-11.

**Prerequisites:** completed Epic 15 delivery and earlier required contracts; no later epic is required.

**Gate:** OQ-11 native record precedence, lifecycle and migration policy before implementation commitments. This is V2, not a V1 gate.

**Acceptance Criteria:**

**AC 16.1.1**
**Given** organisation policy permitting Workspace selection
**When** a Workspace selects native mode
**Then** the mode is shown consistently on every Task and Engagement, and no Task or Engagement setting can switch it.

### Story 16.2: Link practice workflows to native records with attributed approvals

As an Internal Audit Manager,
I want procedures, Sources, workpapers, Findings, decisions, Responses, Actions and Retests held as native records whose identities and relationships survive revision, with Professional Approval naming person, scope and version,
So that the same journeys run through native records (FR-40, A12).

V2. Origin: old Story 15.3. Requirements/inventory: A12, FR-40, OQ-11.

**Prerequisites:** 16.1.

**Gate:** OQ-11 native record precedence, lifecycle and migration policy before implementation commitments. This is V2, not a V1 gate.

**Acceptance Criteria:**

**AC 16.2.1**
**Given** a native Finding revised after approval
**When** amended
**Then** the affected prior approval is identified and cannot be silently retained.

**AC 16.2.2**
**Given** native record policy OQ-11 is resolved
**When** native practice work is created, revised and reviewed
**Then** Engagements, procedures, Sources, workpapers, Findings, decisions, Responses, Actions and Retests have stable identities and permitted relationships that survive revision
**And** Professional Approval records the authorized human, scope and reviewed version; task/agent completion cannot manufacture approval or replace policy-defined authority.

### Story 16.3: Govern native records with retention, hold, deletion, amendment and recovery

As an administrator,
I want native records to follow configured retention, hold and deletion rules, controlled amendment and recovery that preserves relationships and history or declares limitations,
So that native authority meets its record obligations (FR-38, A12).

V2. Origin: old Story 15.4. Requirements/inventory: A12, FR-38, OQ-11.

**Prerequisites:** 16.2.

**Gate:** OQ-11 native record precedence, lifecycle and migration policy before implementation commitments. This is V2, not a V1 gate.

**Acceptance Criteria:**

**AC 16.3.1**
**Given** a hold conflicting with a deletion rule
**When** evaluated
**Then** the configured policy decides and the conflict is visible; recovery restores records with history or reports what could not be restored.

**AC 16.3.2**
**Given** an authorized native-record recovery is requested under resolved lifecycle policy
**When** the recovered record set is verified
**Then** records, relationships, amendment/approval history and relevant policy state are restored consistently or exact losses/limitations are reported
**And** retention/deletion/hold conflicts follow the configured OQ-11 policy; no new lifecycle precedence is invented in this story.

### Story 16.4: Migrate records to native mode with an identified destination and verified results

As an administrator,
I want a deliberate migration into native records that identifies transferred records, artifacts, relationships, history and declared losses and verifies the result,
So that authority moves only when the migration contract is met (FR-42, SP7).

V2. Origin: old Story 15.2. Requirements/inventory: FR-42, OQ-11.

**Prerequisites:** 16.3.

**Gate:** OQ-11 native record precedence, lifecycle and migration policy before implementation commitments. This is V2, not a V1 gate.

**Acceptance Criteria:**

**AC 16.4.1**
**Given** a migration
**When** completed
**Then** a verified report lists transferred items and losses, partial failure leaves existing authority in place, and operational source systems remain separate.

## Epic 17: Hosted browser/sandbox decision revisit

V2. 1 stories. Owner-approved group structure; detailed stories are the consolidated review proposal, not individually approved or ready-for-development statuses. Each acceptance criterion is a requirement, not executed test evidence.

### Story 17.1: Revisit a hosted agent browser or sandbox

As an IT Auditor,
I want the hosted browser and hosted sandbox options reconsidered once native mode and hosting are decided,
So that the V1 local-only decision is revisited rather than forgotten (OQ-13).

V2 decision revisit; not implementation-ready. Origin: old Story 15.5. Requirements/inventory: OQ-13.

**Prerequisites:** V2 planning and resolved relevant native-mode/hosting decisions; completed native runtime delivery is not required merely to evaluate options.

**Gate:** V2 planning decision only, not a ready-for-development hosted implementation story.

**Acceptance Criteria:**

**AC 17.1.1**
**Given** V2 planning
**When** this story is opened
**Then** the hosted browser and sandbox options are evaluated against route eligibility (OQ-9) and the decision is recorded; until then the Capability Contract lists them as "V2 revisit (OQ-13)".

## Revised story counts and unmet delivery ledger

| Group | Stories | Phase |
| --- | --- | --- |
| 1 | 30 | I1 |
| 2 | 18 | I1 |
| 3 | 10 | I1 |
| 4 | 7 | I1 |
| 5 | 14 | I1 |
| 6 | 5 | I1 |
| 7 | 5 | I2 / V1 |
| 8 | 3 | I2 / V1 |
| 9 | 14 | I2 / V1 |
| 10 | 5 | I2 / V1 |
| 11 | 8 | I2 / V1 |
| 12 | 8 | I2 / V1 |
| 13 | 2 | I2 / V1 |
| 14 | 1 | I2 / V1 |
| 15 | 4 | I2 / V1 |
| 16 | 4 | V2 |
| 17 | 1 | V2 |

Total: 139 stories. I1: 84; I2/V1: 50; V2: 5. A higher count reflects explicit splits and confirmed capability detail, not a new product-scope reduction.

Unmet after I1: A08 full parallel delegation (10); A09 compaction/secondary-route continuity (10/15); A10 actual production destination (14, fixture evidence in 6 only); A13 schedules/events (12); A14 unattended reassignment and conversation snapshot extension (12/11), **not basic sharing/revocation** (4/5); A15 unenabled remaining providers/environments (8/9); A16 browser/demonstration/dynamic tools/Code Mode/prediction/scans/activity recall/secondary clients/programmatic entry (7–12); hosted outputs (8). A12 native authority remains V2 (16); hosted browser/sandbox is a V2 decision revisit (17). Every not-enabled route stays unmet regardless of passing another route’s test.

## Shared-service proposal reconciliation — 2026-10-27

The architecture Update adds AD-18–22 / SC-1–6 without changing the 17 groups or 139 story IDs. OQ-16A direction was adopted after the connectivity clarification; OQ-16B remains actual issuer/operator/region/retained-data and route eligibility. All earlier OQ-16 references are refined by this split. The appended conformance acceptance criteria in 1.10, 1.11 and 4.1–4.4 are implementation requirements under the adopted direction, not executed results or authorization to implement. Earlier exact-source mappings retain their targets unchanged; new checks are architecture-derived additions.

SC-1 belongs to 1.10, SC-2/3 membership to 1.11, SC-2/3 grants to 4.1, SC-4 transfer to 4.2, SC-5 connection-loss and active-authority control to 4.3, SC-6 retained-data/recovery and conjunctive lineage to 4.4, actual admission/retrieval to 4.5/4.6, and reviewed-basis coordination to Epic 5. Build records only at introduction; early fixtures do not require later memory/review UI. Existing CAP/FR/C/E/UX inventory, native-V2 boundary and external-audit gate remain.

Connectivity correction from the owner: cloud-model agent work needs model connectivity whether private or shared; shared-derived use additionally needs live Inquello authority. Connection failures are distinguished, affected work pauses, and supported progress is preserved. Manual use of other applications on private local files is not offline agent execution or a new Inquello feature. Local-model routes remain inventory scope but are not a current priority or automatic fallback. Subsequent owner message Sentinel_f111d58b637c8191a30a23234ec55314 adopts the clarified technical direction, not implementation or vendor commitments.

## Technical direction adopted — 2026-10-27

OQ-16A is resolved by Sentinel_f111d58b637c8191a30a23234ec55314 following the connectivity scenario. Pending-adoption descriptions in earlier reconciliation history are superseded. AD-18–21 distinguish owner-adopted direction from engineer-derived protocol rules; AD-22 derives recovery controls. OQ-16B actual route/real-data gates, OQ-15 external-audit policy, Story 1.22 additional inference-route selection and later/V2 gates remain. No implementation authorization or runtime acceptance is inferred, and full increment scope is unchanged.

## Initial Claude route selected — 2026-10-27

Owner preference now selects Claude API-key access and conditionally permitted subscription login. Earlier unselected-provider references are superseded. AD-23 and the Claude companion distinguish actual official access conditions from pinned runtime compatibility. CR-1 now records the adapter design; build/tests remain acceptance work, not unresolved provider preference; full scope and existing story IDs stay unchanged. Story 9.10 expands/regresses an initial implementation rather than duplicating it. All original AC text remains historical traceable acceptance; added AC1.22.5–6 clarify the selected route. No API calls, credentials, costs or implementation authorized.

CR-1 native Messages adapter ownership/normalization and SC-7 synthetic service/OIDC/blob/test-data topology are recorded. Production identity/operator/region/retention eligibility remains a real-data gate, not a blanket block on the synthetic first-increment build plan. Actual inference required by 1.25 is future acceptance work, not a prerequisite test that must already pass before planning.
