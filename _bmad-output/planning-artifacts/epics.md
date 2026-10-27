---
status: draft
stepsCompleted: [1, 2]
inputDocuments:
  - _bmad-output/specs/spec-inquello/SPEC.md
  - _bmad-output/specs/spec-inquello/scope-and-gates.md
  - _bmad-output/specs/spec-inquello/glossary.md
  - _bmad-output/planning-artifacts/prds/prd-inquello-2026-10-26/prd.md
  - _bmad-output/planning-artifacts/prds/prd-inquello-2026-10-26/addendum.md
  - _bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md
  - _bmad-output/planning-artifacts/architecture/architecture-inquello-2026-10-26/ARCHITECTURE-SPINE.md
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

Inquello is a public-Codex-fork agentic workbench for internal audit, external audit, advisory and IT/IS audit teams (AD-1 to AD-4: public Codex fork, audit semantics separate from the runtime, Electron desktop with React/TypeScript, shared Rust audit modules with a separate working SQLite). The canonical contract is `SPEC.md` with its companions; every stable ID below (CAP-1 to CAP-25, FR-1 to FR-44, NFR-1 to NFR-10, UJ-1 to UJ-8, A01 to A18, AD-1 to AD-14, S01 to S13, SP1 to SP7, OQ-1 to OQ-12, AS-1/AS-2/AS-UX1 to AS-UX4) is preserved as written there.

**Phase rule.** The full V1 target is CAP-1 to CAP-22 (41 FRs) plus the OQ-14 identity and authorisation obligation added on 2026-10-27. CAP-23 to CAP-25 (FR-38, FR-40, FR-42) are V2, as is a hosted agent browser or sandbox (V2 revisit, OQ-13). Grouping into epics is not a scope cut. Under OQ-10 (decided 2026-10-27) the first increment, sequencing and explicit deferrals are decided in this document; every deferral is recorded as unmet acceptance, never silently dropped.

## Requirements Inventory

### Functional Requirements

Source: final PRD section 4 (IDs global and stable). Each FR names its capability (CAP) and source group (P). All are V1 unless marked **V2**. The "Consequences" sentences define verification intent, not claims of tested capability.

**CAP-1 Organise and recover work (P01)**

- **FR-1 Organise work:** Practitioners can create and organise Engagements, folders, Tasks and concurrent workstreams, including ad hoc Tasks without an Engagement. Consequences: entity/client/period and effective Workspace remain visible when supplied; opening an ad hoc Task does not require invented engagement fields; moving or reopening work preserves its permitted references.
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
- **FR-14 Generate and deliver visual or hosted outputs:** Users generate/edit visuals and prepare supported shared, published or hosted outputs under the required audience and destination authority. Consequences: intended audience and included content are inspectable before publication; source/analysis references remain usable where claimed; delivery states distinguish generated, published and verified.

**CAP-8 Research and use permitted interfaces (P08)**

- **FR-15 Research with attributable sources:** Users ask the assistant to research and cite public or permitted sources using supported web/browser mechanisms. Consequences: material claims carry accessible references and retrieval context; source limitations and estimates are labelled; retrieved instructions never override the Task's authority.
- **FR-16 Use browser, site and computer actions:** The assistant uses available browser context, site-exposed tools and computer interaction under the acting identity and permitted scope. Consequences: relevant account/destination and action outcome are identifiable; a visible browser session grants no blanket authority; unavailable UI context or uncertain outcomes are disclosed rather than guessed.

**CAP-9 Review and investigate technical work (P09)**

- **FR-17 Review, correct and recheck work:** Users request reviews of artifacts/changes, examine supported exceptions, apply authorised corrections and recheck results. Consequences: findings retain scope, evidence, uncertainty and revision context; unsupported findings differ from established errors; a correction or agent recheck never automatically closes a Finding or grants Professional Approval.
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

- **FR-27 Resume with scoped knowledge:** Users resume history and manage limited active context through compaction while retaining source and decision references; users inspect and control memory use and contributions separately. Consequences: missing context or changed access is identified; preferences, approved reusable knowledge and Engagement/client evidence remain distinguishable; memory and recall are shared across a Workspace's Engagements and isolated between Workspaces (OQ-3, not configurable).
- **FR-28 Control activity recall:** Users enable, inspect and control permitted recall of application/site activity separately from conversation history and Methods. Consequences: capture/use controls and original references are visible; disabled or out-of-scope activity is not claimed as captured; reuse and revocation obey effective policy for retained material.

**CAP-15 Select routes and control consumption (P15)**

- **FR-29 Use permitted processing routes:** Teams use allowed models, organisational gateways, local-model routes and service identities, retaining Bedrock, Azure Foundry/Azure OpenAI and the named GCP/Vertex route (OQ-9: every documented route stays in scope and is tested; eligibility verified per route before real data). Consequences: effective provider/deployment and capabilities are identifiable; an unsupported operation never silently switches route; execution, inference and connector data flows are distinguishable.
- **FR-30 Control reasoning, speed and consumption:** Users select available reasoning/speed choices and inspect usage under configured limits (OQ-5: inherited Codex usage handling; no Inquello budget values for first validation). Consequences: enabled limits have observable enforcement and an explained stop/escalation; tool/model costs are attributable to accepted deliverables.

**CAP-16 Retain convenience and scoped migration (P16)**

- **FR-31 Retain interaction and attention aids:** Users use supported voice/dictation, notifications and optional task companions. Consequences: voice-derived instructions are inspectable and correctable; notifications distinguish attention needed from completion; companion state never determines Professional Approval or audit completion.
- **FR-32 Migrate setup and share scoped snapshots:** Users import supported setup/history and share selected conversation snapshots under an explicit audience. Consequences: imported items and transfer limitations are reported; snapshots expose only selected permitted content; migration never silently copies unavailable credentials, grants authority or changes Record Authority.

**CAP-17 Enforce authority and input trust (P17)**

- **FR-33 Enforce effective action authority:** Teams apply sandbox/permission profiles, command rules, approvals, managed policy and source identity; default execution is a scoped user-started Task; broader/no-prompt modes require explicit permitted configuration. Consequences: negative permission cases prevent the prohibited action; an approval identifies its action/scope and cannot become blanket Professional Approval; automatic review, prompt inspection and specialist access retain declared limits.
- **FR-34 Treat evidence as data:** The assistant distinguishes trusted task/policy instructions from instructions embedded in Sources, retrieved pages, tool results or examples. Consequences: malicious instructions in evidence never change the authorised mandate; blocked or inspected actions disclose limits; tool/hook configuration is not proof that every untrusted input was detected.

**CAP-18 Assign responsibility and revoke access (P18)**

- **FR-35 Assign work and human review:** Teams assign Task and Human Review responsibility with Workspace/Engagement access and attribution (OQ-1: team-only participation, no guests in V1). Consequences: the responsible human and reviewed version are identifiable; multiple responsibilities can coexist; reviewer hierarchy follows selected policy, not a hard-coded structure.
- **FR-36 Reassign and revoke access:** Administrators handle access revocation, reassignment and departures, including retained work and unattended job ownership. Consequences: subsequent prohibited use is prevented after effective revocation; orphaned unattended work is surfaced and handled under policy; retained artifacts/history are addressed separately from current access.

**CAP-19 Govern V1-held material (P19)**

- **FR-37 Govern V1-held material:** Teams apply access, retention, deletion, export and recovery policy to working files/history, evidence references, logs and telemetry held by Inquello (OQ-2: references plus relied-on extracts and derivations; no full source copies). Consequences: these categories are distinguishable from external authoritative records; usage/task counts never stand in for accepted work or Coverage; recovery/export declares losses and respects access.

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

- **FR-43 Preserve meaning across boundaries:** Users delegate, switch editors or environments, review and resume without manually reconstructing Task context or losing artifact identity. Consequences: sources, Method, artifacts, decisions and actual status remain accessible across the boundary; unsupported transfers disclose missing context; external edits and changed evidence identify affected outputs and approvals.
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
- **Stack seeds (verified cold-start, not a validated combined stack):** Electron 45.0.0, React 19.3.1, TypeScript 5.9.2, Rust 1.99.1 (edition 2024), pnpm 10.34.5. SQLite is adopted; the domain-store driver/runtime must include the WAL-reset corruption fix (SQLite 3.51.3+ or a documented fixed backport) and be verified independently of the upstream state-store check.
- **Structural seed (package names are seed, not mandatory directories):** `fork/codex-rs/{core, core-api, app-server, ext}` retained runtime and integration seams; `{rollout, state, thread-store}` retained runtime continuity; `inquello-domain/` audit commands, rules and ports; `inquello-adapters/` runtime, SQLite, file and external adapters; `fork/desktop/` Electron main/preload and React interface.
- **Transport warning:** upstream documents the app-server command and WebSocket transport as experimental/unsupported for production in the remote Code Mode host context. Default stdio availability establishes neither blanket production support nor Inquello readiness; the selected fork/route must be verified and hardened before release.

#### Architecture rules binding every story (AD-2 to AD-14)

- **AD-2 Separate audit semantics from the runtime:** retain the Codex runtime/app-server; place evidence, Method, review and record logic in Inquello modules; make focused core changes only where needed.
- **AD-3 Electron desktop with React/TypeScript:** build the interface on the supplied DESIGN/EXPERIENCE contract; assume no reusable private OpenAI desktop source.
- **AD-4 Shared Rust audit modules and separate working SQLite:** all supported audit entry paths (desktop, CLI, jobs) use the same Rust modules; Inquello working metadata lives in a separate local SQLite; no central server; V1 formal record authority remains external.
- **AD-5 Directed dependencies and constrained desktop privilege:** sandboxed, context-isolated renderers without Node authority; preload exposes specific operations; main validates payloads/senders, controls navigation, owns the packaged Rust child and its stdio lifecycle; no general IPC/shell/`child_process` bridge; artifact and source previews render in a distinct sandboxed security context that cannot submit human decisions; generated protocol schemas match the actual runtime version; stderr stays outside protocol output; initialisation, backpressure, disconnect and shutdown are handled explicitly.
- **AD-6 Stable work linkage and separate state authorities:** stable Workspace, optional Engagement, Task, Source and Artifact identity with explicit runtime thread/turn/item/branch references; trusted host/policy context supplies acting/reviewer identity; model output cannot mint a human decision; separate run, artifact, checks, human-review, Professional Approval and delivery states; a shared domain-owned reviewed-basis revision covers decision-relevant outputs, Sources, Method/departures and policy versions; historical decision attribution is immutable.
- **AD-7 Owned mutations and cross-store recovery:** one logical mutation owner per Task/working record; domain commands validate authority, expected versions and operation identity; the domain repository owns writes/migrations; general agent tools and subprocesses are denied direct access to the protected domain store and credential storage; credentials stay in trusted runtime facilities/adapters and never reach model context, artifacts, exports or logs; cross-store reconciliation uses supported IDs/status or exposes uncertain/unlinked work; cross-host ownership/version transfer is explicit and verified or that route stays gated.
- **AD-8 Scoped context, permission and processing routes (read with OQ-14: identity comes from the Inquello auth module, not provider sign-in; and OQ-13: V1 browser/sandbox routes are local):** trusted instructions separate from evidence; source origin/version, saved/live scope and access limits retained; authority rechecked on use, resume and mutation; revocation covers active/unattended work; execution, inference, browser/connector, files, history/logs, backups and unattended routes distinguished; no silent fallback; no credential grant from plugin discovery; no permission grant from a Method; gateway/local-model, Bedrock, Azure Foundry/Azure OpenAI and GCP/Vertex routes preserved with per-route eligibility.
- **AD-9 Artifact identity and conflict-preserving changes:** same supported saved files and unrelated content preserved; live application and remote-record access distinguished; versions compared before replacement; intervening edits preserved or conflicts left unapplied; alternatives promoted deliberately with origin history; input/Method/derivation, population, exclusions, duplicate treatment, sampling parameters and actual coverage retained; changed inputs recompute or mark stale; reviewed-basis changes mark decision applicability stale; unsupported conversions disclosed before destructive change.
- **AD-10 Method departures and knowledge boundaries:** Method/version/parameters and Task-specific departures (rationale, affected scope) kept separately from shared-guidance changes; memory contribution, memory use, history and activity capture/recall kept distinct; denied departures remain unapplied; no silent case-to-team promotion; recall shared within a Workspace and isolated between Workspaces; instructions, skills, tools, agents and demonstration-to-skill mechanisms preserved without a general workflow engine.
- **AD-11 Bounded external effects and reconciliation:** operation/destination/acting identity, exact authorised content and relevant version retained before effects; configured permission or an AD-12 mandate applied; execution through the supported adapter with destination verification; attempted/confirmed/uncertain outcomes recorded; stale proposals return to review; uncertain effects reconcile before retry; destination conditional-update/deduplication used where available and its absence disclosed; no invented idempotency; import/export fallback kept; audit writeback grants no source-transaction authority.
- **AD-12 Automation mandates and collaboration ownership:** trigger/input/Method/identity/limits/destination/escalation mandates retained with actual event/run outcomes; each accepted run binds to one immutable mandate revision; configuration changes are prospective unless explicitly rebound with authority/impact checks; revocation and restrictive policy always apply; disabling changes future eligibility only; ownership/revocation and duplicate-effect controls enforced across entry paths via shared domain rules; execution-host availability observed; no automatic cloud continuation.
- **AD-13 Phase-specific record authority:** V1 retains local working/review records and links Method-required formal acceptance to verified external authority; only V2 adds FR-38/40/42 native identity, lifecycle, hold/amendment/retention, recovery/export and deliberate migration; Tasks/Engagements cannot silently change authority; V2 policy (OQ-11) is not a V1 gate.
- **AD-14 Capability evidence and operating commitments:** each enabled route declares owner, implementation/service supply, identity/processing/source limits, versions and capability-specific acceptance; missing/partial/failed/uncertain outcomes, diagnostics, recovery and cost evidence inspectable under data policy; deferred or unverified requirements remain unmet scope.
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
- **OQ-2** retain references plus relied-on extracts and derivations; no full source copies; extracts visible across a Workspace's Engagements.
- **OQ-3** memory/recall shared across a Workspace's Engagements and clients, isolated between Workspaces; not configurable.
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
- **Dependency:** module design and hosting are decided in a pending bmad-architecture update; stories realising this obligation carry "depends on the OQ-14 architecture update" and must not pre-select an identity provider, token format, tenancy topology or hosting model. The same update must confirm whether Claude is reached through Bedrock, Vertex or a gateway, or needs a new adapter (open question recorded in the spec memlog).

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
- **UX-DR35 ReviewScreen (S03):** artifact-dominant source table plus reviewer/agent explanation, JudgmentTag claims, Choice treatments, reason TextField and affected-output DiffLines; reason/choice kept in session until saved or deliberately discarded; version checked before commit; Keep/Revert operates on the proposed change scope and is visually and semantically distinct from Professional Approval and external authority.
- **UX-DR36 AutomationsScreen (S04):** 14px title, compact automation list with selected blue-50 row, readable trigger/last-run context, detailed check/action region; selects the actual automation/run showing trigger, scope, Method, identity and outcome; enable/disable/configure, "New automation" and "Open review package" require real persistent state; a successful run never borrows the human-decision appearance.

**Surfaces, states and flows**

- **UX-DR37 Shared state baseline for every surface S01 to S13:** cold loading names what is loading without inventing content; empty states describe the actual absence plus one relevant action; focused controls visible in reading order; errors name the failed action and retained work; permission denial prevents the action without disclosure; offline/lost connection identifies the unavailable capability; unsent input kept in session; confirmed saved artifacts preserved; no promise of local persistence, synchronisation, queued writes or retries unless actually supported; version/authority rechecked on recovery; a disabled control explains what prevents its action.
- **UX-DR38 S05 Search and Workspace navigation (spine-only):** find accessible Tasks, files and Engagements; pin/archive/reopen; inspect origin; no workspaces, no matches and unavailable search are separate; focus returns to the trigger on close; stale index never reveals revoked content; search terms kept on failure; unsearched scope shown as unavailable.
- **UX-DR39 S06 Skills and procedures (spine-only):** inspect/create/refine examples, instructions and skills with versions and dependencies; record Task-specific departures separately from Method changes; missing dependency, unpublished change, incompatible version and denied distribution distinct; denied departure stays unapplied with draft rationale preserved; client evidence never imported into shared Method by default.
- **UX-DR40 S07 Capabilities and processing (spine-only):** discover tools/apps/plugins; inspect permissions, effective provider/deployment, acting service identity, distinct execution/inference/browser-connector routes, model choices and configured consumption; all documented routes (ChatGPT/OpenAI sign-in, API key, Azure Foundry/Azure OpenAI, Bedrock, GCP/Vertex, gateway, local; Claude route pending the OQ-14 architecture update) shown with capability limits; provider sign-in state shown separately from Inquello identity (OQ-14); browser and sandbox shown as local routes in V1 (OQ-13); expired/revoked access, incompatible route and usage limit each offer a next action; never silently switch provider/environment; local execution never implies local inference.
- **UX-DR41 S08 History, alternatives and memory (spine-only):** resume/fork/compare; inspect source context; separate memory contribution, memory use and activity recall controls; empty, unavailable, no retained memory and memory disabled distinct; lost context and permission changes explicit; revocation never claims historic erasure; failed merge/promotion preserves the original branch.
- **UX-DR42 S09 Team, policy and retained material (spine-only):** responsibilities, access, reassignment and unattended jobs; policy inspection separately for working files/evidence, history/logs/telemetry, backups and unattended work; no assignee, no jobs and no retained material distinct; denied administration, stale membership, orphaned jobs and hold/deletion restrictions show actual limits; reassignment never erases records or grants access implicitly. No guest portal (OQ-1).
- **UX-DR43 S10 Sharing and delivery (spine-only):** artifact, review package, snapshot or prepared communication; inspect destination/audience/content/version and configured authority before action; failed/local-only/attempted/uncertain/confirmed outcomes persistent; unknown remote result reconciled before retry; revocation cannot be bypassed by a cached preview; first validation offers import/export only (OQ-6).
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

Primary epic per FR; a second epic is listed where another surface completes the same FR. Phase V1 unless marked V2.

- FR-1: Epic 1 - organise Workspaces, Engagements, folders, Tasks and ad hoc Tasks
- FR-2: Epic 1 - search, pin, archive, reopen and attention states (S05)
- FR-3: Epic 1 (desktop) and Epic 11 (CLI, application-adjacent, mobile/remote, physical) - same Task and authority across surfaces
- FR-4: Epic 11 - session commands, contextual assistance and physical shortcuts with declared outcomes
- FR-5: Epic 4 - explicit execution location versus inference location
- FR-6: Epic 4 - isolated alternatives, comparison and deliberate promotion
- FR-7: Epic 1 - plan, execute permitted tools, verify and report with checked/unchecked/incomplete distinction
- FR-8: Epic 1 - steer, interrupt, continue and resume with applied effects visible
- FR-9: Epic 3 - folders, documents, data and images as attributable context
- FR-10: Epic 3 - selections, annotations, application snapshots and composer assistance
- FR-11: Epic 3 - calculations and executable work with retained derivations (W1)
- FR-12: Epic 3 - population, exclusions, sampling parameters and Coverage
- FR-13: Epic 4 - create, edit, preview and externally continue xlsx/docx/pptx/csv and scripts
- FR-14: Epic 4 - generated visuals and shared/published/hosted outputs under audience authority
- FR-15: Epic 6 - research with attributable sources and retrieval context
- FR-16: Epic 6 - local browser, site tools and Computer Use under acting identity (OQ-13)
- FR-17: Epic 5 - review, correct, Keep/Revert and recheck without closing a Finding (W2)
- FR-18: Epic 5 - code/configuration inspection, security analysis, scans/findings and backlog
- FR-19: Epic 7 - examples, standing instructions, skills and demonstration-to-skill (M1)
- FR-20: Epic 7 - Method authority, versions and recorded departures
- FR-21: Epic 8 - built-in tools, connected apps, MCP and plugins under effective permissions
- FR-22: Epic 8 - hooks, app-server integration and client-supplied tools
- FR-23: Epic 10 - batch/SDK/non-interactive work with structured results
- FR-24: Epic 10 - schedules and events with mandates and run outcomes (S04)
- FR-25: Epic 9 - delegation, consolidation and disagreements
- FR-26: Epic 9 - side chats, forks and references with origin retained
- FR-27: Epic 9 - compaction/resume and memory contribution/use (OQ-3)
- FR-28: Epic 9 - application/site activity recall controls
- FR-29: Epic 8 - permitted processing routes without silent substitution (OQ-9)
- FR-30: Epic 8 - reasoning/speed choices and inherited usage limits (OQ-5)
- FR-31: Epic 11 - voice/dictation, notifications and optional companion
- FR-32: Epic 11 - setup/history import and audience-scoped snapshots
- FR-33: Epic 2 - sandbox/permission profiles, command rules, approvals, managed policy, source identity
- FR-34: Epic 2 - evidence treated as data; embedded instructions never change the mandate
- FR-35: Epic 5 - Task and Human Review responsibility with attribution (OQ-1)
- FR-36: Epic 12 - revocation, reassignment, departures and orphaned jobs
- FR-37: Epic 12 - retention, deletion, export and recovery of V1-held material (OQ-2)
- FR-38 (V2): Epic 15 - native record retention, deletion, hold, amendment and recovery (OQ-11)
- FR-39: Epic 13 - practice workflows using artifacts and external systems (import/export, OQ-6)
- FR-40 (V2): Epic 15 - practice workflows through native records (OQ-11)
- FR-41: Epic 13 - inspect, authorise and verify bounded external updates with reconciliation (W3)
- FR-42 (V2): Epic 15 - record-mode selection and verified migration (OQ-11)
- FR-43: Epic 14 - meaning preserved across delegation, editors, environments, review and resume
- FR-44: Epic 14 - completion states and Capability Contracts; deferral ledger
- OQ-14 identity and authorisation obligation (no FR number): Epic 2 - Inquello auth module; provider sign-in separate
- NFR-1 to NFR-10: verified within the epics that own the referenced FRs; the acceptance harness in Epic 14 runs the cross-cutting fixtures (W1 to W3, M1, A01 to A18)
- UX-DR1 to UX-DR55: foundations and shell components in Epic 1; surface-specific UX-DRs in the epic that owns the surface (S03 Epic 5, S04 Epic 10, S06 Epic 7, S07 Epic 8, S08 Epic 9, S09 Epics 2 and 12, S10 Epic 13, S11 Epic 3, S12 Epics 4 and 11, S13 Epic 15); UX-DR51 to UX-DR54 in Epic 14

## Epic List

Fifteen epics ordered by dependency. Each delivers complete, independently valuable capability for its domain using only earlier epics. Epics 1 to 14 are V1; Epic 15 is V2. Grouping is not a scope cut: every FR, the OQ-14 obligation and all 55 UX-DRs map to an epic above.

### Epic 1: Start and steer work on the desktop workbench
An auditor opens Inquello on the desktop, selects a Workspace, organises Engagements, folders and Tasks or starts an ad hoc Task, submits an outcome with files and an optional Method, follows the plan and progress, steers, stops and resumes, and finds the work again later. Built on the selected fork cut (AD-1), the Electron/React shell (AD-3, AD-5), the supplied design system (UX-DR1 to UX-DR8, primitives and shell compositions), the shared Rust domain with a separate working SQLite (AD-4, AD-6, AD-7) and the stdio app-server child.
**FRs covered:** FR-1, FR-2, FR-7, FR-8, FR-3 (desktop surface). Seeds the FR-44 state vocabulary.

### Epic 2: Identity, authority and input trust
Inquello knows who is acting through its own auth module (OQ-14: Workspace membership, audit-team roles, Engagement membership, internal-audit and external-audit models), applies effective execution authority (sandbox and permission profiles, command rules, ApprovalCard approvals, managed policy, source identity, explicit broader modes), keeps inference-provider sign-in separate from identity, and treats evidence, pages, tool results and examples as data.
**FRs covered:** FR-33, FR-34, OQ-14 obligation. Dependency: OQ-14 architecture update for module design and hosting.

### Epic 3: Attributable context and checkable analysis
An auditor brings folders, documents, data, images, selections, annotations and application snapshots into a Task with origin, version and saved/live scope visible; the assistant runs calculations, queries and scripts with retained inputs, parameters and derivations, and represents population, exclusions, sampling and actual Coverage honestly. Fixture W1 reconciles exactly.
**FRs covered:** FR-9, FR-10, FR-11, FR-12.

### Epic 4: Editable artifacts, environments and alternatives
An auditor creates and revises workbooks, documents, presentations, CSV datasets, scripts and visuals, inspects previews and format-aware changes, continues the same saved file in Excel, Word or PowerPoint, and returns with external edits detected and conflicts explicit; chooses where work executes separately from where inference runs; compares isolated alternatives and promotes deliberately; prepares visuals and published or hosted outputs under audience and destination authority.
**FRs covered:** FR-5, FR-6, FR-13, FR-14.

### Epic 5: Review, correction and human decisions
A reviewer opens the selected item in S03, traces results to evidence and derivations, requests scoped corrections, applies Keep or Revert on proposals with affected outputs visible, and rechecks; the shared reviewed basis marks decision applicability stale when evidence or Method changes; the responsible human and reviewed version are identifiable; technical specialists retain code, configuration and security review with scans, findings and backlog provenance. Fixture W2 passes.
**FRs covered:** FR-17, FR-18, FR-35.

### Epic 6: Research and permitted interfaces (local)
An auditor asks for research with citations and retrieval context, and uses the local built-in browser profile, browser annotations, site-exposed tools and Computer Use under the acting identity and permitted scope (OQ-13: local in V1; hosted browser or sandbox is a V2 revisit).
**FRs covered:** FR-15, FR-16.

### Epic 7: Reusable Methods and departures
An auditor turns examples and instructions into reusable skills and Methods with visible version, parameters and dependencies, records Task-specific departures separately from maintained guidance, and sees affected outputs when a Method changes; client evidence never silently becomes shared Method or memory. Fixture M1 passes.
**FRs covered:** FR-19, FR-20. Distribution inherits Codex mechanisms (OQ-4).

### Epic 8: Capabilities, connections and processing routes
An auditor discovers and uses built-in tools, connected apps, MCP servers, plugins and marketplaces with identity, dependencies and limits visible; teams use hooks, app-server integration and client-supplied tools with declared contracts; every documented processing route (ChatGPT/OpenAI sign-in, API key, Azure Foundry/Azure OpenAI, Bedrock, GCP/Vertex, gateway, local; Claude pending the OQ-14 architecture update) reports its capabilities without silent substitution, with reasoning/speed choices and inherited usage limits inspectable in S07.
**FRs covered:** FR-21, FR-22, FR-29, FR-30. OQ-4, OQ-5, OQ-9.

### Epic 9: Delegation, alternatives and continuity
An auditor delegates bounded work to focused agents, consolidates results with disagreements and gaps visible, explores side chats and forks without losing origin, resumes compacted history with sources and decisions accessible, and controls memory contribution, memory use and activity recall separately (OQ-3: shared within a Workspace, isolated between Workspaces).
**FRs covered:** FR-25, FR-26, FR-27, FR-28.

### Epic 10: Programmatic, scheduled and event-driven work
A team runs batch, SDK and non-interactive Tasks with structured, versioned results, and configures bounded schedules and events in S04 with trigger, inputs, Method, acting identity, limits, destination and escalation under an immutable mandate revision; run outcomes distinguish missing, not run, incomplete, failed and no-exceptions; duplicates never repeat effects.
**FRs covered:** FR-23, FR-24. Supply gate: production scheduler/event route must be proven before enablement.

### Epic 11: Secondary surfaces and convenience
An auditor continues the same Task through CLI/session controls, application-adjacent assistance, mobile/remote steering and optional physical controls, uses voice/dictation with correctable transcripts, notifications that distinguish attention from completion, an optional companion, setup/history import with declared losses, and audience-scoped conversation snapshots.
**FRs covered:** FR-3 (non-desktop surfaces), FR-4, FR-31, FR-32.

### Epic 12: Team administration and governed material
An administrator revokes access, reassigns work and handles departures including retained work and orphaned unattended jobs, and applies access, retention, deletion, export and recovery policy to working files, history, evidence references, logs and telemetry held by Inquello, distinct from external authoritative records.
**FRs covered:** FR-36, FR-37. OQ-2.

### Epic 13: Practice workflows and external delivery
A team plans and scopes, manages procedures and evidence requests, prepares workpapers, reviews, reports, handles responses and follows up using artifacts and the external record system via import/export, prepares stakeholder communications through approved tools, and inspects, authorises and verifies bounded external updates with operation identity and reconciliation of stale or uncertain outcomes. Fixture W3 passes against a fixture destination; a named destination adapter follows OQ-6's first-validation decision.
**FRs covered:** FR-39, FR-41.

### Epic 14: Coherent work, completion states and capability contracts
Work keeps its meaning across delegation, editors, environments, review and resume; every Task exposes planned/running/blocked/interrupted, produced, checks incomplete/complete, review/revision, Professional Approval and attempted/confirmed/uncertain Delivery as distinct states; each enabled route declares a Capability Contract; the acceptance harness runs W1 to W3, M1 and the applicable A01 to A18 scenarios and keeps the deferral ledger of unmet acceptance.
**FRs covered:** FR-43, FR-44.

### Epic 15: Native audit records (V2)
In native-record mode an Organisation/Workspace selects the permitted record mode and migrates deliberately with verified results; practice workflows link to native Engagements, procedures, Sources, workpapers, Findings, decisions, Responses, Actions and Retests with attributed approvals; retention, deletion, hold, amendment and recovery obligations are met with attributable history (S13, SP7).
**FRs covered:** FR-38, FR-40, FR-42. Dependency: OQ-11 record policy before implementation commitments.

## Sequencing and first increment (OQ-10)

OQ-10 is decided here. The target is unchanged; this records what ships first and what remains unmet until later increments. Every deferral below is unmet acceptance, not removed scope, and is refined per story in the epic sections.

**Increment 1 - desktop validation slice.** Purpose: let the validating internal audit team (OQ-7) run UJ-1, UJ-3, UJ-4 and UJ-7 on the desktop with Excel, Word, PowerPoint and CSV and import/export only (OQ-6), and measure the SM-1 to SM-4 baseline. Contents:

- Epic 1 in full; Epic 2 in full once the OQ-14 architecture update lands (local single-team auth module); Epic 3 (FR-9, FR-11, FR-12 in full; FR-10 limited to file selections and application snapshots); Epic 4 (FR-13 xlsx/docx/pptx/csv round trips and external-edit handoff, FR-5 local environment, FR-6 local isolated copies; FR-14 limited to generated visuals); Epic 5 in full except security scans and backlog triage of FR-18; Epic 7 in full except demonstration-to-skill; Epic 8 (inherited default route, one organisation-approved route chosen by the validating team, inherited MCP/skills/plugins/hooks, inherited usage limits); Epic 6 (FR-15 web search with citations only); Epic 13 (FR-39 using artifacts and export/import packages; FR-41 bounded-update contract and reconciliation against a fixture destination); Epic 14 (completion states, Capability Contract ledger, acceptance harness for W1, W2, M1 and the fixture-destination W3).

**Increment 2 - breadth and automation.** Remaining Epic 6 (local browser, annotations, site tools, Computer Use), Epic 9, Epic 10 (after the scheduler/event supply gate), Epic 11, Epic 12, remaining Epic 8 routes (OQ-9: each tested with per-route eligibility), remaining Epic 4 (worktree-style alternatives, hosted outputs), remaining FR-18 scans/backlog, demonstration-to-skill, and a named external destination adapter once one is named.

**V2.** Epic 15 (OQ-11). Hosted agent browser or hosted sandbox: V2 revisit (OQ-13).

**Unmet acceptance after Increment 1 (recorded, not dropped):** A08 (parallel agents), A13 (scheduled/event work), A14 (revocation, reassignment, snapshots), A15 (routes beyond those enabled), A16 (voice, browser context, migration, companions, physical controls), A10 against a real destination, A09 compaction cases, A11 external-authority declaration completes only with Epic 13 export; A12 is V2 only. SM-C3 negative authority cases must pass for every route enabled in Increment 1 before real data uses it (OQ-9).

Epic structure and first increment approved by Israel on 2026-10-27.

**Story conventions.** Each story names its increment (Increment 1, Increment 2 or V2), the FRs, UX-DRs, AD rules and C/E inventory entries it realises, and any gate dependency. "Deferred" lines inside a story record unmet acceptance for a later increment; they never remove scope. User types follow the accepted example roles: Internal Auditor (Amina), Internal Audit Manager (Noah), IT Auditor (Dev), plus administrator or method owner and the Inquello implementation team for foundation work.

## Epic 1: Start and steer work on the desktop workbench

An auditor opens Inquello on the desktop, selects a Workspace, organises Engagements, folders and Tasks or starts an ad hoc Task, submits an outcome with files and an optional Method, follows the plan and progress, steers, stops and resumes, and finds the work again later. Built on the selected fork cut, the Electron/React shell, the supplied design system, the shared Rust domain with a separate working SQLite and the stdio app-server child. FRs: FR-1, FR-2, FR-7, FR-8, FR-3 (desktop). Relevant NFRs: NFR-3, NFR-4, NFR-5, NFR-6, NFR-10. UX-DRs: UX-DR1 to UX-DR31, UX-DR33, UX-DR34, UX-DR37, UX-DR38, UX-DR47 to UX-DR50, UX-DR55. Inventory: C01, C02, C05, C11, C12, C13, C14, C15, C16, C17, C41, C76, C77.

### Story 1.1: Establish the Inquello fork and desktop build from the selected Codex cut

As the Inquello implementation team,
I want a recorded fork of public `openai/codex` at a chosen revision with a buildable Electron desktop that owns the packaged Rust runtime child,
So that every later story builds on one verified foundation instead of an assumed one (AD-1, AD-3, AD-4, AD-5).

Increment 1. Realises: AD-1 starter requirement, stack seeds, structural seed, transport warning. Inventory: C41, C77.

**Acceptance Criteria:**

**Given** the inspected upstream revisions are evidence snapshots only
**When** the team selects the delivery fork cut
**Then** the chosen commit SHA, upstream tag/date and the reason for the choice are recorded in the repository (for example `FORK-CUT.md`)
**And** compiler, package and driver compatibility is verified at that cut against Rust 1.99.1 (edition 2024), pnpm 10.34.5, TypeScript 5.9.2, React 19.3.1 and Electron 45.0.0, with any deviation recorded with its reason.

**Given** the fork builds
**When** the desktop application starts
**Then** Electron main launches the packaged Rust app-server as an owned child over stdio, performs protocol initialisation, and handles backpressure, disconnect and shutdown explicitly
**And** child stderr is captured separately and never parsed as protocol output
**And** the generated protocol schema in the client matches the runtime version of the selected cut.

**Given** the renderer is loaded
**When** its privileges are inspected
**Then** the renderer runs sandboxed and context-isolated without Node authority, the preload exposes only named operations, main validates payload shape and sender, and no general IPC, shell or `child_process` bridge exists
**And** navigation and content boundaries are enforced by main.

**Given** the structural seed packages `inquello-domain`, `inquello-adapters` and `desktop` exist
**When** the domain crate is compiled
**Then** it imports neither Electron nor concrete runtime or storage adapters, and adapters implement domain-owned ports
**And** the separate working SQLite is opened by the domain repository only, using a driver whose resolved SQLite runtime is 3.51.3 or later or a documented fixed backport, verified by a recorded check.

**Given** upstream marks the app-server command and WebSocket transport experimental for the remote Code Mode host context
**When** transports are configured
**Then** only the stdio child route is enabled in this story and the warning is recorded in the Capability Contract notes for later hardening.

### Story 1.2: Implement the Inquello design system foundation

As an Internal Auditor,
I want every control and label in Inquello to look and behave like the selected Inquello visual system with readable contrast and keyboard operation,
So that the workbench is quiet, inspectable and usable without a mouse (NFR-5).

Increment 1. Realises: UX-DR1 to UX-DR8, UX-DR9 to UX-DR26 (18 primitives), UX-DR31, UX-DR49 (floor), AS-UX3, AS-UX4.

**Acceptance Criteria:**

**Given** the DESIGN frontmatter token set
**When** the token module is built
**Then** every colour, typography, radius, spacing, layout, shadow and motion value resolves to the exact DESIGN value, source aliases such as `text-faint` and `status-accepted-fg` keep their original values, and `pill` is the literal 999px
**And** the five IBM Plex WOFF2 files are self-hosted with `font-display: swap` and the declared fallbacks.

**Given** the 18 primitives Icon, Button, IconButton, Avatar, Badge, TextField, Switch, Choice, SegmentedControl, Tabs, Menu, StatusChip, JudgmentTag, FileChip, PlanStep, ApprovalCard, DiffLine and Toast are implemented in React
**When** each is rendered in its documented variants and states
**Then** its visual specification matches DESIGN.Components, including the proposed AX applications (muted informative text, ink-900 attention badge text, green-800 accepted chip text, ink-600 essential boundaries, blue-600 focus edge)
**And** each exposes the accessible name, role, state and keyboard behaviour defined in its EXPERIENCE rule (for example Menu arrows/Home/End/Enter/Escape, Choice arrow keys and Space, Tabs arrow navigation, Switch Space toggle, Toast announcing without moving focus).

**Given** a rendered primitive
**When** its text and essential boundaries are measured against adjacent colours
**Then** normal text reaches 4.5:1, large text and non-text indicators 3:1, and the measurement is recorded per adjacent pair and state (AS-UX4 evidence)
**And** `prefers-reduced-motion` removes spin and pulse while a textual running state remains.

**Given** the 40 Lucide icons
**When** an icon is decorative
**Then** it is hidden from assistive technology; informative icons carry text equivalents.

### Story 1.3: Build the desktop shell with Sidebar, Header and Composer

As an Internal Auditor,
I want a desktop shell with Workspace selection, an Engagements section, Task navigation, a header that keeps my context visible and a Composer that is always reachable,
So that I can move between work without losing where I am (FR-3 desktop, UX-DR27 to UX-DR30, UX-DR48, UX-DR50, UX-DR55).

Increment 1. Realises: Shell.jsx composition, keyboard and focus primitives (AS-UX3), responsive arrangements (AS-UX2), AS-UX1 accepted navigation. Inventory: C01.

**Acceptance Criteria:**

**Given** the shell is open at desktop width
**When** it renders
**Then** the Sidebar is 264px with the 20px lockup, a Workspace selector, an Engagements section, nested Tasks with NavRow hierarchy and bottom person/settings; the Header is 48px with the 14px title and muted Workspace/Engagement context; the thread is centred at up to 720px with the Composer reachable
**And** collapsing to the 52px rail keeps symbol, labelled actions, counts and the current surface/task.

**Given** keyboard-only use
**When** the user tabs through the shell
**Then** order follows task navigation, main content, contextual artifact/review actions, Composer; no scroll area traps focus; hover-only actions appear on focus; Ctrl/Cmd+N and Ctrl/Cmd+K are bound only where Electron can do so safely; Escape closes the topmost Menu or overlay, returns focus and never stops a Task
**And** headings and landmarks identify navigation, main work, artifact and contextual review; surface changes are announced once.

**Given** the window is narrower than Sidebar plus thread plus 380px artifact minimum
**When** the layout adapts
**Then** navigation collapses to the rail, then the artifact and conversation become explicitly switchable views with the same selected item and unsent text, and no horizontal page overflow occurs
**And** no dark theme is introduced.

**Given** the Composer holds unsent text
**When** the user navigates to another surface and back
**Then** the unsent text, attachments and selected Method remain in the session
**And** Enter submits only in the advertised mode, Shift+Enter inserts a newline and input-method composition never sends.

### Story 1.4: Organise Workspaces, Engagements, folders and Tasks

As an Internal Auditor,
I want to create Engagements with objectives, scope, period and members, group Tasks and folders under them, and start ad hoc Tasks outside any Engagement,
So that related work is organised the way audit practice names it without forcing every question into an Engagement (FR-1).

Increment 1. Realises: FR-1, AD-6 identity, AD-7 ownership. Inventory: C02, C05, C13 (thread linkage). UX-DR27, UX-DR37.

**Acceptance Criteria:**

**Given** a selected Workspace
**When** the user creates an Engagement
**Then** it is stored in the working SQLite with a stable Workspace-scoped identity, optional client/entity, period and supplied members, and appears in the Engagements section
**And** no Engagement field is mandatory for a Task: a new Task from New thread can exist with no Engagement.

**Given** an Engagement
**When** the user creates folders and Tasks under it or moves a Task between Engagements
**Then** each Task keeps its stable Task identity, its runtime thread reference and its permitted source/artifact references after the move
**And** the Header shows the supplied client/period and effective Workspace for the open Task.

**Given** the domain repository owns writes
**When** a Task record is created or changed
**Then** the mutation goes through a domain command that records operation identity and expected version, and no renderer code or agent tool writes to the working SQLite directly.

### Story 1.5: Start a Task from the Start surface with outcome, files and Method

As an Internal Auditor,
I want to describe the outcome I need, attach permitted files and optionally apply a procedure before starting,
So that the Task begins with exactly the context and guidance I chose (FR-7 start, S01).

Increment 1. Realises: UX-DR33 StartScreen, UX-DR29 Composer, UX-DR22 FileChip, UX-DR47 microcopy. Inventory: C01, C02, C11 (turn start), C33 (file tools).

**Acceptance Criteria:**

**Given** the Start surface after New thread
**When** it renders
**Then** focus starts at the request, the prompt reads "What should we work on?", the applied-method row shows Applied or Not applied from actual inclusion, and suggested existing files are those accessible in the current Workspace
**And** an empty request keeps Send disabled with the reason shown.

**Given** text, attached files and an applied Method
**When** the user sends
**Then** a Task is created with a stable identity, the actual text, file references and Method identity are passed to the runtime thread, and the Active surface opens with those visible
**And** an unreadable or inaccessible attachment stays identified on its FileChip and the draft is preserved rather than discarded.

**Given** remote context is unavailable
**When** the user starts local work
**Then** the local Task proceeds and the unavailable capability is named without implying the whole product works offline.

### Story 1.6: Follow progress, plan and results on the Active surface

As an Internal Auditor,
I want to watch what the agent is doing, see its plan, its tool activity and its results with calculations, observations, suggestions, decisions and gaps told apart,
So that I can judge the work while it happens rather than after (FR-7, S02).

Increment 1. Realises: UX-DR34 ActiveScreen, UX-DR23 PlanStep, UX-DR21 JudgmentTag, UX-DR13 Badge, AD-5 preview context, AD-6 state separation. Inventory: C11, C12, C14, C15, C41, C76.

**Acceptance Criteria:**

**Given** a running Task
**When** runtime events stream
**Then** the thread shows messages, tool activity and edits translated into Task progress, PlanStep items are done only when the step actually finished, running shows the blue state and pending stays neutral
**And** input needs (questions, approval requests) are shown in context with focus staying on the user's control.

**Given** the agent produces a result
**When** it is displayed
**Then** calculations, observations, suggestions, decisions and gaps are labelled with JudgmentTag text and a decision names its human or policy basis
**And** the result distinguishes checked, unchecked and incomplete work in words, not colour alone.

**Given** the agent reads several independent sources
**When** the inherited parallel read-only lookups run
**Then** each retrieved item keeps its source and Workspace/Engagement scope in the displayed context.

**Given** an artifact preview is shown beside the thread
**When** it renders
**Then** it is in a separate sandboxed context without the workbench preload or domain bridge, and nothing inside the preview can submit a human decision.

**Given** no artifact exists yet
**When** the artifact region renders
**Then** "no artifact yet" is distinct from "artifact failed".

### Story 1.7: Steer, stop, resume and recover a Task

As an Internal Auditor,
I want to redirect, interrupt and later resume a Task, including long-running goals and background work, and see exactly what was done and what remains,
So that stopping never hides applied effects and resuming never pretends to roll back (FR-8).

Increment 1. Realises: AD-7 reconciliation, AD-8 recheck on resume, UX-DR11 Stop, UX-DR23, UX-DR37 S02 states, UX-DR47 stop microcopy. Inventory: C13, C14, C16, C17.

**Acceptance Criteria:**

**Given** a running Task
**When** the user sends a steering instruction
**Then** it is queued or applied to the running turn as the runtime supports, and a scope change identifies results it affects.

**Given** a running Task with three completed and two pending steps
**When** the user presses Stop
**Then** the message states "Work interrupted. 3 steps completed; 2 remain." with actual counts, pending steps stay pending, effects already applied (saved files, external outcomes) remain listed and nothing claims rollback
**And** the Stop control requests interruption only; Escape does not trigger it.

**Given** a stopped or closed Task
**When** the user resumes it
**Then** the domain rechecks source access and Task authority first, missing context or changed access is stated, and the Task continues from its retained runtime thread with its artifacts
**And** if the runtime thread cannot be linked to the Task record, the Task is shown as unlinked/uncertain rather than a new thread being replayed silently.

**Given** a long-running goal or a background Task
**When** it continues while the user works elsewhere
**Then** its status, completion conditions and requests for input are visible in navigation and it never steals focus
**And** a session loss or crash preserves the last confirmed saved work and reports interrupted work on restart (NFR-4).

### Story 1.8: Find, pin, archive and reopen work with attention states

As an Internal Audit Manager,
I want to search accessible Tasks, files and Engagements, pin and archive work, and see which Tasks await input, review or Delivery,
So that I can find and prioritise work without being shown anything I cannot access (FR-2, S05).

Increment 1. Realises: UX-DR38, UX-DR30, UX-DR13 counts, AD-8 access. Inventory: C02, C05, C49 (list/search), C61 (attention states).

**Acceptance Criteria:**

**Given** the Search surface (Ctrl/Cmd+K or Sidebar)
**When** the user searches
**Then** only Tasks, files and Engagements within effective access are returned; no workspaces, no matches and search unavailable are separate states; the term is kept on failure; focus returns to the trigger on close.

**Given** a Task
**When** the user pins, archives or reopens it
**Then** pinning and archiving change navigation only, archiving states that no authoritative record is deleted, and reopening exposes saved progress and artifacts.

**Given** Tasks awaiting input, awaiting human review or awaiting Delivery
**When** navigation renders
**Then** each state is shown with text and a count badge that names the category, and the Inbox route lists them without implying approval.

**Given** access to a Task was revoked after indexing
**When** the user searches
**Then** the stale index does not reveal the revoked content.

### Story 1.9: Record and expose actual Task, run and artifact states

As an Internal Audit Manager,
I want every Task to show its real state: planned, running, blocked, interrupted, produced, checks complete or incomplete, review requested, revision requested, approval and Delivery states,
So that "done" never collapses different meanings into one word (FR-44 seed, AD-6).

Increment 1. Realises: AD-6 separate state authorities, UX-DR20, UX-DR51 vocabulary, consistency conventions. Inventory: C13, C41, C61. Extended in Epic 14.

**Acceptance Criteria:**

**Given** the domain model
**When** a Task, run, artifact, check, human review, Professional Approval or Delivery state changes
**Then** each is stored as a separate state with scope and version, not derived from the runtime turn status alone
**And** no universal state machine forces an advisory answer through approval or delivery steps.

**Given** a completed runtime turn
**When** the Task is displayed
**Then** completion of the turn is shown as execution finished, distinct from checks, review and approval, and a green chip or toast never states acceptance.

**Given** a UI label for a state outside the StatusChip taxonomy
**When** it renders
**Then** a separate truthful text label is used rather than coercing it into suggested/investigating/open/evidence/accepted.

## Epic 2: Identity, authority and input trust

Inquello knows who is acting through its own auth module (OQ-14), applies effective execution authority (sandbox and permission profiles, command rules, approvals, managed policy, source identity, explicit broader modes), keeps inference-provider sign-in separate from identity, and treats evidence, pages, tool results and examples as data. FRs: FR-33, FR-34, OQ-14 obligation. Relevant NFRs: NFR-3, NFR-7, NFR-8. UX-DRs: UX-DR24, UX-DR40 (identity part), UX-DR42 (membership part), UX-DR51. AD rules: AD-5, AD-6, AD-7, AD-8, AD-10. Inventory: C65, C66, C67, C68, C69, C70, C72, C73. Dependency: the OQ-14 bmad-architecture update decides module design and hosting; stories 2.1 and 2.2 cannot start implementation until it lands and must not pre-select an identity provider, token format, tenancy topology or hosting model.

### Story 2.1: Sign in to Inquello and hold Workspace, team and Engagement membership

As an Internal Audit Manager,
I want each person to sign in to Inquello itself and hold Workspace membership, an audit-team role and Engagement membership, with internal-audit and external-audit models represented differently,
So that acting and reviewer identity come from Inquello, not from whoever is signed in to a model provider (OQ-14).

Increment 1, after the OQ-14 architecture update. Realises: OQ-14 obligation, AD-6 trusted identity source, AD-7 authority validation, OQ-1 team-only. Inventory: C71 (membership part).

**Acceptance Criteria:**

**Given** the auth module design from the architecture update
**When** a person signs in to Inquello
**Then** the session carries an Inquello identity with Workspace memberships, audit-team role(s) and Engagement memberships stored in the domain, and every domain command receives that identity as the acting identity
**And** the sign-in mechanism, token format and hosting follow the architecture update and are not chosen in this story.

**Given** an internal-audit Workspace and an external-audit Workspace
**When** memberships are modelled
**Then** the internal model records the audit function and its reviewers, the external model additionally records the client entity relationship and engagement-level independence attributes, and the difference is visible in S09
**And** neither model hard-codes a firm hierarchy; roles are policy-configured.

**Given** a person who is not a member of an Engagement
**When** they attempt to open, search or resume one of its Tasks
**Then** the action is prevented without disclosing the Task's content, and the denial names the missing membership (NFR-3).

**Given** no guest role exists in V1 (OQ-1)
**When** roles are listed
**Then** only audit-team and reviewer roles are offered and external exchange happens through exports, not guest accounts.

### Story 2.2: Keep inference-provider sign-in separate from Inquello identity

As an administrator,
I want provider sign-ins (ChatGPT subscription, API key, Azure Foundry/Azure OpenAI, Bedrock, GCP/Vertex, gateway, local; Claude pending) to select only the inference route,
So that a provider session never grants or revokes any Inquello authority (OQ-14, AD-7, AD-8).

Increment 1, after the OQ-14 architecture update. Realises: OQ-14 separation, AD-7 credential facilities, UX-DR40 provider state. Inventory: C53, C54, C54A, C55, C56, C57 (credential handling part).

**Acceptance Criteria:**

**Given** a user signed in to Inquello but not to any provider
**When** they open a Task
**Then** they can organise, search and inspect work, and S07 states that no inference route is available without implying the product lacks the capability.

**Given** a provider sign-in completes
**When** its state is displayed
**Then** S07 shows the provider session separately from the Inquello identity, with the effective route and its capability limits, and no Workspace, Engagement or review permission changes.

**Given** provider credentials are stored
**When** the agent runs tools, writes artifacts, exports or logs
**Then** the credentials are held in the trusted runtime credential facility or adapter and never appear in model context, tool subprocess environments beyond the adapter, artifacts, exports or logs (verified by a negative test).

**Given** a provider session expires or is revoked
**When** the user continues
**Then** Inquello authority is unchanged, the Task keeps its retained work, and the user is offered the applicable reconnect action.

### Story 2.3: Bound what a Task can read, change and contact

As an Internal Auditor,
I want a Task's permission profile explained as which evidence it can read, where it can write and which destinations it can contact,
So that I understand its reach without reading sandbox policy syntax (FR-33, C65).

Increment 1. Realises: FR-33 sandbox/permission profiles, AD-5, AD-8, OQ-13 local sandbox. Inventory: C65.

**Acceptance Criteria:**

**Given** an Engagement with a source folder and an output folder
**When** a Task starts under the default scoped profile
**Then** the agent can read the source folder, write only to the Engagement output folder and cannot change source extracts; the effective profile is shown in S07 in audit terms (sources, working copies, outputs, external destinations).

**Given** an operation outside the profile
**When** the agent attempts it
**Then** the operation is denied or escalated per policy, the denial names the boundary, and the Task continues with retained work.

**Given** the local OS sandbox inherited from Codex
**When** execution runs in V1
**Then** enforcement is local (OQ-13) and the Capability Contract records that no hosted sandbox exists; this is labelled "V2 revisit (OQ-13)".

**Given** a network restriction
**When** a tool contacts an unlisted destination
**Then** the attempt is blocked and reported with the destination named.

### Story 2.4: Approve scoped actions and apply command rules

As an Internal Auditor,
I want consequential actions presented as what will happen, to which destination, with what content, and command rules that allow, prompt or forbid,
So that permission to act is explicit and never confused with reviewing or approving audit work (FR-33, C66, C69).

Increment 1. Realises: UX-DR24 ApprovalCard, UX-DR51 permission meaning, AD-11 precondition identity. Inventory: C66, C69.

**Acceptance Criteria:**

**Given** the agent proposes an action requiring permission
**When** the ApprovalCard renders
**Then** it names the exact action, content or command, destination and consequences, offers permitted alternatives, and its primary button carries the action verb (for example "Send this request to [recipient]"), never a bare "Approve".

**Given** the user denies the action
**When** the Task continues
**Then** the denied action is not performed, no alternative widens scope, and unresolved work is preserved.

**Given** command rules allow, prompt or forbid command prefixes
**When** a matching command is attempted
**Then** the most restrictive matching rule wins, the decision and controlling rule are shown with the analysis action and destination described, and an allowed command still runs within the sandbox profile.

**Given** the inherited automatic approval reviewer is enabled by policy
**When** it evaluates a request
**Then** it operates under the same sandbox and policy, cannot widen access, and its decision is labelled as an automated permission review, not analytical review or Professional Approval.

### Story 2.5: Show effective managed policy and represent broader modes explicitly

As an administrator,
I want organisational managed policy to be computed and shown for each Task and environment, with any no-prompt or full-access mode visible only when policy permits it,
So that an action unavailable here is explained and a broad mode is never mistaken for approval (FR-33, C70).

Increment 1 for managed policy and broad-mode display. Deferred to Increment 2: prompt inspection (C68) and specialist cyber model access (C67), both subject to provider and client eligibility; A15 coverage for those routes remains unmet until then. Realises: AD-8, UX-DR40.

**Acceptance Criteria:**

**Given** organisation requirements, environment overrides and user configuration
**When** a Task starts or changes environment
**Then** S07 shows the effective policy for execution, tools, extensions and approval behaviour and names which organisation rule governs a restricted setting.

**Given** a full-access or no-prompt mode
**When** it is enabled
**Then** it requires explicit permitted configuration, its effective reach is shown on the Task, and it is never labelled as review or Professional Approval.

**Given** prompt inspection or specialist cyber access is configured later
**When** this story is verified
**Then** the Capability Contract lists both as not enabled, with eligibility verification required before enablement.

### Story 2.6: Treat evidence, pages, tool results and examples as data

As an Internal Auditor,
I want instructions found inside evidence, retrieved pages, tool results or examples to be recognised as content under examination,
So that a document telling the assistant to ignore an exception cannot change what I authorised (FR-34, C73, M1).

Increment 1. Realises: FR-34, AD-8 instruction/evidence separation, A07 (evidence-instruction part), SM-C3. Inventory: C73.

**Acceptance Criteria:**

**Given** the M1 evidence containing "ignore exceptions" and "bypass review" instructions
**When** the agent analyses it under the approved procedure
**Then** the exceptions are reported, review is not bypassed, and the investigation record marks the embedded instruction as evidence-originated content that was evaluated, not followed.

**Given** a retrieved web page or tool result containing instructions
**When** it enters context
**Then** the trusted task and policy instructions keep their authority and the content is attributed to its source.

**Given** a blocked or inspected action
**When** it is reported
**Then** the relevant limits are disclosed and the report does not claim that every untrusted input was detected.

### Story 2.7: Pass negative authority cases before any route is enabled

As an Internal Audit Manager,
I want a repeatable suite of negative tests across Workspaces, Engagements, Sources, delegation, memory, artifacts and sharing,
So that no route carries real data until prohibited access and actions are proven blocked (NFR-3, SM-C3, OQ-9).

Increment 1. Realises: NFR-3 negative tests, OQ-9 per-route eligibility gate, A14 (revocation part seeded, completed in Epic 12). Inventory: C65, C70, C72.

**Acceptance Criteria:**

**Given** two Workspaces
**When** a member of one attempts to read, search, recall or delegate into the other
**Then** every attempt is blocked and recorded; a folder label alone is never the isolation mechanism.

**Given** a route enabled in Increment 1
**When** the suite runs against it
**Then** the results are attached to that route's Capability Contract and the route is marked eligible for real data only after the suite passes and organisational eligibility is confirmed.

**Given** memory and recall shared within a Workspace (OQ-3)
**When** the suite runs
**Then** cross-Engagement recall within a Workspace succeeds and cross-Workspace recall fails, and both outcomes are recorded as expected.

## Epic 3: Attributable context and checkable analysis

An auditor brings folders, documents, data, images, selections and application snapshots into a Task with origin, version and saved/live scope visible; the assistant runs calculations, queries and scripts with retained inputs, parameters and derivations, and represents population, exclusions, sampling and actual Coverage honestly. FRs: FR-9, FR-10, FR-11, FR-12. Relevant NFRs: NFR-2, NFR-3, NFR-6, NFR-7. UX-DRs: UX-DR21, UX-DR22, UX-DR32, UX-DR44. AD rules: AD-6, AD-8, AD-9. Inventory: C18, C19, C20, C22, C24, C27, C33 (extraction tools).

### Story 3.1: Understand an existing work folder with precise references

As an Internal Auditor,
I want the assistant to read my Engagement folder (xlsx, docx, pptx, csv, pdf, text, images) and cite the sheet, range, page or passage behind each statement,
So that I can trace an explanation to the exact material (FR-9, C18).

Increment 1. Realises: FR-9, AD-8 origin/version, OQ-2 retained extracts, UX-DR22. Inventory: C18, C33.

**Acceptance Criteria:**

**Given** a folder with supported files
**When** the agent answers from them
**Then** each relied-on statement carries a reference to file, version/modified time and location (sheet and range, page, passage or slide), and the retained extract is stored with that reference rather than a full source copy (OQ-2).

**Given** a file that is inaccessible and a file that is unreadable
**When** the folder is examined
**Then** both are listed separately from the files actually searched, with the reason, and the answer states that Coverage excludes them.

**Given** the agent received only part of the requested material
**When** it reports
**Then** the result names the incomplete input set and does not describe it as full Coverage.

### Story 3.2: Use images and screenshots as attributable context

As an IT Auditor,
I want to supply screenshots and diagrams and have their provenance, capture context and interpretation uncertainty kept beside the analysis,
So that a visible configuration is never mistaken for proof of completeness or timing (FR-9, C22).

Increment 1. Realises: FR-9 visual material, AD-8. Inventory: C22.

**Acceptance Criteria:**

**Given** an attached screenshot of an access-administration screen and an approved-role matrix
**When** the user asks which visible entitlements differ
**Then** the answer lists differences with references to the image region and matrix row, and states that the image does not establish history, hidden records or the period in force.

**Given** an image without supplied provenance
**When** it is used
**Then** the analysis records capture time and source as unknown and labels conclusions accordingly.

### Story 3.3: Capture selections and application snapshots with saved or live scope stated

As an Internal Auditor,
I want to attach a selected file region or the current application window to a Task and have Inquello state whether it is saved file state or a live snapshot and when it was taken,
So that the agent and I never work from different versions unknowingly (FR-10, C27, C24).

Increment 1 for file selections and application snapshots. Deferred to Increment 2: browser annotations (C26, Epic 6) and composer predictions (C24, eligibility-limited beta); A16 coverage for those remains unmet. Realises: FR-10, AD-9 saved/live distinction.

**Acceptance Criteria:**

**Given** a selected range in a saved workbook
**When** it is attached
**Then** the attachment records file identity, version, the range and "saved state"; if the host exposes a live selection, it is recorded as "live state" with its time.

**Given** an application snapshot
**When** it is attached
**Then** the capture time, application/source identity and the coverage of the capture are recorded, and a snapshot older than the current file version is marked stale when the agent relies on it.

**Given** composer assistance is unavailable on this client
**When** the user types
**Then** no suggestion is shown and the Capability Contract records the feature as not enabled rather than silently absent.

### Story 3.4: Run calculations, queries and scripts with retained derivations

As an IT Auditor,
I want executable analysis to keep its code, input identifiers, parameters, reconciliation checks and outputs with the result,
So that another auditor can inspect and reperform the calculation (FR-11, C19, C33).

Increment 1. Deferred to Increment 2: Code Mode programmatic composition (C20, experimental, off by default); provenance through composed calls then. Realises: FR-11, AD-9 derivation retention, NFR-2, UX-DR44.

**Acceptance Criteria:**

**Given** a request to recalculate expected payroll from approved inputs
**When** the agent runs a script
**Then** the script, its input file identities and versions, parameters and output are stored as an Analysis linked to the Task, and the result references that Analysis.

**Given** an input file changes after the Analysis ran
**When** the Task continues
**Then** the agent either recomputes and shows the difference or marks the prior result stale with the changed input named.

**Given** a script fails
**When** the failure is shown
**Then** the error output is available in S11 for technical users, the ordinary thread states what failed and what retained outputs exist, and no partial output is presented as a result.

### Story 3.5: Reconcile the W1 ledger-to-bank fixture exactly

As an Internal Auditor,
I want the W1 reconciliation to produce the exact expected matches, totals and excess, and to update correctly when a saved input changes,
So that analytical reliability is demonstrated on a known result before real data (FR-11, FR-12, A03, NFR-2).

Increment 1. Realises: A03, UJ-3 steps 1 to 2, UX-DR32.

**Acceptance Criteria:**

**Given** the W1 ledger (five rows) and bank (six rows) inputs
**When** the reconciliation runs
**Then** rows are assigned L01 to L05 and B01 to B06 in order, equal reference/amount pairs match by ascending source ID so L03 matches B03 and B04 stays unmatched, three exact matches are reported, totals are 4,600 and 4,750, and the excess is 150
**And** all five ledger and six bank source rows are preserved in the workbook.

**Given** R5 is saved as 800 in the ledger file
**When** the user asks Inquello to continue
**Then** the ledger total becomes 4,700 and the excess 50, the difference is explained against the changed input, and the duplicate B03/B04 identity remains traceable.

**Given** the workbook contains named ranges, comments, formatting and an unrelated sheet
**When** the reconciliation writes results
**Then** those remain intact and no source transaction is changed.

### Story 3.6: Show population, exclusions, sampling and actual Coverage

As an Internal Audit Manager,
I want every analysis to show whether it was full-population or sample-based, the counts, exclusions, duplicate treatment, sampling parameters and the Coverage actually examined,
So that a successful run never implies complete Coverage (FR-12, UX-DR32).

Increment 1. Realises: FR-12, AD-9, NFR-2, Workbook composition.

**Acceptance Criteria:**

**Given** an Analysis over a population
**When** it is displayed in Workbook
**Then** the view shows population count, excluded items with reasons, duplicate treatment, the chosen Method's sampling parameters if sample-based, and examined Coverage as a count and share, with a semantic table whose rows link to evidence.

**Given** the user's Method does not define sampling
**When** sample-based work is requested
**Then** Inquello asks for or records the Method's parameters and never applies an invented universal sampling rule.

**Given** Workbook content wider than the panel
**When** it renders
**Then** horizontal overflow is reachable by keyboard with a labelled boundary and values are not shrunk to fit.

### Story 3.7: Inspect technical investigation detail without forcing it on ordinary review

As an IT Auditor,
I want a technical surface within the Active and Review surfaces showing queries, scripts, outputs, errors and run coverage,
So that technical detail is available on demand while ordinary review stays readable (UX-DR44, FR-11).

Increment 1. Realises: S11 states, console region, AD-5 preview separation.

**Acceptance Criteria:**

**Given** a Task with executed analysis
**When** the user opens the technical view
**Then** selected source, output or error is focused, "no run" is distinct from "run with no findings", and the console region uses the dark ink surface locally without a global dark theme.

**Given** an interrupted execution or unavailable specialist service
**When** the view renders
**Then** retained outputs and the safe resume or re-run scope are shown explicitly.

## Epic 4: Editable artifacts, environments and alternatives

An auditor creates and revises workbooks, documents, presentations, CSV datasets, scripts and visuals, inspects previews and format-aware changes, continues the same saved file in Excel, Word or PowerPoint and returns with external edits detected; chooses where work executes separately from inference; compares isolated alternatives and promotes deliberately; prepares visuals and published or hosted outputs under audience authority. FRs: FR-5, FR-6, FR-13, FR-14. Relevant NFRs: NFR-1, NFR-4, NFR-5, NFR-7, NFR-9. UX-DRs: UX-DR25, UX-DR34, UX-DR43 (publication part), UX-DR45 and UX-DR50 (Excel handoff). AD rules: AD-7, AD-8, AD-9, AD-11. Inventory: C07, C10, C21, C23, C30, C31, C32, C47, C58.

### Story 4.1: Create and revise workbooks and CSV with format-aware changes

As an Internal Auditor,
I want Inquello to create and revise .xlsx and .csv files preserving formulas, named ranges, comments, formatting and unrelated sheets, and to show changes as cells and formulas,
So that I can review what changed and keep working in Excel (FR-13, NFR-1, C21, C31, C58).

Increment 1. Realises: FR-13 spreadsheet features, AD-9, UX-DR25, A04 (preservation part). OQ-6 formats.

**Acceptance Criteria:**

**Given** an existing workbook with formulas, a named range, comments, number formatting and an unrelated sheet
**When** the agent revises one sheet
**Then** the reopened workbook retains every untouched feature byte-meaningfully (formulas still formulas, named range intact, comments present, unrelated sheet unchanged) and the change view lists changed cells with before/after values and formulas.

**Given** a feature outside the declared supported set (for example a macro or external link)
**When** a change would alter or drop it
**Then** the limit is disclosed before any destructive write and the user can cancel or proceed knowingly.

**Given** a stale calculated value cache
**When** the agent reads the workbook
**Then** it detects that cached values may not match formulas and says so before relying on them (A04).

### Story 4.2: Create and revise Word documents preserving review metadata

As an Internal Auditor,
I want .docx workpapers created and revised with comments, tracked changes, footnotes, tables, bookmarks and attribution preserved, and passage-level change views,
So that reviewers keep their marks and I can continue in Word (FR-13, NFR-1, W2 preservation).

Increment 1. Realises: FR-13 document features, AD-9, A05 (preservation part), UX-DR25.

**Acceptance Criteria:**

**Given** the W2 workpaper with comments, a tracked deletion, a footnote, a table, a bookmark and author attribution
**When** the agent revises rejected wording
**Then** the reopened document retains all of them with attribution intact and the change comparison shows the revised passages.

**Given** a citation in the document points to missing evidence
**When** the document is analysed
**Then** the broken citation is reported with its location.

**Given** an attribution or feature cannot be preserved by the supported writer
**When** a revision is proposed
**Then** the limit is disclosed before change and a reviewable alternative (for example a proposed-text comment) is offered.

### Story 4.3: Create and revise presentations preserving theme, charts and notes

As an Internal Auditor,
I want .pptx options papers created and revised with the declared theme, chart references and speaker notes preserved and assertions linked to analysis,
So that an advisory presentation stays editable and traceable (FR-13, FR-14 visuals, A17).

Increment 1. Realises: FR-13 presentation features, A17, UJ-6 step 3, NFR-1.

**Acceptance Criteria:**

**Given** a presentation with a theme, a chart bound to analysis data and speaker notes
**When** the agent revises slides
**Then** the reopened file retains theme, chart references and notes, and each material assertion slide links to its Analysis or Source.

**Given** an estimate without support
**When** it appears on a slide
**Then** it is labelled as an unsupported estimate in the slide and the review view.

### Story 4.4: Continue the same saved file in Excel, Word or PowerPoint and return

As an Internal Auditor,
I want to open the real saved file in its application, edit and save, and have Inquello detect my changes on return and recompute or mark results stale, raising a conflict when edits collide,
So that external editing is a normal part of the workflow and never loses my work (FR-13, UJ-3 steps 3 to 5, A04, NFR-4).

Increment 1. Realises: FR-13 external continuation, AD-9 version comparison, UX-DR45 and UX-DR50 handoff, UX-DR47 external-editing microcopy. Inventory: C01 (open-in-tool), C21, C31.

**Acceptance Criteria:**

**Given** a saved workbook in the Task
**When** the user chooses "Open this saved workbook in Excel"
**Then** the actual file opens in the registered application, or a handoff failure is shown if no supported route exists; a toast alone never completes the step.

**Given** the user saves an external edit and asks Inquello to continue
**When** the Task resumes
**Then** Inquello compares file version and content, lists the changed inputs, preserves unrelated changes, and either recomputes or marks the earlier result stale with the reason.

**Given** the agent has a pending proposed change and the file changed externally in the same region
**When** the proposal would be applied
**Then** the conflict blocks only that write, both versions are identifiable, and the user can compare, reload or leave the proposal unapplied; no silent overwrite occurs.

**Given** the external save state is uncertain (for example the application reported an error)
**When** Inquello reports
**Then** it says the save outcome is unconfirmed and asks the user to check before continuing.

### Story 4.5: Choose the execution environment and see inference location separately

As an IT Auditor,
I want to select an approved environment for a Task and see where execution happens separately from where model processing happens,
So that a local window is never taken as proof of local inference (FR-5, NFR-8, C10, C07).

Increment 1 for the local environment. Deferred to Increment 2: remote and cloud environments (C07) pending the remote execution supply gate (service, identity, context and eligibility named); A15 remains unmet for those environments. Realises: FR-5, AD-8 route distinction, UX-DR40.

**Acceptance Criteria:**

**Given** a Task
**When** its environment panel renders
**Then** it shows execution location (local host) and inference location (provider/deployment from Epic 8 or "no route") as separate facts, and the unavailable remote environments are listed as not enabled with their gate.

**Given** an environment becomes unavailable
**When** the user starts work
**Then** the failure names the environment and the Task is not silently moved elsewhere.

### Story 4.6: Work in isolated alternatives and promote deliberately

As an Internal Auditor,
I want to analyse alternatives in isolated copies of an artifact with a recorded baseline, compare results and promote selected changes while the original is preserved,
So that competing approaches never overwrite each other or shared files (FR-6, C47, C10 worktree mode).

Increment 1 for local isolated copies of supported artifacts. Deferred to Increment 2: Git worktree isolation for versioned text material (C47 upstream mechanism). Realises: FR-6, AD-9 promotion with origin history, A08 (write isolation part).

**Acceptance Criteria:**

**Given** a baseline workbook
**When** the user creates two isolated alternatives
**Then** each copy records its origin artifact and baseline version, works in its own location, and the baseline remains unchanged.

**Given** a completed alternative
**When** the user promotes it
**Then** Inquello compares the baseline version with the current shared file, applies the promotion only if unchanged or after explicit reconciliation, and records the promotion history on the artifact.

**Given** concurrent edits to the shared file during the alternative's life
**When** promotion is attempted
**Then** the conflict is shown with both versions and nothing is replaced until resolved.

### Story 4.7: Generate explanatory visuals labelled distinct from evidence

As an Internal Auditor,
I want to generate or edit explanatory illustrations for reports and presentations,
So that an illustration is useful but never mistaken for captured evidence (FR-14, C23).

Increment 1. Realises: FR-14 visuals, inherited image generation mechanism.

**Acceptance Criteria:**

**Given** a request for an illustration of role separation
**When** the image is generated
**Then** it is saved as an artifact labelled "explanatory visual, generated" with its prompt and version, and the thread states it is not observed evidence.

**Given** generation is unavailable on the current route
**When** requested
**Then** the limit is stated and no substitute route is used silently.

### Story 4.8: Prepare published or hosted outputs under audience and destination authority

As an Internal Audit Manager,
I want to build a reviewable exception dashboard or small tool, inspect its data, audience and destination, and publish only through an authorised route with the outcome verified,
So that generation, publication and verified delivery stay distinguishable (FR-14, C32, E16 writeups).

Increment 2. Deferred: hosting route selection and eligibility (supply gate: remote execution and connected services); until then A16 coverage for hosted outputs is unmet. Realises: FR-14 hosted outputs, AD-11, UX-DR43.

**Acceptance Criteria:**

**Given** a dashboard draft built from an Analysis
**When** it is reviewed
**Then** it shows source period, calculation definitions and evidence links, and is marked generated until published.

**Given** a publish request
**When** the ApprovalCard shows audience, included content and destination
**Then** publication proceeds only through the configured route, the resulting state is read back, and the artifact state becomes published or uncertain accordingly; a broader fallback audience is never used to make publication succeed.

## Epic 5: Review, correction and human decisions

A reviewer opens the selected item in S03, traces results to evidence and derivations, requests scoped corrections, applies Keep or Revert on proposals with affected outputs visible, and rechecks; the shared reviewed basis marks decision applicability stale when evidence or Method changes; the responsible human and reviewed version are identifiable; technical specialists retain code, configuration and security review. FRs: FR-17, FR-18, FR-35. Relevant NFRs: NFR-2, NFR-3, NFR-5, NFR-7. UX-DRs: UX-DR12, UX-DR20, UX-DR21, UX-DR25, UX-DR35, UX-DR42 (responsibility part), UX-DR51. AD rules: AD-6, AD-7, AD-9, AD-13. Inventory: C28, C29, C30, C58, C67, C71 (assignment part), E01, E03, E04, E10 to E14.

### Story 5.1: Request a review with evidence-anchored findings

As an Internal Audit Manager,
I want to ask for a review of a workpaper, workbook or change and receive prioritised findings anchored to cells, passages, records and evidence under the Engagement's criteria,
So that review notes land on the affected material without editing it (FR-17, C28, E01, E03).

Increment 1. Realises: FR-17 review request, NFR-2 reviewer burden recording, UX-DR21. Inventory: C28, E01, E03.

**Acceptance Criteria:**

**Given** a revised reconciliation workbook
**When** a review is requested
**Then** findings list an excluded account, a broken formula and an unsupported conclusion, each with cell or passage anchors, the criterion applied and the evidence or gap, and nothing in the file is changed by the review.

**Given** Engagement review criteria and a one-off focus comment
**When** the review runs
**Then** the applicable criteria version and the one-off focus are shown with the findings, and unsupported findings are labelled separately from established errors.

**Given** findings
**When** they are shown
**Then** significance follows the Engagement's scheme, not developer severity labels, and no finding is closed or approved by the review itself.

### Story 5.2: Review evidence, choose a treatment and Keep or Revert a proposal

As an Internal Audit Manager,
I want the Review surface to show the selected evidence, the agent's explanation with claim types, treatment choices, my rationale and the affected-output changes, and to let me Keep or Revert a proposed change after a version check,
So that a local change decision is explicit and separate from professional sign-off (FR-17, UX-DR35, C30, C58).

Increment 1. Realises: S03 composition and states, UX-DR16 Choice, UX-DR14 TextField retention, UX-DR25 DiffLine, UJ-4 step 3.

**Acceptance Criteria:**

**Given** a review item opened from Inbox
**When** S03 renders
**Then** it opens the selected evidence and version (never a fixed demo item), focuses its heading, shows observation, calculation, suggestion, decision and gap tags, offers treatment Choice options and a rationale field, and lists affected outputs as DiffLines.

**Given** a treatment and rationale entered
**When** the user chooses Keep
**Then** the current artifact version is checked against the proposal's base version, the declared local change is applied only if unchanged, the rationale is saved with person, scope and version, and the state is "applied locally", not Professional Approval.

**Given** Revert
**When** chosen
**Then** the proposal outcome is recorded as reverted and the original remains unchanged.

**Given** a save or validation failure
**When** it occurs
**Then** the entered rationale and choice are retained in the session and the failing field is identified.

**Given** no review items or inaccessible items
**When** S03 opens
**Then** the two states are shown distinctly.

### Story 5.3: Maintain the reviewed basis and mark affected decisions stale

As an Internal Audit Manager,
I want every review decision to reference a reviewed-basis revision (outputs, Sources, Method and departures, policy versions) and to see decisions marked stale when any of those change,
So that a prior decision is preserved but never silently relied on after its basis moved (AD-6, AD-9, FR-17, NFR-7).

Increment 1. Realises: reviewed-basis revision, stale applicability, warning when a revision affects reviewed work (C58 enhancement).

**Acceptance Criteria:**

**Given** a recorded review decision
**When** a relied-on Source, Analysis, Method version or policy version changes
**Then** the decision's applicability is marked stale with the changed element named, the historical decision and its attribution remain immutable, and the Task shows which outputs and approvals are affected.

**Given** a stale decision
**When** the user attempts to deliver work relying on it
**Then** delivery is blocked until the applicability is resolved under the Method, and the comparison of old and new basis is available.

### Story 5.4: Assign Task and Human Review responsibility with attribution

As an Internal Audit Manager,
I want to assign who prepares and who reviews a Task within Workspace and Engagement membership, and have each review decision record the person, scope and reviewed version,
So that responsibility is identifiable without a hard-coded hierarchy (FR-35, OQ-1, C71).

Increment 1. Realises: FR-35, UX-DR42 responsibility part, UX-DR12 Avatar decided state, AD-6 attribution, AD-13 external authority link. Depends on Story 2.1 identities.

**Acceptance Criteria:**

**Given** an Engagement Task
**When** a manager assigns a preparer and a reviewer from Engagement members
**Then** both responsibilities are stored with the assigning person and time, multiple responsibilities may coexist where policy permits, and non-members cannot be assigned.

**Given** a reviewer records a decision
**When** it is saved
**Then** the decision names the person, scope and reviewed artifact version, the Avatar shows the decided state only for that recorded decision, and the Task states whether the Method requires formal acceptance in the external authority (recorded as pending until confirmed there).

**Given** no assignee
**When** S09 renders
**Then** "no assignee" is shown as a scoped result distinct from "no access".

### Story 5.5: Correct, recheck and keep closure separate; pass W2

As an Internal Auditor,
I want to apply an authorised correction, have the agent recheck the result and see that the Finding stays open until the authorised person decides,
So that a corrected artifact is never confused with a closed matter (FR-17, E04, E14, A05).

Increment 1. Realises: FR-17 correct/recheck, A05, UJ-4 steps 4 to 5, M1 "case correction is not a team rule" (link to Epic 7).

**Acceptance Criteria:**

**Given** the W2 workpaper (policy v1, threshold 5,000, order 7,800, approvals A before and B after)
**When** the analysis runs
**Then** it reports one prior and one later approval, preserves review metadata and evidence links, and Professional Approval remains pending until the authorised reviewer acts.

**Given** policy v2 raises the threshold to 10,000
**When** reassessment is requested
**Then** the agent establishes the effective period of v2 before reassessing and reports which outputs the change affects.

**Given** a correction is applied and rechecked
**When** the recheck passes
**Then** the Finding's status does not change automatically and the recheck result is attached as evidence for the human decision.

### Story 5.6: Retain code, configuration and security review for IT audit

As an IT Auditor,
I want to inspect code and configuration directly, run permitted security analysis, keep saved scans, findings and history, and reassess an inherited backlog with original IDs preserved,
So that technical assurance work keeps the same evidence and review discipline (FR-18, C28, C29, C67, E10 to E13).

Increment 1 for direct code/configuration inspection and script review (A06 technical part). Deferred to Increment 2: security scan workbench, change/bulk scans, backlog triage and specialist cyber model access (eligibility); A16 coverage for those remains unmet. Realises: FR-18, AD-8 eligibility visibility.

**Acceptance Criteria:**

**Given** authorised application code or configuration
**When** the IT Auditor requests inspection
**Then** the agent reads it, returns findings anchored to files and lines with evidence, and the source and scripts remain accessible in S11.

**Given** the W3 access-review population
**When** technical review is requested alongside it
**Then** script results and findings are available with their coverage limits and the specialist route used is named.

**Given** scan and backlog features are not yet enabled
**When** the capability list renders
**Then** they are shown as not enabled with their eligibility gate, not as absent.

## Epic 6: Research and permitted interfaces (local)

An auditor asks for research with citations and retrieval context, and uses the local built-in browser profile, browser annotations, site-exposed tools and Computer Use under the acting identity and permitted scope. FRs: FR-15, FR-16. Relevant NFRs: NFR-3, NFR-7, NFR-8. UX-DRs: UX-DR45 (browser/computer part), UX-DR47. AD rules: AD-8, AD-11. Inventory: C25, C26, E20. Gate: OQ-13 (local in V1; hosted browser or sandbox is a V2 revisit).

### Story 6.1: Research with attributable sources and labelled limits

As an Internal Auditor,
I want research answers to cite each public or permitted source with its retrieval time and to label estimates and source limitations,
So that material claims can be checked and retrieved text never directs the Task (FR-15, C25 search).

Increment 1. Realises: FR-15, FR-34 link, UJ-1 and UJ-6 research steps, A01, A02.

**Acceptance Criteria:**

**Given** a research question
**When** the agent answers using web search
**Then** each material claim carries a reference with URL/title, retrieval time and the quoted or paraphrased basis, and estimates are labelled with their assumption.

**Given** a retrieved page containing instructions
**When** it is used
**Then** the Task's authority is unchanged and the instruction is treated as content (Story 2.6).

**Given** search is unavailable on the current route
**When** requested
**Then** the limit is stated without silent route substitution.

### Story 6.2: Inspect pages in the local built-in browser profile

As an Internal Auditor,
I want the agent to open and inspect public pages and local tools in a separate local browser profile,
So that observations carry source location and time while no signed-in account is implied (FR-16, C25, OQ-13).

Increment 2. Realises: FR-16 built-in browser, OQ-13 local route, AD-8.

**Acceptance Criteria:**

**Given** a browser task
**When** the agent inspects a page
**Then** the observation records URL, time and the acting profile, and the Task shows that the browser route is local.

**Given** a page requiring a signed-in session
**When** encountered
**Then** the agent reports the unavailable context rather than guessing or using another profile.

### Story 6.3: Anchor questions to selected page content and site-exposed tools

As an Internal Auditor,
I want to select a passage in a supported browser surface or use a site's exposed tools with the page identity preserved,
So that a question or action is tied to the exact material and permission boundary (FR-10, FR-16, C26, E20).

Increment 2. Realises: browser annotations, WebMCP site tools, UX-DR45 part. Deferred until this story: A16 browser-context coverage.

**Acceptance Criteria:**

**Given** a selected clause in an online procedure
**When** sent to the Task
**Then** the selection, its page identity and available metadata are attached as context, distinguishable from the user's instruction.

**Given** a site exposes tools
**When** the agent uses one
**Then** the page/source identity and permission boundary are recorded, changed state is verified, and tool disappearance on navigation is reported.

### Story 6.4: Operate supported applications with Computer Use under the acting identity

As an IT Auditor,
I want the agent to observe or operate a permitted application in a test environment with each action's account, destination and outcome identified,
So that a visible session never becomes blanket authority (FR-16, C25 Computer Use).

Increment 2. Realises: FR-16 computer interaction, AD-11 outcome verification, OQ-13 local only. Deferral recorded: hosted browser or hosted sandbox, "V2 revisit (OQ-13)".

**Acceptance Criteria:**

**Given** an authorised vendor-onboarding test workflow
**When** the agent operates it
**Then** each step records the application, acting account, the action and the observed outcome, and consequential steps require the ApprovalCard.

**Given** an uncertain action outcome
**When** reported
**Then** it is marked uncertain and the user is asked to verify before any retry.

**Given** the platform's foreground or lock conditions
**When** Computer Use runs
**Then** the limit is disclosed and the Capability Contract records platform-specific conditions.

## Epic 7: Reusable Methods and departures

An auditor turns examples and instructions into reusable skills and Methods with visible version, parameters and dependencies, records Task-specific departures separately from maintained guidance, and sees affected outputs when a Method changes; client evidence never silently becomes shared Method or memory. FRs: FR-19, FR-20. Relevant NFRs: NFR-3, NFR-7. UX-DRs: UX-DR39. AD rules: AD-10. Inventory: C37, C38, C39, C52, C36 (distribution). Gate: OQ-4 inherited mechanisms.

### Story 7.1: Apply standing instructions and Workspace guidance with provenance

As an Internal Auditor,
I want Workspace, Engagement and folder instructions applied to my Task with their source shown, and any material instruction labelled as policy, procedure, memory or current request,
So that I know which conventions shaped a result and which authority each has (FR-19, FR-20, C39, C52).

Increment 1. Realises: inherited instruction discovery, AD-10 knowledge boundaries, UX-DR39.

**Acceptance Criteria:**

**Given** Workspace and Engagement instruction files
**When** a Task runs
**Then** the effective guidance list shows each applied instruction with its file and scope, and conflicts are shown rather than silently resolved.

**Given** a material instruction influencing an output
**When** the output is inspected
**Then** its origin is labelled as policy, procedure (Method), memory or the current request.

### Story 7.2: Author, select and run skills as audit procedures

As an Internal Auditor,
I want to author or select a skill with criteria references, required inputs, expected outputs and verification steps, run it on my inputs and see its version, parameters and missing dependencies,
So that a repeatable procedure is explainable and checkable (FR-19, C37, C36, S06).

Increment 1. Realises: FR-19 skills, OQ-4 distribution via Workspace/local/plugin skills and marketplaces, UX-DR39 states.

**Acceptance Criteria:**

**Given** a bank-reconciliation skill with required inputs
**When** invoked with this month's files
**Then** the Task records the skill identity, version and parameters, runs its helpers, and produces the declared outputs with verification evidence.

**Given** a missing dependency (tool, reference or file)
**When** the skill starts
**Then** the missing item is named and the draft Task is kept.

**Given** S06
**When** no reusable Method exists
**Then** creation or selection from permitted guidance is offered; incompatible version and denied distribution are distinct states.

### Story 7.3: Record Task-specific departures separately from Method changes

As an Internal Auditor,
I want to record what differs from the Method on this Task, the Method version, my rationale and the affected scope, without changing the maintained Method,
So that departures are visible with the relied-on work and never become policy by accident (FR-20, AD-10).

Increment 1. Realises: FR-20 departures, UJ-7 step 2.

**Acceptance Criteria:**

**Given** an applied Method
**When** the user records a departure
**Then** the departure stores Method identity and version, what differs, rationale, affected outputs, and the person; the Method itself is unchanged.

**Given** a denied departure
**When** policy rejects it
**Then** it remains unapplied with its draft rationale preserved and no override occurs.

**Given** a relied-on output
**When** it is inspected or reviewed
**Then** its recorded departures are shown beside it.

### Story 7.4: Identify affected outputs when a Method changes; pass M1

As an Internal Audit Manager,
I want a new Method version to identify outputs produced under the old version, and a case correction to stay with its case unless deliberately promoted,
So that method evolution is controlled and reviewable (FR-20, A07).

Increment 1. Realises: A07, M1 fixture, AD-10 no silent promotion, UJ-7 steps 3 to 5.

**Acceptance Criteria:**

**Given** procedure v1 used to draft an output, with the M1 evidence
**When** v2 is introduced
**Then** the outputs produced under v1 are listed as affected with the changed elements, approved guidance identity and loaded references are recorded, and embedded evidence instructions were treated as untrusted (Story 2.6).

**Given** a correction made on one Task
**When** the Task completes
**Then** the correction is not written into the shared Method; promoting it is a separate explicit action under the team's distribution mechanism.

### Story 7.5: Teach a routine by demonstration where eligible

As an Internal Auditor,
I want to demonstrate a repeatable routine and get an inspectable draft skill that I refine and validate on a second case before reuse,
So that demonstrated routines become reusable without hidden assumptions (FR-19, C38).

Increment 2. Deferred: the reference mechanism is macOS and Computer-Use dependent; eligibility per host is verified before enablement, and A16 coverage for demonstration-to-skill is unmet until then.

**Acceptance Criteria:**

**Given** a recorded demonstration
**When** the draft skill is generated
**Then** its steps, inputs and verification guidance are inspectable and the captured assumptions are listed for review.

**Given** replay on a second representative case
**When** it runs
**Then** replay exceptions are reported and the skill is marked validated only after the user accepts the second-case result.

## Epic 8: Capabilities, connections and processing routes

An auditor discovers and uses built-in tools, connected apps, MCP servers, plugins and marketplaces with identity, dependencies and limits visible; teams use hooks, app-server integration and client-supplied tools; every documented processing route reports its capabilities without silent substitution, with reasoning/speed choices and inherited usage limits inspectable in S07. FRs: FR-21, FR-22, FR-29, FR-30. Relevant NFRs: NFR-3, NFR-6, NFR-8, NFR-9. UX-DRs: UX-DR40. AD rules: AD-2, AD-5, AD-8, AD-12, AD-14. Inventory: C33, C34, C35, C36, C40, C41, C42, C53, C54, C54A, C55, C56, C72. Gates: OQ-4, OQ-5, OQ-9, OQ-14 (Claude route).

### Story 8.1: Discover tools, apps, MCP servers and plugins with their state and limits

As an Internal Auditor,
I want S07 to list built-in tools, connected apps, MCP servers and installed plugins with identity, dependencies, installed/enabled/callable state and limits,
So that missing access is never mistaken for missing functionality (FR-21, C33 to C36).

Increment 1 using inherited Codex mechanisms (OQ-4). Realises: FR-21, UX-DR40 states.

**Acceptance Criteria:**

**Given** configured capabilities
**When** S07 renders
**Then** each capability shows its source (built-in, app, MCP server, plugin), version, dependencies, effective permission and whether it is installed, enabled and callable now, and an unavailable connection explains the missing route.

**Given** a plugin package is installed
**When** its tools are listed
**Then** installation grants no connector credentials; a tool needing a connection shows that connection as unauthenticated until the user connects it.

**Given** an expired or revoked connection
**When** it is shown
**Then** the applicable next action is offered without silent fallback.

### Story 8.2: Attach connector identity, entity scope and extraction context to evidence

As an Internal Audit Manager,
I want evidence retrieved through a connected app or MCP tool to carry the acting account, entity scope and extraction time,
So that a complete-looking dataset is read with the principal that produced it (FR-21, C34, C35, C72).

Increment 1. Realises: AD-8 source identity, NFR-7, A10 (identity part).

**Acceptance Criteria:**

**Given** a read-only database tool
**When** it returns a population
**Then** the result records source identity, the account used, entity scope and observation time, and the thread shows them before the data is relied on.

**Given** a write-capable tool
**When** a mutation is proposed
**Then** the acting account and destination are shown in the ApprovalCard and the write is reviewed separately from reads.

### Story 8.3: Run hooks with observable outcomes and defined mandatory-check consequences

As a method owner,
I want lifecycle hooks (before/after tool, compaction, task and subagent events) whose success, failure and blocking decisions are visible, with the consequence of a failed mandatory audit check defined,
So that a claimed check is never silently skipped (FR-22, C40).

Increment 1 (inherited hooks) with the audit mandatory-check consequence. Realises: FR-22 hooks, AD-14 evidence.

**Acceptance Criteria:**

**Given** a hook that checks an exception workbook records its population source and parameters
**When** it runs after the write
**Then** the outcome (passed, warning, blocked, failed to run) is shown on the Task and recorded.

**Given** a mandatory check hook that fails to run
**When** the Task continues
**Then** the configured consequence applies (for example the artifact is marked "checks incomplete" and delivery is blocked) rather than the upstream default of proceeding silently.

**Given** an unsupported hook version
**When** loaded
**Then** it fails intelligibly with the version named.

### Story 8.4: Supply client tools bound to the current artifact

As an IT Auditor,
I want the workbench to expose task-specific tools (for example fetch the selected sample's evidence references) bound to the current artifact and Engagement,
So that bounded operations run under host authority on the right material (FR-22, C42, C41).

Increment 2. Deferred: the dynamic-tools API is experimental and needs host-side enforcement verification; A16 coverage for client-supplied tools unmet until then.

**Acceptance Criteria:**

**Given** a workpaper view exposing a tool
**When** the agent calls it
**Then** the host validates the arguments against the current artifact/entity identity, returns a structured result or error, and rejects identifiers outside the Task's scope.

### Story 8.5: Use permitted processing routes with effective route facts

As an administrator,
I want each documented route (ChatGPT/OpenAI sign-in, API key, Azure Foundry/Azure OpenAI, Bedrock, GCP/Vertex, organisation gateway, local model; Claude pending the OQ-14 architecture update) configurable with its effective provider, deployment and capability limits shown per Task,
So that an unsupported operation never silently switches route (FR-29, C53 to C57, OQ-9).

Increment 1: the inherited default route and one organisation-approved route chosen by the validating team, each passing Story 2.7 and per-route eligibility before real data. Increment 2: each remaining route tested individually; A15 remains unmet for untested routes. Realises: FR-29, AD-8 route preservation, NFR-8, NFR-9, UX-DR40.

**Acceptance Criteria:**

**Given** a configured route
**When** a Task uses it
**Then** S07 and the Task show provider, deployment or endpoint identity, region where applicable, and the capabilities available on that route, with execution, inference and connector data flows listed separately.

**Given** an operation the route does not support
**When** requested
**Then** the request fails with the limit named and no other route is used.

**Given** provider credentials
**When** configured
**Then** they are supplied outside prompts and artifacts (Story 2.2) and the route's eligibility status (not verified / verified for synthetic / verified for real data) is recorded in its Capability Contract.

### Story 8.6: Choose reasoning and speed and inspect inherited usage limits

As an Internal Auditor,
I want to choose effort and speed per Task, see consumption across main and delegated work, and have inherited plan or Workspace limits enforced visibly,
So that costs are attributable to deliverables and a stop is explained (FR-30, C53, OQ-5).

Increment 1. Realises: FR-30, NFR-6 visible enforcement, SM-3 attribution.

**Acceptance Criteria:**

**Given** a Task
**When** the user changes reasoning or speed
**Then** the setting is stored with the resulting outputs so two runs can be compared, and the choice is never presented as evidence quality.

**Given** an inherited usage limit is reached
**When** work would exceed it
**Then** the Task stops or escalates with the limit and next action explained, and retained work is preserved.

**Given** a delivered artifact
**When** its cost is inspected
**Then** tool and model consumption for the Task, including failed or repeated runs, is attributable to it (SM-3).

## Epic 9: Delegation, alternatives and continuity

An auditor delegates bounded work to focused agents, consolidates results with disagreements and gaps visible, explores side chats and forks without losing origin, resumes compacted history with sources and decisions accessible, and controls memory contribution, memory use and activity recall separately. FRs: FR-25, FR-26, FR-27, FR-28. Relevant NFRs: NFR-3, NFR-4, NFR-7. UX-DRs: UX-DR41. AD rules: AD-6, AD-7, AD-8, AD-9, AD-10. Inventory: C12, C45, C46, C48, C49, C50, C51. Gate: OQ-3 (shared within a Workspace, isolated between Workspaces; not configurable).

### Story 9.1: Delegate bounded work to focused agents and consolidate with disagreements visible

As an IT Auditor,
I want to delegate population analysis, criteria research, evidence inspection or workpaper review to separate agents, follow their progress, and get a consolidated result that shows sources, disagreements and unexamined scope,
So that parallel work is traceable and an agent review never looks like a human decision (FR-25, C45, A08).

Increment 2. Deferred until then: A08. Realises: FR-25, AD-7 write coordination, UJ-5 steps 2 to 4.

**Acceptance Criteria:**

**Given** three delegated agents checking approvals, recalculating interest and reviewing notifications
**When** they complete
**Then** each result carries its scope, source references and Method, the consolidation lists agreements, disagreements and gaps explicitly, and no count of agreeing agents is presented as corroboration.

**Given** two agents propose writes to the same artifact
**When** they finish
**Then** writes are coordinated through the domain or isolated into alternatives; no silent merge occurs.

**Given** an agent named "reviewer"
**When** its output is shown
**Then** it is labelled as agent output and cannot be recorded as a Human Review decision.

### Story 9.2: Explore side chats, forks and references without losing origin

As an Internal Auditor,
I want to open a side investigation or fork an alternative interpretation from the current context and bring a conclusion back with its branch reference, seeing which conclusion was adopted or superseded,
So that alternatives never masquerade as the accepted result (FR-26, C46, C13 fork).

Increment 2. Realises: FR-26, AD-6 branch references, UX-DR41.

**Acceptance Criteria:**

**Given** a Task
**When** the user forks it
**Then** the fork records its origin Task, thread and version, keeps the parent unchanged, and S08 shows both with their relation.

**Given** a conclusion adopted from a fork
**When** it is referenced in the parent
**Then** the reference names the branch and the adopted or superseded status is shown; rejoining never overwrites another agent's or person's changes.

**Given** a failed merge or promotion
**When** it occurs
**Then** the original branch context is preserved.

### Story 9.3: Compact and resume long work with durable references

As an Internal Auditor,
I want long Tasks to compact earlier history while evidence identifiers, criteria references and material decisions stay in durable artifacts, and resumption to state missing context or changed access,
So that a multi-day analysis continues without silently reusing superseded evidence (FR-27, C48, C49, A09).

Increment 2. Deferred until then: A09 compaction cases. Realises: FR-27 compaction, AD-8 recheck, UX-DR41.

**Acceptance Criteria:**

**Given** a Task near its context limit
**When** compaction runs
**Then** the continuation state lists objective, completed work and next steps, and evidence identifiers and decisions are reopened from their durable records rather than the summary.

**Given** a resumed Task whose Source access changed
**When** resumption runs
**Then** the changed access and any missing context are stated before work continues, and cancellation history never claims external rollback.

### Story 9.4: Control memory contribution and use shared within the Workspace

As an Internal Auditor,
I want to see and control whether a Task may contribute to memory and whether retained memory may be used, with recall shared across my Workspace's Engagements and never across Workspaces,
So that useful conventions carry forward while client evidence stays verified at source (FR-27, C50, OQ-3).

Increment 2. Realises: FR-27 memory controls, AD-10, OQ-3 not configurable between Engagements.

**Acceptance Criteria:**

**Given** memory enabled
**When** a Task starts
**Then** S08 shows contribution and use switches with the effective policy, and recalled context is labelled as recalled, distinct from evidence.

**Given** two Engagements in one Workspace
**When** memory is used
**Then** recall from the other Engagement is available; a second Workspace's memory is never reachable (Story 2.7 suite).

**Given** a memory is deleted
**When** confirmed
**Then** the deletion is reported without claiming historic conversations were erased.

### Story 9.5: Control permitted application and site activity recall

As an Internal Auditor,
I want optional recall of my recent application and site activity scoped to allowed apps, with capture controls, original references and explicit gaps,
So that I can find what I examined earlier without ambient summaries standing in for evidence (FR-28, C51).

Increment 2. Deferred: host eligibility (the reference is macOS-specific); A16 coverage unmet until enabled. Realises: FR-28, AD-10 activity capture distinct from memory.

**Acceptance Criteria:**

**Given** activity recall enabled for selected apps
**When** the user asks what they examined before revising a workpaper
**Then** the answer is labelled activity-derived, links to the original file, and excludes apps and sites outside the allowed set.

**Given** recall disabled or paused
**When** asked
**Then** nothing is claimed as captured for that period.

## Epic 10: Programmatic, scheduled and event-driven work

A team runs batch, SDK and non-interactive Tasks with structured, versioned results, and configures bounded schedules and events in S04 under an immutable mandate revision; run outcomes distinguish missing, not run, incomplete, failed and no-exceptions; duplicates never repeat effects. FRs: FR-23, FR-24. Relevant NFRs: NFR-3, NFR-4, NFR-6, NFR-10. UX-DRs: UX-DR36, UX-DR15 Switch. AD rules: AD-7, AD-11, AD-12, AD-14. Inventory: C03, C43, C44, C57, C59, E02, E05 to E09, E18, E19. Supply gate: production scheduler/event/mandate route must be proven before enablement; FR-23/24 remain required V1 scope.

### Story 10.1: Run a procedure non-interactively with structured, versioned results

As an IT Auditor,
I want to run a saved audit procedure from the CLI or SDK without a foreground session and receive machine-readable progress, Coverage, errors and completion under a declared result schema version,
So that repeatable jobs feed other tools without bypassing policy (FR-23, C03, C43, E19, E18).

Increment 2. Deferred until then: A16 programmatic coverage. Realises: FR-23, AD-4 shared Rust entry path, NFR-6.

**Acceptance Criteria:**

**Given** a saved access-review procedure
**When** run via `codex exec`-style non-interactive execution against an approved export
**Then** the stream and final result carry Task identity, procedure version, input versions, progress, examined Coverage, errors and completion state under a versioned schema, and an exceptions file is produced.

**Given** a bulk run across several entities
**When** one entity fails
**Then** the result reports missing or failed entities separately from successes and supports resuming the campaign.

**Given** a programmatic caller
**When** it requests an action outside policy
**Then** the same sandbox, permission and approval rules apply as in the desktop.

### Story 10.2: Attribute unattended runs to an authorised service identity

As an administrator,
I want unattended runs to execute under an identifiable workflow owner or service identity with expiry and revocation,
So that findings remain attributable when the reader differs from the executing principal (C57, FR-23, FR-24).

Increment 2. Realises: AD-12 identity in mandates, OQ-14 separation (service identity is Inquello identity, provider credential separate).

**Acceptance Criteria:**

**Given** a scheduled check
**When** it runs
**Then** the run records the workflow owner, the executing service identity, the source-system identity used and the initiating event together.

**Given** the service credential expires or is revoked
**When** the next run is due
**Then** the run does not execute as a departed or expired identity and the failure is visible in S04.

### Story 10.3: Configure schedule and event mandates in Automations

As an Internal Audit Manager,
I want to configure a schedule or supported business event with trigger, inputs, Method, acting identity, limits, destination and escalation, see its effective enablement and ownership, and have each run bound to an immutable mandate revision,
So that automated work is bounded and changes never silently rebind running work (FR-24, C59, C44, E02, E05, AD-12).

Increment 2, after the scheduler supply gate names a production route. Deferred until then: A13. Realises: FR-24, UX-DR36 AutomationsScreen, UX-DR15.

**Acceptance Criteria:**

**Given** S04
**When** the user creates an automation
**Then** the mandate stores trigger, input scope, Method version, acting identity, limits, destination and escalation, the Switch shows effective enablement only after confirmation, and "New automation" persists real state.

**Given** a mandate change while a run is in progress
**When** saved
**Then** the change applies prospectively; the running work keeps its mandate revision unless a trusted explicit rebind records authority and impact checks.

**Given** the schedule is disabled
**When** a run is in progress
**Then** future eligibility ends and the running work is handled separately and visibly.

**Given** no production scheduler route is proven
**When** this story is attempted
**Then** it remains blocked by its supply gate and the Capability Contract states schedules are not enabled.

### Story 10.4: Report run outcomes and prevent duplicate effects

As an Internal Audit Manager,
I want each run to show received/not received, not run, running, incomplete, failed and completed-with-no-reported-exceptions, with population and Coverage, and duplicate events to be deduplicated,
So that a quiet monitor never hides a missed week (FR-24, A13, E09).

Increment 2. Realises: A13, AD-11 and AD-12 duplicate controls, NFR-10, UX-DR47 automation microcopy.

**Acceptance Criteria:**

**Given** a Monday vendor-master comparison
**When** the computer was unavailable
**Then** the run shows "not run" with the reason, distinct from "no exceptions reported".

**Given** the same event delivered twice
**When** processed
**Then** the second delivery is recognised by event identity and no repeated effect occurs; the duplicate is recorded.

**Given** a completed run
**When** displayed
**Then** the message reads "Run completed; no exceptions reported in the examined population" with period, source version and Coverage, and the run never carries a human-decision appearance.

### Story 10.5: Receive Tasks and change-triggered reviews from connected services

As an Internal Audit Manager,
I want a permitted mention, ticket transition or configured service event to create or continue a scoped Task and return findings to the originating item,
So that review work starts where it is requested, with the requester and audience preserved (C44, E06 to E09, FR-24).

Increment 2, per adapter with named service, identity and eligibility (supply gate). Deferred until then: A16 coverage for service entry points. Realises: FR-24 events, AD-11 destination identity.

**Acceptance Criteria:**

**Given** a configured adapter
**When** a qualifying event arrives
**Then** a Task is created with the originating item identity, requester, Engagement resolved explicitly when ambiguous, and accessible evidence recorded; why the item matched is logged.

**Given** results are returned to the originating item
**When** posted
**Then** the audience of that item is distinguished from access to full evidence and consequential outgoing messages pass the ApprovalCard.

## Epic 11: Secondary surfaces and convenience

An auditor continues the same Task through CLI/session controls, application-adjacent assistance, mobile/remote steering and optional physical controls, uses voice/dictation with correctable transcripts, notifications that distinguish attention from completion, an optional companion, setup/history import with declared losses, and audience-scoped conversation snapshots. FRs: FR-3 (non-desktop), FR-4, FR-31, FR-32. Relevant NFRs: NFR-3, NFR-5, NFR-9. UX-DRs: UX-DR45, UX-DR50. AD rules: AD-3, AD-5, AD-6, AD-8, AD-11. Inventory: C03, C04, C06, C08, C09, C60, C61, C62, C63, C64. Gate: OQ-6 desktop first; cross-host ownership supply gate for remote continuity.

### Story 11.1: Continue the same Task from the CLI with audit-labelled session controls

As an IT Auditor,
I want the CLI to open, resume, fork, plan, review, change model effort and inspect the same Tasks as the desktop with audit-friendly labels and power-user commands retained,
So that technical practitioners get the same work and authority through a terminal (FR-3, FR-4, C03, C04).

Increment 2. Deferred until then: A16 CLI coverage. Realises: AD-4 shared entry path, UX-DR50 CLI row.

**Acceptance Criteria:**

**Given** a Task created on the desktop
**When** resumed in the CLI
**Then** it is the same Task identity with the same effective authority, structured output semantics are preserved, and no decorative shell is reproduced in text.

**Given** an experimental remote or cloud command
**When** listed
**Then** its maturity label is shown and unavailable commands are reported rather than simulated.

### Story 11.2: Assist beside an open workbook or document with stated context scope

As an Internal Auditor,
I want contextual assistance inside a supported host application that maps my selection to a stable range, paragraph or slide reference and states whether context is saved or live,
So that the agent and I never work from different versions (FR-3, FR-4, C06).

Increment 2. Deferred: declared host integration per application; A16 application-adjacent coverage unmet until enabled. Realises: UX-DR45, UX-DR50 application-adjacent row, AD-9 saved/live distinction.

**Acceptance Criteria:**

**Given** a selected exceptions table in a supported Excel integration
**When** the user asks a question
**Then** the Task receives the range reference, file identity, version and "live" or "saved" scope, and proposed changes are inspectable before application.

**Given** no supported integration
**When** the user tries
**Then** the saved-file route (Story 4.4) is offered instead of a simulated live link.

### Story 11.3: Steer and review work from a mobile or remote client

As an Internal Audit Manager,
I want to inspect, steer, interrupt and continue a Task from a supported remote device with concise findings and accessible evidence,
So that I can direct work away from the desk with the same authority and clear capability limits (FR-3, C08).

Increment 2, after the cross-host ownership supply gate verifies explicit ownership/version transfer. Deferred until then: A16 mobile/remote coverage. Realises: UX-DR50 mobile row, AD-7 cross-host rule.

**Acceptance Criteria:**

**Given** a connected execution host
**When** the remote client opens a Task
**Then** it shows the same Task identity, status and authority, supports inspect/steer/interrupt/continue with touch and keyboard semantics, and names unavailable actions with a permitted continuation path.

**Given** a disconnected remote control
**When** the user acts
**Then** the action is reported as not delivered, never as executed.

### Story 11.4: Bind optional physical controls to named Tasks and actions

As an Internal Auditor,
I want optional physical controls bound to named Tasks and actions with status indication,
So that a shortcut stays understandable when several Engagements are active (FR-4, C09).

Increment 2. Deferred: optional peripheral, hardware availability; A16 physical-control coverage unmet until enabled.

**Acceptance Criteria:**

**Given** bindings configured
**When** a key is pressed
**Then** the bound Task or action is named before any consequential effect, and a physical "approve" never records Professional Approval.

### Story 11.5: Dictate instructions with a correctable transcript

As an Internal Auditor,
I want voice input with explicit recording, transcribing and reviewable-text states, and confirmation of ambiguous amounts, dates and entity names before consequential use,
So that a misheard identifier never redirects testing (FR-31, C60).

Increment 2. Deferred until then: A16 voice coverage. Realises: UX-DR45 voice states.

**Acceptance Criteria:**

**Given** voice capture
**When** the user speaks an instruction
**Then** the states recording, transcribing and reviewable text are shown, the text is editable before sending, and an ambiguous amount or name prompts confirmation.

### Story 11.6: Notify attention needs and offer an optional companion

As an Internal Auditor,
I want notifications that separate completed analysis, detected exception, missing evidence and review needed, and an optional floating companion that mirrors Task state without exposing client names,
So that I return to the exact item needing me (FR-31, C61, C62).

Increment 2. Realises: UX-DR45 notification/companion rules, UX-DR13.

**Acceptance Criteria:**

**Given** a Task event
**When** a notification is sent
**Then** it names the category (attention needed versus completed) and links to the Task; a "done" indicator never states assurance.

**Given** the companion enabled
**When** shown above another application
**Then** it reflects the same Task state, uses discreet labels, and its absence leaves all state reachable in S02.

### Story 11.7: Import setup and recent history with declared losses

As an Internal Auditor,
I want to import instructions, skills, agent definitions and recent Tasks from another agent tool with each imported item, its scope and transfer limits reported,
So that conventions carry over without silently mixing client context or credentials (FR-32, C63).

Increment 2. Realises: FR-32 import, NFR-9 declared losses, AD-8 no credential transfer.

**Acceptance Criteria:**

**Given** an import
**When** it completes
**Then** the inventory lists imported, skipped and attention items with Engagement/client scope, and connections require reauthorisation rather than copied credentials.

**Given** imported memories or instructions
**When** listed
**Then** their source and scope are shown and Record Authority is unchanged.

### Story 11.8: Share a read-only conversation snapshot to a selected audience

As an Internal Audit Manager,
I want to share a fixed snapshot of an investigation with a permitted audience, see what evidence and execution detail the snapshot omits, and revoke the link,
So that a snapshot informs review without standing in for the evidence package (FR-32, C64, A14 sharing part).

Increment 2. Deferred until then: A14 sharing coverage. Realises: FR-32 snapshots, UX-DR43, OQ-1 team-only audiences.

**Acceptance Criteria:**

**Given** a Task
**When** a snapshot is prepared
**Then** the preview shows included content, the selected audience within the team model, and an explicit list of omitted evidence and tool details; sensitive items can be excluded before sharing.

**Given** a shared link
**When** revoked
**Then** access ends and the revocation is recorded.

## Epic 12: Team administration and governed material

An administrator revokes access, reassigns work and handles departures including retained work and orphaned unattended jobs, and applies access, retention, deletion, export and recovery policy to working files, history, evidence references, logs and telemetry held by Inquello. FRs: FR-36, FR-37. Relevant NFRs: NFR-3, NFR-4, NFR-9, NFR-10. UX-DRs: UX-DR42. AD rules: AD-7, AD-8, AD-12, AD-13, AD-14. Inventory: C71, C74, C75. Gate: OQ-2 retained extracts.

### Story 12.1: Revoke access and prevent subsequent use across active and unattended work

As an administrator,
I want revoking a person's Workspace or Engagement access to stop their subsequent use immediately, including running Tasks, delegated agents and unattended jobs they own,
So that effective revocation is enforced, not just displayed (FR-36, C71, A14, NFR-3).

Increment 2. Deferred until then: A14 revocation coverage. Realises: AD-8 revocation on use/resume/mutation, AD-12.

**Acceptance Criteria:**

**Given** a revoked member
**When** they attempt to open, resume, search or receive delegation output
**Then** every attempt is blocked, and their running Tasks are interrupted with effects reported.

**Given** automation credentials owned by the revoked person
**When** the seat is removed
**Then** owned tokens are listed for revocation or transfer; removing the seat alone does not count as revoking them.

### Story 12.2: Reassign work, reviews and unattended jobs on departure

As an administrator,
I want to reassign Tasks, review responsibilities and unattended jobs when someone changes role or leaves, with orphaned jobs surfaced,
So that work and jobs always have a known responsible person (FR-36, C71, A14).

Increment 2. Realises: FR-36 reassignment, UX-DR42 states (orphaned jobs, stale membership), AD-12 ownership.

**Acceptance Criteria:**

**Given** a departing member
**When** S09 lists their responsibilities
**Then** Tasks, reviews, owned jobs and retained material are shown and each can be reassigned within membership; nothing is implicitly granted or erased.

**Given** an orphaned job
**When** detected
**Then** it is flagged, does not run as the departed user, and awaits reassignment under policy.

### Story 12.3: Apply retention, deletion, export and recovery policy to held material

As an administrator,
I want working files/history, evidence references and retained extracts, logs and telemetry governed by separate access, retention, deletion, export and recovery policy, distinct from the external authoritative record,
So that Inquello-held material is governed without pretending to be the audit record (FR-37, C75, OQ-2).

Increment 2. Realises: FR-37, AD-13, AD-14, NFR-9 export checks, NFR-10, UX-DR42 policy inspection.

**Acceptance Criteria:**

**Given** S09
**When** policy is inspected
**Then** each category (working files/history, evidence references and relied-on extracts, logs/telemetry, backups, unattended work) shows its own retention, deletion, export and recovery rules.

**Given** an export of a Task's retained material
**When** produced
**Then** it declares included items and losses, respects access, and reimport reproduces the declared content.

**Given** a deletion
**When** executed
**Then** the result states what was removed and what remains (for example exported files or external records), never claiming erasure beyond the held categories.

### Story 12.4: Report usage and compliance events separately from accepted work

As an Internal Audit Manager,
I want adoption and operational analytics that state which data source supports each figure and never present task or token counts as accepted work or Coverage,
So that monitoring the tool is not confused with assurance (FR-37, C74, NFR-10).

Increment 2. Realises: inherited enterprise analytics (OQ-5), AD-14.

**Acceptance Criteria:**

**Given** a usage report
**When** rendered
**Then** task volume, completed tests, exceptions and accepted work are separate series with their sources named, and token usage is shown apart from them.

## Epic 13: Practice workflows and external delivery

A team plans and scopes, manages procedures and evidence requests, prepares workpapers, reviews, reports, handles responses and follows up using artifacts and the external record system via import/export, prepares stakeholder communications through approved tools, and inspects, authorises and verifies bounded external updates with operation identity and reconciliation. FRs: FR-39, FR-41. Relevant NFRs: NFR-2, NFR-3, NFR-4, NFR-5, NFR-7, NFR-9. UX-DRs: UX-DR43, UX-DR24, UX-DR51. AD rules: AD-6, AD-10, AD-11, AD-13. Inventory: C29 (export/track), C31, C34, E15, E16, E17, C78. Gate: OQ-6 (no named external record system for first validation; import/export only).

### Story 13.1: Plan, scope and run procedures with the practice's own terminology

As an Internal Auditor,
I want to plan and scope an Engagement, define procedures and record results using my Method's terms (assertions and materiality for external audit, options for advisory, technical assets for IT audit) without a mandatory control or deficiency object,
So that each practice works its own way on one workbench (FR-39, A02, E15, C78).

Increment 1. Realises: FR-39 planning/procedures, UJ-2 steps 1 to 2, UJ-6 steps 1 and 3, A02.

**Acceptance Criteria:**

**Given** an external-audit Engagement
**When** procedures are planned
**Then** the plan expresses objective, population, procedure, criteria, expected output and outstanding evidence using assertions and materiality supplied by the Method, and no control or deficiency fields are required.

**Given** an advisory Task
**When** options are developed
**Then** facts, assumptions and recommendations are distinguishable, management responsibilities and assumptions per option are stated, and no deficiency workflow is imposed.

**Given** a plan generated by the agent
**When** shown
**Then** it is labelled a proposed plan, not an authorised work programme.

### Story 13.2: Track evidence requests and receipt and prepare stakeholder communications

As an Internal Auditor,
I want to record evidence requests, receipt and gaps against procedures, and draft stakeholder communications in the team's approved tools with exact content and recipient shown before sending,
So that Coverage of evidence is visible and no message leaves without authority (FR-39, UJ-2 step 2, UX-DR47).

Increment 1. Communications are prepared as drafts or exports to approved tools; sending through a connected service follows Epic 10.5 adapters. Realises: FR-39 evidence requests and communications, AD-11.

**Acceptance Criteria:**

**Given** procedures with required evidence
**When** evidence is requested and received
**Then** each item shows requested, received, missing or inaccessible with source and version, and the Task's Coverage reflects only received items.

**Given** a drafted request to a stakeholder
**When** prepared
**Then** the exact content and named recipient are shown; sending requires the configured permission and the draft is otherwise exported to the approved tool.

### Story 13.3: Export and import a reviewable package with declared losses

As an Internal Audit Manager,
I want to export a reporting or review package (artifacts, review state, evidence references, Method and departures) with declared losses, and import a package back with the same content verified,
So that the external authority receives usable work and V1 transfer limits are explicit (FR-39, FR-41 fallback, A11, E17, NFR-9).

Increment 1. Realises: UJ-2 step 5, A11 (V1 part), UX-DR43 S10, OQ-6 import/export, AD-13 external authority declaration.

**Acceptance Criteria:**

**Given** a reviewed package
**When** exported
**Then** S10 shows audience, included content and version, the export declares what is omitted or converted, the external Record Authority is named as holding formal acceptance, and the artifact state becomes "exported" not "delivered".

**Given** an exported package
**When** reimported
**Then** the reimport reproduces the declared content, keeps artifact identities and review attribution, and reports any loss.

**Given** a failed export
**When** it occurs
**Then** the package and selected audience are retained and no broader fallback is used.

### Story 13.4: Inspect, authorise and verify a bounded external update against a fixture destination; pass W3

As an Internal Audit Manager,
I want to see the destination, current record version, exact proposed field changes and supporting evidence, authorise the update, and verify the resulting state by read-back, with stale and uncertain outcomes sent to reconciliation,
So that remote updates are bounded, verified and never blindly retried (FR-41, A10, W3, AD-11).

Increment 1 using a fixture destination adapter that implements the bounded-update contract (conditional update, read-back, lost-response simulation, revoked credentials). Deferred: a named production destination adapter (Story 13.6). Realises: FR-41, A10, UJ-8 step 4, UX-DR24, UX-DR51 delivery states.

**Acceptance Criteria:**

**Given** the W3 approved finding and a fixture destination
**When** the update is proposed
**Then** the ApprovalCard shows destination identity, record and version, the approved fields with before/after values, and the evidence; unrelated fields are listed as untouched.

**Given** the destination record changed after review
**When** the update is attempted
**Then** the version check fails, the proposal returns to review with a comparison, and nothing is written.

**Given** the response is lost after a possible success
**When** the operation is reconciled
**Then** the read-back using the operation identity determines confirmed or uncertain state before any retry is offered.

**Given** revoked credentials
**When** the update runs
**Then** it fails with the identity named and no partial write occurs.

**Given** the destination lacks conditional update or deduplication
**When** configured
**Then** the limit is declared in its Capability Contract and the reconciliation path is required.

### Story 13.5: Handle responses, actions and retests without agent closure

As an Internal Audit Manager,
I want management responses, agreed actions, completion evidence and retest results recorded against Findings with the closure decision reserved for the authorised person,
So that remediation is traced and an agent run never closes a Finding (FR-39, E14, UJ-8 steps 5 to 6).

Increment 1. Realises: FR-39 follow-up, AD-13, UX-DR51.

**Acceptance Criteria:**

**Given** a Finding with an agreed action
**When** retest evidence is added by a Task
**Then** the retest result is attached with evidence and Coverage, the Finding status is unchanged, and the closure control names the authorised person and Method basis.

**Given** a corrected artifact
**When** displayed
**Then** it is distinguished from an operating control proven effective.

### Story 13.6: Deliver to a named external audit-record destination

As an Internal Audit Manager,
I want the bounded-update contract connected to the team's actual audit-record system with its read/write, conditional-update, concurrency and verification behaviour declared,
So that real deliveries follow the verified contract (FR-41, E17).

Increment 2, after a destination is named (OQ-6 first validation uses import/export only). Deferred until then: A10 against a real destination remains unmet. Realises: FR-41 named destination, AD-11, AD-14 Capability Contract.

**Acceptance Criteria:**

**Given** a named destination adapter
**When** certified
**Then** its Capability Contract declares identity, supported operations, conditional-update and deduplication support, stale-state behaviour and the read-back path, and Story 13.4's scenarios pass against it before real data.

## Epic 14: Coherent work, completion states and capability contracts

Work keeps its meaning across delegation, editors, environments, review and resume; every Task exposes its actual states; each enabled route declares a Capability Contract; the acceptance harness runs the fixtures and A01 to A18 scenarios and keeps the deferral ledger. FRs: FR-43, FR-44. Relevant NFRs: NFR-1 to NFR-10. UX-DRs: UX-DR51, UX-DR52, UX-DR53, UX-DR54. AD rules: AD-5 to AD-14. Inventory: C76, C77, C78.

### Story 14.1: Preserve Task context across editor, environment, delegation, review and resume boundaries

As an Internal Auditor,
I want sources, Method, artifacts, decisions and actual status to remain accessible when I switch editor or environment, delegate, hand to review or resume, with any unsupported transfer stating what is missing,
So that I never reconstruct the Engagement at each boundary (FR-43, A09 context part, SP6).

Increment 1. Realises: FR-43, AD-6 linkage, UX-DR53 SP paths, UX-DR55.

**Acceptance Criteria:**

**Given** a Task continued in Excel, then reviewed in S03, then resumed next day
**When** each boundary is crossed
**Then** the same Task identity, artifact identities, Source references, Method version and recorded decisions are shown on the other side.

**Given** a transfer the route does not support (for example live state to a remote host)
**When** attempted
**Then** the missing context is named and the user is offered a supported continuation; no success is simulated.

### Story 14.2: Expose the complete state model including Delivery and Professional Approval links

As an Internal Audit Manager,
I want every Task and artifact to show planned, running, blocked, interrupted, produced, checks incomplete or complete, review requested, revision requested, Professional Approval (with external authority link in V1) and attempted, confirmed or uncertain Delivery as distinct states,
So that completion claims are inspectable (FR-44, AD-6, AD-13).

Increment 1. Extends Story 1.9. Realises: FR-44 states, UX-DR51, UX-DR52 anti-patterns, UX-DR20.

**Acceptance Criteria:**

**Given** the state model
**When** an artifact is exported, published or updated remotely
**Then** Delivery shows attempted, confirmed or uncertain with operation identity, separate from review and approval states.

**Given** Professional Approval recorded in the external authority
**When** it is confirmed
**Then** the Task links the authority, person, scope and version; before confirmation it shows pending.

**Given** the prototype anti-patterns list
**When** the UI is audited
**Then** none occurs: Stop never marks steps done, Keep never claims a saved version, toasts never claim delivery, "accepted" never represents an automated check, and no item routes to a fixed demo record.

### Story 14.3: Declare a Capability Contract for every enabled route and capability

As an Internal Audit Manager,
I want a maintained register where each enabled capability and route declares its owner, implementation or service supply, identity, processing and source limits, versions, supported formats and features, and its capability-specific acceptance evidence,
So that scope and readiness claims rest on recorded evidence (FR-44, AD-14).

Increment 1. Realises: FR-44 Capability Contracts, AD-14, NFR-9 version declarations, OQ-9 per-route eligibility record.

**Acceptance Criteria:**

**Given** the register
**When** a capability is enabled
**Then** its entry exists with owner, supply, limits, versions, eligibility status and linked test evidence, and S07 shows the user-facing parts.

**Given** a capability with no entry or failed evidence
**When** a user attempts to rely on it
**Then** it is shown as not enabled with its gate.

**Given** the mapped inventory
**When** the register is reviewed
**Then** each C and E entry maps to an enabled capability, a planned story or a recorded deferral.

### Story 14.4: Run the acceptance harness and keep the deferral ledger

As an Internal Audit Manager,
I want an automated harness that runs W1, W2, W3 (fixture destination) and M1 and the applicable A01 to A18 scenarios for enabled routes, records results, and maintains a ledger of deferred requirements as unmet acceptance,
So that validation evidence is repeatable and deferrals are never silently dropped (FR-44, OQ-10, A16, A18 inputs).

Increment 1. Realises: UX-DR54 journey flows as test scenarios, NFR-2, NFR-4 recovery cases, SM-1 to SM-4 and SM-C1 to SM-C4 data capture, OQ-7 measure-first.

**Acceptance Criteria:**

**Given** the harness
**When** run
**Then** W1 reconciles exactly (Story 3.5), W2 reports approval timing and preserves metadata (Story 5.5), W3 preserves seven accounts and reconciles the fixture update (Story 13.4), M1 separates guidance from evidence (Stories 2.6, 7.4), and each result is stored with the route and versions used.

**Given** interruption, conflict, revocation and uncertain-delivery cases
**When** injected
**Then** retained work, applied effects, recovery steps and human recovery effort are recorded (SM-4, SM-C4).

**Given** the deferral ledger
**When** published
**Then** every story marked Increment 2 or V2 appears with its unmet acceptance IDs, and no deferral is counted as demonstrated parity.

**Given** validation runs with the internal audit team
**When** effort data is captured
**Then** total effort through acceptance, wall time, reviewer correction burden, wrong or missed results, tool and model costs and denominators are recorded per task class without numeric thresholds (OQ-7).

## Epic 15: Native audit records (V2)

In native-record mode an Organisation/Workspace selects the permitted record mode and migrates deliberately with verified results; practice workflows link to native Engagements, procedures, Sources, workpapers, Findings, decisions, Responses, Actions and Retests with attributed approvals; retention, deletion, hold, amendment and recovery obligations are met with attributable history. FRs: FR-38, FR-40, FR-42. Relevant NFRs: NFR-3, NFR-4, NFR-7, NFR-9. UX-DRs: UX-DR46, UX-DR53 SP7. AD rules: AD-13. Inventory: Domain requirements rows in the traceability map (built-in record identity, history, amendment, retention, recovery, export). Dependency: OQ-11 record precedence, lifecycle and migration policy must be decided before implementation commitments; none of these stories is a V1 gate.

### Story 15.1: Select the permitted record mode at Organisation or Workspace level

As an administrator,
I want to select external-record or native-record mode within organisation policy, with Tasks and Engagements unable to change authority on their own,
So that record authority is a deliberate configuration (FR-42, A11 V2 part).

V2. Depends on OQ-11.

**Acceptance Criteria:**

**Given** organisation policy permitting Workspace selection
**When** a Workspace selects native mode
**Then** the mode is shown consistently on every Task and Engagement, and no Task or Engagement setting can switch it.

### Story 15.2: Migrate records to native mode with an identified destination and verified results

As an administrator,
I want a deliberate migration into native records that identifies transferred records, artifacts, relationships, history and declared losses and verifies the result,
So that authority moves only when the migration contract is met (FR-42, SP7).

V2. Depends on OQ-11.

**Acceptance Criteria:**

**Given** a migration
**When** completed
**Then** a verified report lists transferred items and losses, partial failure leaves existing authority in place, and operational source systems remain separate.

### Story 15.3: Link practice workflows to native records with attributed approvals

As an Internal Audit Manager,
I want procedures, Sources, workpapers, Findings, decisions, Responses, Actions and Retests held as native records whose identities and relationships survive revision, with Professional Approval naming person, scope and version,
So that the same journeys run through native records (FR-40, A12).

V2. Depends on OQ-11.

**Acceptance Criteria:**

**Given** a native Finding revised after approval
**When** amended
**Then** the affected prior approval is identified and cannot be silently retained.

### Story 15.4: Govern native records with retention, hold, deletion, amendment and recovery

As an administrator,
I want native records to follow configured retention, hold and deletion rules, controlled amendment and recovery that preserves relationships and history or declares limitations,
So that native authority meets its record obligations (FR-38, A12).

V2. Depends on OQ-11.

**Acceptance Criteria:**

**Given** a hold conflicting with a deletion rule
**When** evaluated
**Then** the configured policy decides and the conflict is visible; recovery restores records with history or reports what could not be restored.

### Story 15.5: Revisit a hosted agent browser or sandbox

As an IT Auditor,
I want the hosted browser and hosted sandbox options reconsidered once native mode and hosting are decided,
So that the V1 local-only decision is revisited rather than forgotten (OQ-13).

V2 revisit (OQ-13). Placeholder story; no acceptance beyond the decision record.

**Acceptance Criteria:**

**Given** V2 planning
**When** this story is opened
**Then** the hosted browser and sandbox options are evaluated against route eligibility (OQ-9) and the decision is recorded; until then the Capability Contract lists them as "V2 revisit (OQ-13)".

## Story count and first-increment summary

| Epic | Stories | Increment 1 | Increment 2 | V2 |
| --- | --- | --- | --- | --- |
| 1 | 9 | 9 | 0 | 0 |
| 2 | 7 | 7 (2.5 partial) | 0 | 0 |
| 3 | 7 | 7 (3.3, 3.4 partial) | 0 | 0 |
| 4 | 8 | 7 (4.5, 4.6 partial) | 1 (4.8) | 0 |
| 5 | 6 | 6 (5.6 partial) | 0 | 0 |
| 6 | 4 | 1 (6.1) | 3 | 0 |
| 7 | 5 | 4 | 1 (7.5) | 0 |
| 8 | 6 | 5 (8.5 partial) | 1 (8.4) | 0 |
| 9 | 5 | 0 | 5 | 0 |
| 10 | 5 | 0 | 5 | 0 |
| 11 | 8 | 0 | 8 | 0 |
| 12 | 4 | 0 | 4 | 0 |
| 13 | 6 | 5 | 1 (13.6) | 0 |
| 14 | 4 | 4 | 0 | 0 |
| 15 | 5 | 0 | 0 | 5 |
| **Total** | **89** | **55** | **29** | **5** |

Deferred acceptance after Increment 1, per story "Deferred" lines: A08 (9.1), A09 compaction (9.3), A10 real destination (13.6), A13 (10.3, 10.4), A14 revocation/reassignment/sharing (12.1, 12.2, 11.8), A15 untested routes and environments (8.5, 4.5, 2.5), A16 smaller capabilities (3.3, 5.6, 6.3, 7.5, 8.4, 9.5, 10.1, 10.5, 11.1 to 11.5), hosted outputs (4.8); A12 is V2 only; hosted browser/sandbox is V2 revisit (OQ-13).
