---
title: Inquello — product requirements document
status: final
created: 2026-10-26
updated: 2026-10-26
audience: Internal product and design team
---

# Inquello — product requirements document

## 0. Purpose and decision status

This PRD gives the **internal product and design team** a product baseline for UX, architecture and subsequent story creation. It builds on the [revised brief](../../../../docs/PRODUCT_BRIEF_V0_1.md), [detailed product definition](../../../../docs/addendum.md) and [recorded decisions](../../../../docs/OPEN_QUESTIONS.md). The brief's internal audience is now confirmed by the user. The [PRD addendum](addendum.md) holds technical context and evaluation fixtures; the [research digest](research-context.md) supplies bounded market context. Brand concepts exist but do not constitute approved UX.

The accepted direction is distinguished from the requirements that operationalise it. Functional Requirements (FRs), Non-Functional Requirements (NFRs) and metrics below define intended behaviour, not implemented or tested capability. Open choices remain visible in section 10; finalising this document does not choose their answers or authorise production deployment. The PRD is suitable for exploring UX and architecture; affected implementation commitments must satisfy their listed decision gates.

**Scope authority:** all 22 source requirement groups, eight source journeys and 18 evaluation criteria remain in force. The [existing scope inventory](../../../../docs/PRODUCT_BRIEF_TRACEABILITY.md) retains 79 C entries, 20 expanded behaviours, 270 subfeature mappings and 93 proposed enhancements. Those detailed cards remain scope inputs; grouped FRs do not remove them. The separate GCP/Vertex route remains a named inventory delta. No narrower MVP or first shipping increment has been selected.

## 1. Vision and accepted direction

Inquello gives auditors the broad working experience Codex gives developers: bring existing work, request an outcome, steer the agent's work, inspect the result and continue in the tools already used by the team. The foundation is essentially a Codex fork adapted to audit and assurance, retaining powerful execution, technical analysis, extensibility and conversational continuity.

The product hypothesis is that practitioners spend avoidable effort gathering context, transferring information, repeating analysis, reconstructing evidence for review and updating related outputs. Inquello aims to reduce total effort through accepted delivery while preserving accuracy, traceability, confidentiality and human judgment. Flexible methods, editable artifacts and work across systems are intended advantages to validate, not proven market demand or a claimed moat.

The product serves internal audit, external audit, advisory and IT/IS audit across industries and methodologies. First validation is with one organisation's audit team; that does not restrict the eventual market. An ad hoc question need not become an engagement, and a control-testing model is not mandatory for every practice.

**V1** is the full Codex-derived capability target and its audit adaptations using external authoritative audit systems and supported working files. It includes scheduled work, approved unattended execution and continuous assurance. **V2** adds native authoritative audit records and their lifecycle. V2 foundations are not prerequisites for V1. When both modes exist, record-mode choice is at organisation/workspace level; an individual task cannot silently change authority.

The default is execution within a scoped, user-started task. Methods begin with instructions, examples, skills, tools, agents, configuration and memory. Actual organisational policy governs processing; no exclusive provider or deployment topology is selected. Bedrock and Azure Foundry/Azure OpenAI remain explicit provider routes alongside the other researched options. Source reuse, hosted-service access and model routing are separate dependencies.

## 2. People, jobs and source journeys

### 2.1 Responsibilities and jobs

Responsibilities can overlap where team policy permits; they do not prescribe a job-title hierarchy.

- **Practitioner:** turn a question or procedure and existing material into explainable, editable work without repeatedly reconstructing context.
- **Human reviewer:** examine evidence, derivations and conclusions; reject, request corrections or approve within actual authority, with the reviewed version identifiable.
- **Team lead:** set scope, coordinate people and agents, and distinguish actual coverage and accepted results from activity counts.
- **Technical specialist:** retain queries, scripts, code/configuration review and security analysis with the same evidence and review expectations.
- **Administrator or method owner:** govern permitted resources and reusable guidance, with visible versions and departures rather than a mandatory central publishing process.

Guest participation by management, clients and evidence providers is out of V1 scope (OQ-1, decided 2026-10-27: team-only participation). Stakeholder exchange through existing approved tools remains in V1. No audit practice is excluded by the first validation setting.

### 2.2 Proposed journeys carried forward

**[ASSUMPTION AS-1]** Amina (practitioner), Noah (human reviewer/team lead) and Dev (technical specialist) are illustrative names used to structure the eight existing J scenarios. They are not interview participants or observed sessions. These UJs preserve the source behaviour without selecting screens, authentication mechanisms or a new workflow. All are V1 journeys; V2 can later carry them through native records.

- **UJ-1 — Amina answers an ad hoc question (source J1).** Starting with permitted existing files and a question, Amina asks Inquello to investigate, inspects cited sources and steers the analysis. Value arrives as a useful response or saved artifact with uncertainty and coverage visible. She can continue from that work without engagement setup; inaccessible or missing sources remain explicit.
- **UJ-2 — Amina and Noah carry an engagement through review (J2).** Amina brings the team's method, scope and evidence, prepares procedures and results, then asks Noah to review. Noah traces relied-on results to evidence and requests revisions where necessary. The resolution is a reviewable reporting package and a clear decision/delivery state under the external authority, using the practice's terminology rather than mandatory control objects.
- **UJ-3 — Amina continues a reconciliation in Excel (J3).** Amina requests a reconciliation, inspects the workbook, edits that same saved file in Excel and asks Inquello to continue. Inquello detects changed inputs, recomputes or marks prior results stale, and preserves supported formulas, comments and references. Concurrent changes produce an explicit conflict rather than lost edits.
- **UJ-4 — Amina and Noah revise a Word workpaper (J4).** Amina drafts a workpaper from evidence; Noah challenges its interpretation. They revise the same saved artifact through Word or Inquello and complete any required approval in the designated record authority. The revised argument, evidence and review context remain inspectable. Accepting a text change does not approve an audit conclusion.
- **UJ-5 — Dev reconciles specialist investigations (J5).** Dev delegates bounded access, configuration or code-security work, inspects progress and compares findings. The result preserves actual population and coverage, disagreements, gaps and supporting analysis. A specialist agent cannot impersonate the human reviewer or establish professional independence through its role name.
- **UJ-6 — Amina develops advisory options (J6).** Amina researches a process, compares alternatives and prepares an options paper or presentation. Facts, assumptions and recommendations remain distinguishable, and estimates have support or explicit labels. The output stays editable and need not become a deficiency or control-testing workflow.
- **UJ-7 — Amina teaches and reuses a procedure (J7).** Amina supplies a procedure and worked example, refines reusable guidance and applies it to another assignment. The method version, parameters and applicable instructions are visible. Client evidence remains separately scoped and does not silently become shared method content or memory.
- **UJ-8 — Noah follows a triggered procedure through (J8).** A configured schedule or supported business event starts a bounded procedure. Noah reviews its coverage and exceptions, delivers authorised changes and later retests actions. The resolution identifies delivery and closure authority separately from the agent run. Missing events, incomplete runs and uncertain delivery must not appear as successful assurance.

## 3. Shared product vocabulary

These terms identify product concepts, not a database schema. Teams may display practice-specific labels without changing the distinctions.

- **Organisation / Workspace:** the policy and working context for membership, permitted resources and record mode. Exact policy precedence remains OQ-11.
- **Workspace:** the broader working area for an audit team: its work, available resources, reusable procedures and settings (e.g. "Acme Internal Audit"). One Workspace holds several Engagements. **Engagement** (decided 2026-10-27; replaces the earlier term Assignment): a particular audit or advisory engagement with objectives, scope, period, team members and outputs (e.g. "Procurement Audit — 2026"). A **Task** is a conversation with Inquello directed towards an outcome, with its instructions, progress and resulting work (e.g. "Analyse purchase orders for approval exceptions"); a Task need not belong to an Engagement.
- **Source:** material examined, including evidence, with origin, version/date, scope and known limitations. **Analysis** is performed work with inputs, parameters, derivations, actual coverage, exceptions and limits.
- **Method:** reusable guidance or a procedure, including criteria, instructions, skills, templates, references and optional executable helpers. Method authority is distinct from model memory and tool permission.
- **Artifact:** a saved workbook, document, presentation, dataset, script, visual or other inspectable output. A workpaper is an Artifact used to document audit work. **Saved state** is the file on storage; **Live state** includes unsaved selections or application state available through a separate supported mechanism.
- **Finding:** an observation, assessed matter or recommendation supported by evidence, with status determined by the Method. A **Response / Action / Retest** records follow-up, completion evidence and verification where applicable.
- **Human Review:** feedback, requested revision or a decision by an authorised person. **Professional Approval** is a human acceptance decision about specified work/version; it is distinct from tool permission or an agent review.
- **Record Authority:** the designated authoritative audit-record system. **External-record mode** uses an external authority; **Native-record mode** makes Inquello authoritative for configured audit records. Operational source systems remain separate in both modes.
- **Delivery:** export or a bounded remote update to a known destination. **Confirmed Delivery** requires evidence of the resulting state; an attempted action can instead have an uncertain outcome.
- **Coverage:** the actual population, sources, periods and procedures examined. **Capability Contract:** the declared supported behaviours, formats/versions, processing/execution routes, permissions and known limitations of a capability; its format is a later design choice.

## 4. Features and functional requirements

FR IDs are global and stable. Unless explicitly marked **V2**, they belong to the full V1 target. Each source P group is named inline; all detailed feature-card behaviours remain included through the scope authority in section 0. Consequences define verification intent, not claims that tests have passed.

### 4.1 Workspace and navigation — P01

Users organise and recover work without losing its context. Realises UJ-1 and UJ-2.

#### FR-1 — Organise work
Practitioners can create and organise Engagements, folders, Tasks and concurrent workstreams, including ad hoc Tasks without an Engagement.

**Consequences:** relevant entity/client/period and effective Workspace remain visible when supplied; opening an ad hoc Task does not require invented engagement fields; moving or reopening work preserves its permitted references.

#### FR-2 — Find and distinguish work
Users can search, revisit, pin and archive work and distinguish Tasks awaiting input, review or Delivery.

**Consequences:** a reopened Task exposes its saved progress and artifacts; archiving navigation does not imply deletion of authoritative records; search results respect effective access and do not imply inaccessible content is available.

### 4.2 Access surfaces — P02

The target spans desktop, CLI/session controls, application-adjacent assistance, mobile/remote steering and optional physical controls. Realises UJ-1, UJ-3 and UJ-5.

#### FR-3 — Access the same work through supported surfaces
Users can start, inspect, steer and continue permitted work through the supported access surfaces, with surface-specific capabilities declared.

**Consequences:** changing surface preserves Task identity and effective authority; unavailable actions are identified rather than simulated; a client cannot gain authority merely because another surface exposed a Task.

#### FR-4 — Preserve session and context controls
Users retain applicable CLI/session commands, contextual application assistance and physical shortcuts from the inventory.

**Consequences:** each control has a declared action and observable outcome; unavailable integrations are reported; saved-file access is distinguished from a supported live-selection or unsaved-state capability.

### 4.3 Work environments and alternatives — P03

Users work in approved local, isolated and remote environments. Realises UJ-3 and UJ-5.

#### FR-5 — Make work location explicit
Users can select an available approved environment and see where work executes separately from where model processing occurs.

**Consequences:** a local UI is not labelled as proof of local inference; unavailable environments fail intelligibly; environment changes preserve or disclose the availability of required sources and artifacts.

#### FR-6 — Isolate and promote changes
Users can create isolated alternatives analogous to worktrees, compare results and deliberately promote changes while preserving originals.

**Consequences:** concurrent external edits are detected before replacement; conflicting changes are resolved or left unapplied; alternative work retains origin and promotion history rather than silently replacing the main artifact.

### 4.4 Agent task lifecycle — P04

The assistant executes within the user's scope while remaining steerable. Realises every UJ.

#### FR-7 — Perform and explain scoped work
The assistant can understand a request, plan when useful, execute permitted tools, verify outputs and report results, including parallel independent reads.

**Consequences:** progress identifies current work and input needs; the result distinguishes checked, unchecked and incomplete work; asking for a conclusion does not authorise unrelated external effects.

#### FR-8 — Continue, interrupt and recover
Users can steer, interrupt, continue and resume Tasks, including long-running goals and background work.

**Consequences:** interruption distinguishes stopped future work from effects already applied; retained artifacts and external outcomes remain visible; resumption does not claim rollback or completion without evidence.

### 4.5 Rich context — P05

Sources remain understandable across input types. Realises UJ-1, UJ-3 and UJ-6.

#### FR-9 — Understand permitted material
The assistant can use folder/file structure, documents, data, images and other declared supported visual material as context.

**Consequences:** relied-on content retains accessible origin/version and limits; unreadable or missing material is identified; an incomplete input set is not presented as full Coverage.

#### FR-10 — Capture contextual input accurately
Users can supply supported selections, annotations, application snapshots and composer assistance.

**Consequences:** captured context states whether it represents saved or live state and its scope; browser annotations retain their source association; a stale snapshot is not silently treated as current application state.

### 4.6 Analysis and executable work — P06

Practitioners and specialists retain calculation, query, transformation, script, shell and code-orchestration capabilities. Realises UJ-3 and UJ-5.

#### FR-11 — Produce checkable analysis
The assistant can run permitted calculations and executable work, retaining the input definitions, parameters, derivations and outputs needed to explain the result.

**Consequences:** known-result fixtures reconcile; changed inputs cause recalculation or stale marking; executable outputs and errors can be inspected by technical users without making code knowledge mandatory for ordinary review.

#### FR-12 — Represent population and sampling honestly
Users can perform full-population or sample-based work under their chosen Method.

**Consequences:** population counts, exclusions, sampling parameters and actual Coverage remain identifiable; duplicate handling is traceable; the product does not invent a universal sampling method or infer complete Coverage from a successful run.

### 4.7 Artifacts and publishing — P07

Artifacts remain usable inside and outside Inquello. Realises UJ-3, UJ-4 and UJ-6.

#### FR-13 — Create, edit and continue supported artifacts
Users can create and revise spreadsheets, documents, presentations, datasets, scripts and visuals, inspect previews/changes, and continue editing the same supported saved files externally.

**Consequences:** declared supported formulas, references, comments, revisions, charts, notes and other features survive round trips; unsupported features are disclosed before destructive conversion; intervening user edits are preserved or an explicit conflict is raised.

#### FR-14 — Generate and deliver visual or hosted outputs
Users can generate/edit visuals and prepare supported shared, published or hosted outputs under the required audience and destination authority.

**Consequences:** the intended audience and included content are inspectable before publication; source/analysis references remain usable where claimed; delivery states distinguish generated, published and verified rather than equating preview with publication.

### 4.8 Research and application interaction — P08

The assistant can research public information and operate permitted web/app interfaces. Realises UJ-1, UJ-5 and UJ-6.

#### FR-15 — Research with attributable sources
Users can ask the assistant to research and cite public or permitted sources using supported web/browser mechanisms.

**Consequences:** material claims carry accessible references and retrieval context; source limitations and estimates are labelled; retrieved instructions do not override the Task's authority.

#### FR-16 — Use browser, site and computer actions
The assistant can use available browser context, site-exposed tools and computer interaction under the acting identity and permitted scope.

**Consequences:** the relevant account/destination and action outcome are identifiable; a visible browser session grants no blanket authority; unavailable UI context or uncertain action outcomes are disclosed rather than guessed.

### 4.9 Review and technical investigation — P09

Review supports correction without substituting for human authority. Realises UJ-2, UJ-4 and UJ-5.

#### FR-17 — Review, correct and recheck work
Users can request reviews of artifacts/changes, examine supported exceptions, apply authorised corrections and recheck results.

**Consequences:** findings retain scope, evidence, uncertainty and revision context; unsupported findings are distinguished from established errors; a correction or agent recheck does not automatically close a Finding or grant Professional Approval.

#### FR-18 — Retain actual technical and security capabilities
Technical specialists can inspect code/configuration, perform permitted security analysis, manage available scans/findings and pursue focused follow-up investigations.

**Consequences:** source/script results remain accessible; inherited findings and backlog work retain provenance; specialist service/model eligibility and coverage limits are visible; nontechnical audit analogies do not replace these actual capabilities.

### 4.10 Teaching and reusing methods — P10

Methods develop through explanation, examples, reuse and review. Realises UJ-7.

#### FR-19 — Turn guidance into reusable work
Users can provide task examples, maintain standing instructions, author/select skills with templates/references/helpers, and use eligible demonstration-to-skill capabilities.

**Consequences:** applicable guidance, method version and parameters are inspectable; missing dependencies are reported; reuse does not require a newly selected general workflow engine; case evidence is not copied into shared guidance without authority.

#### FR-20 — Preserve method authority and departures
Users can distinguish task guidance, maintained Methods, memory and enforced policy, with relevant versions and explicit departures recorded for relied-on work.

**Consequences:** changing a Method identifies affected outputs; required review of wider distribution follows actual team policy; an instruction file, skill invocation or agent title cannot grant access or establish professional acceptance.

### 4.11 Extensible tools — P11

Inquello retains the researched extension mechanisms without presuming every hosted dependency is reusable. Realises UJ-5 and UJ-7.

#### FR-21 — Discover and use permitted capabilities
Users can discover/use built-in tools, connected apps, MCP tools and reusable plugin/marketplace packages under effective permissions.

**Consequences:** capabilities, identity, dependencies and limitations are visible; missing access is distinguished from missing functionality; discovering or installing guidance does not grant a connector's credentials.

#### FR-22 — Extend and integrate execution
Teams can use supported hooks, app-server integration and client-supplied tools with declared contracts.

**Consequences:** hook success/failure and resulting enforcement are observable; prose guidance is distinguished from technical restrictions; unsupported integration versions fail intelligibly rather than silently skipping a claimed check.

### 4.12 Programmatic and continuous work — P12

Scheduled, event-driven and programmatic work are within V1. Realises UJ-8.

#### FR-23 — Run programmatic work
Teams can initiate permitted batch/SDK and non-interactive tasks and receive structured results and structured streaming where supported.

**Consequences:** task identity, progress, errors, actual Coverage and completion state remain available to the caller; output structure follows a declared versioned contract; programmatic access does not bypass resource or action policy.

#### FR-24 — Run bounded schedules and events
Teams can configure supported schedules/events with trigger, inputs, Method, acting identity, budgets/limits, destination and escalation behaviour.

**Consequences:** missing/not received, not run, incomplete, failed and completed-with-no-reported-exceptions are distinguishable; duplicate events do not cause uncontrolled repeated effects; continuous assurance reports observed Coverage, not universal observation of business changes.

### 4.13 Delegation and alternatives — P13

Users can inspect and reconcile specialist work. Realises UJ-5 and UJ-8.

#### FR-25 — Delegate and consolidate bounded work
Users can delegate to focused agents, inspect their progress, consolidate results and see disagreements and incomplete Coverage.

**Consequences:** delegated tasks retain scope/source references; conflicting shared writes are coordinated or isolated; an agent review cannot appear as a human decision or confer professional independence.

#### FR-26 — Explore without losing origin
Users can create side chats, forks, references and alternate branches/analyses while retaining the relation to the originating Task.

**Consequences:** users can distinguish alternatives from accepted changes; origins and relevant context remain accessible; rejoining results does not silently overwrite another agent's or human's changes.

### 4.14 History and memory — P14

Continuity preserves evidence boundaries. Realises UJ-1 and UJ-7.

#### FR-27 — Resume with scoped knowledge
Users can resume history and manage limited active context through compaction while retaining accessible source and decision references. Users can inspect and control memory use and contributions separately, subject to effective policy.

**Consequences:** missing context or changed access is identified; personal preferences, approved reusable knowledge and Engagement/client evidence remain distinguishable; users can identify what may contribute to memory and what retained knowledge may be used; memory and recall are shared across a Workspace's Engagements and clients and isolated between Workspaces (OQ-3, decided 2026-10-27).

#### FR-28 — Control activity recall
Users can enable, inspect and control permitted recall of application/site activity separately from conversation history and reusable Methods.

**Consequences:** capture/use controls and original references are visible; disabled or out-of-scope activity is not claimed as captured; reuse and revocation obey the effective policy for retained material.

### 4.15 Models, routes and usage — P15

Provider choice follows actual policy and available capabilities. Realises UJ-1 and UJ-5.

#### FR-29 — Use permitted processing routes
Teams can use allowed models, organisational gateways, local-model routes and service identities, retaining Bedrock and Azure Foundry/Azure OpenAI routes and the named GCP/Vertex delta.

**Consequences:** the effective provider/deployment and supported capabilities are identifiable; an unsupported operation cannot silently switch the processing route; execution, inference and connector data flows are distinguishable.

#### FR-30 — Control reasoning, speed and consumption
Users can select available reasoning/speed choices and inspect usage under configured task/team limits.

**Consequences:** enabled limits have observable enforcement and an explained stop/escalation outcome; tool/model costs can be attributed to accepted deliverables; cost policy inherits Codex usage handling with no Inquello-specific budget values for first validation (OQ-5, decided 2026-10-27).

### 4.16 Convenience and migration — P16

Smaller capabilities remain part of the mirror. Realises UJ-1 and UJ-8.

#### FR-31 — Retain interaction and attention aids
Users can use supported voice/dictation, notifications and optional task companions.

**Consequences:** voice-derived instructions can be inspected and corrected; notifications distinguish attention needed from completion; companion state does not determine Professional Approval or audit completion.

#### FR-32 — Migrate setup and share scoped snapshots
Users can import supported setup/history and share selected conversation snapshots under an explicit audience.

**Consequences:** imported items and transfer limitations are reported; snapshots expose only selected permitted content; migration does not silently copy unavailable credentials, grant authority or change Record Authority.

### 4.17 Permissions and input trust — P17

Authority remains separate from execution success and professional judgment. Realises every UJ.

#### FR-33 — Enforce effective action authority
Teams can apply sandbox/permission profiles, command rules, approvals, managed policy and source identity. Default execution is a scoped user-started Task; broader/no-prompt modes require an explicit permitted configuration.

**Consequences:** negative permission cases prevent the prohibited action; an approval identifies its action/scope and cannot become blanket Professional Approval; eligible automatic review, prompt inspection and specialist access retain declared limits.

#### FR-34 — Treat evidence as data
The assistant must distinguish trusted task/policy instructions from instructions embedded in Sources, retrieved pages, tool results or examples.

**Consequences:** malicious instructions in evaluation evidence do not change the authorised mandate; blocked or inspected actions disclose relevant limits; tool/hook configuration is not treated as proof that every untrusted input was detected.

### 4.18 Human collaboration and lifecycle — P18

Human accountability persists through reassignment and departure. Realises UJ-2 and UJ-4.

#### FR-35 — Assign work and human review
Teams can assign Task and Human Review responsibility with Workspace/Engagement access and attribution.

**Consequences:** the responsible human and reviewed version are identifiable; multiple responsibilities can coexist where permitted; reviewer hierarchy and guest rights follow selected policy, not a hard-coded firm structure.

#### FR-36 — Reassign and revoke access
Administrators can handle access revocation, reassignment and departures, including retained work and unattended job ownership.

**Consequences:** subsequent prohibited use is prevented after effective revocation; orphaned unattended work is surfaced and handled under policy; retained artifacts/history are addressed separately from current access rather than assumed deleted.

### 4.19 Retention and operating visibility — P19

Workbench history, diagnostics and authoritative audit records have distinct purposes. Realises UJ-2 and UJ-8.

#### FR-37 — Govern V1-held material
Teams can apply applicable access, retention, deletion, export and recovery policy to working files/history, evidence references, logs and telemetry held by Inquello.

**Consequences:** these categories are distinguishable from external authoritative records; usage/task counts do not stand in for accepted work or Coverage; recovery/export declares losses and respects relevant access.

#### FR-38 — Govern native audit records — V2
Native-record mode must support its applicable retention, deletion, hold, amendment and recovery obligations with attributable history.

**Consequences:** permitted record changes and retention decisions remain identifiable; hold/deletion conflicts follow configured policy; recovery preserves records, relationships and history, or explicitly reports any limitations. These are V2 delivery conditions, not V1 gates.

### 4.20 End-to-end practice support — P20

The same workbench supports different audit and advisory methods. Realises UJ-2, UJ-4, UJ-6 and UJ-8.

#### FR-39 — Coordinate practice workflows using external records
Practitioners can plan/scope, manage procedures and evidence requests/receipt, analyse, prepare workpapers, review, report, handle responses and follow up using artifacts and external systems. They can prepare stakeholder communications through approved tools.

**Consequences:** substantive external-audit, advisory and technical examples work without mandatory control objects or deficiency states; the relevant Method determines transitions; a Finding cannot be professionally closed merely because an agent Task completed.

#### FR-40 — Carry workflows through native records — V2
Native-record mode must link the same practice workflows to native Engagements, procedures, Sources, workpapers, Findings, decisions, Responses, Actions and Retests.

**Consequences:** identities and relationships survive revision; Professional Approval names the authorised human, scope and version; amendments identify affected prior approvals. A built-in guest portal remains a separate open choice.

### 4.21 Delivery and record authority — P21

Delivery is bounded and verified. Realises UJ-4, UJ-5 and UJ-8.

#### FR-41 — Review and verify external updates
Users can inspect a specific destination, proposed changes and supporting evidence, authorise the required action and verify the resulting external record state. Import/export remains a supported fallback.

**Consequences:** unrelated fields remain untouched; relevant current state/version is checked; stale proposals and uncertain outcomes require review/reconciliation rather than blind retry; operation/destination identity is retained. Missing conditional-update or deduplication support is declared. Audit-record writeback does not grant permission to edit operational source transactions.

#### FR-42 — Select and migrate record authority — V2
Organisation/Workspace configuration can select the permitted record mode and support deliberate migration with an identified destination and verified results.

**Consequences:** Tasks/Engagements cannot silently change authority; external operational systems remain separate; export/migration identifies transferred records, artifacts, relationships/history and declared limitations. Exact policy precedence remains OQ-11.

### 4.22 One coherent experience — P22

Capabilities compose into continuous work rather than disconnected outputs. Realises every UJ.

#### FR-43 — Preserve meaning across boundaries
Users can delegate, switch editors or environments, review and resume without manually reconstructing Task context or losing artifact identity.

**Consequences:** sources, Method, artifacts, decisions and actual status remain accessible across the boundary; unsupported transfers disclose missing context; external edits and changed evidence identify affected outputs and approvals.

#### FR-44 — Make scope and completion claims inspectable
The product must expose actual completion states and maintain Capability Contracts for the mapped behaviours, including the smaller and technical capabilities.

**Consequences:** planned/running/blocked/interrupted, produced, checks incomplete/complete, review/revision, Professional Approval and attempted/confirmed/uncertain Delivery remain distinct as applicable; no universal state machine is imposed. Capability-specific acceptance exists for enabled routes and the full inventory. Any deferral is named unmet scope and cannot count as demonstrated full parity.

## 5. Cross-cutting quality requirements

These apply to enabled capabilities in their phase. Policy-specific values are selected at the gates in section 10; no universal audit standard or numerical service level is invented.

- **NFR-1 — Artifact fidelity.** For each declared supported file feature/version, round-trip fixtures must preserve its meaning and unrelated content. Unsupported macro/link/signature, formula/cache, comment/revision, chart/theme/notes or conversion cases must be identified before destructive modification. Verification includes saved external edits and concurrent-change cases (FR-6, FR-13).
- **NFR-2 — Analytical reliability.** Known-result populations must reconcile, including boundary and duplicate cases; reported Coverage must match examined inputs. Record wrong/missed exceptions and reviewer correction effort as well as calculation results. Retain sufficient permitted inputs/parameters/derivations for a reviewer to check relied-on results (FR-11, FR-12, FR-17).
- **NFR-3 — Confidentiality and access.** Negative tests across clients, Workspaces, Sources, delegation, memory, artifacts and sharing must prevent access/actions outside effective authority. Revocation cases must cover ongoing/unattended work and retained material. A folder label alone is insufficient evidence of isolation (FR-27, FR-33–FR-37).
- **NFR-4 — Recovery and duplicate effects.** Test cancel/resume, session loss, crashes, duplicate events, stale versions and uncertain external outcomes. Each must preserve usable retained work, report applied effects and prevent blind repeated Delivery. Recovery time and tolerable data loss require workload-specific targets before operational commitment (FR-8, FR-24, FR-41).
- **NFR-5 — Usability and accessibility.** Practitioner walkthroughs must demonstrate inspection of progress, evidence, changed inputs and review decisions without requiring code expertise. Test keyboard access to core actions and comprehensible failure/status messages on each declared client. Applicable accessibility conformance targets are set after first validation under OQ-8 (FR-2, FR-13, FR-43).
- **NFR-6 — Performance and cost.** Representative small/large workload profiles must measure elapsed time, interruptions, tool/model/resource cost and total effort through acceptance. Enabled limits must be enforced visibly. Latency, concurrency and budget targets are selected from the team's baseline before a support or release promise (FR-7, FR-23, FR-30).
- **NFR-7 — Evidence and decision provenance.** Relied-on outputs must expose origin/version, input scope, Method, derivations, uncertainty and applicable human decision. Changed evidence/Methods/content must identify affected results and approvals. V1 confirms formal approval through the external authority; V2 preserves native attribution/version history (FR-9, FR-20, FR-35, FR-40).
- **NFR-8 — Processing transparency.** Policy evaluation must separately address files, execution, inference, browser/connector traffic, history/logs, backups and unattended runs. Declared routes must match observed routes in validation; unsupported requests cannot silently change route (FR-5, FR-29, FR-33).
- **NFR-9 — Portability and compatibility.** Export/migration and each supported integration/client/provider version need reopen/reimport or equivalent outcome checks, declared losses and regression cases. Provider availability must not be represented as universal feature compatibility (FR-3, FR-22, FR-32, FR-42).
- **NFR-10 — Operational visibility.** Operators and responsible users must distinguish unavailable triggers, failures, partial work, identity/access problems, uncertain Delivery and recovery state. Diagnostic detail must follow the same data policy as other retained material; successful Task/token counts must not be labelled assurance Coverage (FR-24, FR-37, FR-44).

## 6. Phase scope and explicit non-goals

### 6.1 V1 target and shipping increments

V1 includes every FR except FR-38, FR-40 and FR-42, plus applicable NFRs and the full underlying capability cards. It retains existing tools/files, external audit records, automation, continuous assurance, technical execution and smaller interaction features. Individual FRs may depend on several supported service routes; this dependency does not remove them from the target.

The first shipped increment has not been selected. Release planning must record any deferred capability, unmet acceptance and dependency explicitly. A validation slice using W1–W3/M1 is evidence gathering, not authorisation to redefine V1. Full parity cannot be claimed while requirements are deferred or unverified.

### 6.2 V2 and additional candidates

V2 adds FR-38, FR-40 and FR-42 and the native-record portions of the source requirements: record identity, relationships, human attribution, versioned decisions, amendment, applicable retention/hold/deletion, recovery and meaningful export. Their policy choices must be resolved before native-mode implementation commitments.

Broader audit-universe/annual or portfolio planning, staffing/capacity/budget suites, organisation-wide assurance mapping, quality-programme administration and a general workflow builder remain unprioritised candidates. Ordinary engagement planning and follow-up assistance using external records remain V1.

### 6.3 Boundaries

- V1 does not become a native authoritative audit-record system. Local artifacts/history and review assistance remain required.
- Neither phase automatically becomes an operational ledger, HR system or transaction source; audit-record authority does not imply transaction-editing authority.
- Inquello does not impose a universal methodology, control object, professional approval hierarchy or population-sampling rule.
- Agent completion, a generated report, a closed Task or a reviewer-agent role does not establish assurance, Professional Approval or remediation.
- Continuous two-way synchronisation, a guest portal and final branded interface are not accepted baseline choices. They are not silently forbidden either; their relevant decisions remain explicit.
- No claim of customer demand, willingness to pay, measured savings, final naming clearance or transferable hosted-service eligibility is made by this PRD.

## 7. Validation and success measures

### 7.1 Evidence programme

Use the selected organisation's team and permitted representative examples to evaluate complete workflows against current practice. W1 (Excel reconciliation), W2 (Word workpaper), W3 (access review and controlled Delivery) and M1 (Method authority/reuse) are starting fixtures, supplemented by external-audit/advisory and presentation round trips. The [addendum](addendum.md) preserves source A01–A18 and exact fixture expectations. No product/runtime scenario has yet been passed.

Each supported route needs capability-specific evidence, including smaller features and denial/recovery cases. A01–A10 and A13–A18 concern V1; A11 separates V1 external authority/export from V2 mode selection/migration; A12 concerns V2 only. Native records are not a V1 evaluation prerequisite.

### 7.2 Metrics and counter-metrics

Targets below describe the intended direction; numerical thresholds are set once the validating internal audit team has a baseline (OQ-7, decided 2026-10-27). Report task class, denominator, sample size and unaccepted/abandoned work so an easier workload mix cannot masquerade as improvement.

- **SM-1 — Total effort per accepted deliverable.** Measure human preparation, review, corrections, retries/reconstruction and Delivery effort from a defined start to human acceptance; report wall-clock duration separately. Compare matched task classes with current practice. Target: lower total effort while SM-C1–SM-C4 remain within approved bounds. Validates FR-7, FR-13, FR-17, FR-41 and FR-43.
- **SM-2 — Traceable acceptance.** Measure the proportion of relied-on outputs for which a reviewer can retrieve input scope, relevant Sources/Method, derivations and the required review/delivery state. Target: meet the agreed completeness standard for the selected Method. Validates FR-9, FR-11, FR-20, FR-35 and FR-44.
- **SM-3 — Cost per accepted deliverable.** Include tool/model/resource costs and failed/repeated work within each measured task class. Target: remain within selected workload budgets, judged alongside total human effort. Validates FR-23, FR-24 and FR-30.
- **SM-4 — Recovery outcome.** Measure retained usable work, reconciled external effects, time and human effort across injected interruptions, conflicts and uncertain updates. Target: meet agreed workload recovery bounds without unexplained effects or losses. Validates FR-6, FR-8, FR-24 and FR-41.
- **SM-C1 — Incorrect or missed results.** Count wrong calculations, unsupported findings and missed known exceptions in fixtures/practitioner review. Counterbalances speed/effort gains in SM-1; reducing work by missing errors is not success.
- **SM-C2 — Review and correction burden.** Report reviewer effort, rejected deliverables and extra correction rounds separately from authoring time. Counterbalances SM-1 and SM-3; shifting effort to reviewers is not a productivity gain.
- **SM-C3 — Confidentiality and authority failures.** Track prohibited access/actions, unintended disclosures and false approval/delivery claims. Counterbalances SM-1–SM-4; negative authority tests must pass before enabling the affected route.
- **SM-C4 — Artifact loss and recovery regressions.** Count lost/changed unsupported content, overwritten human edits, duplicate effects and unrecoverable work. Counterbalances SM-1 and SM-4; a faster path cannot hide loss or unreconciled effects.

## 8. Governance, integration and operating commitments

The internal team owns product scope and design; the selected organisation supplies its actual Method, data/access policy and review authority. An agent role is not a human sign-off role. Exact participants and named approvers are assigned through section 10; this PRD does not fabricate their consent.

Every integration needs a named destination, acting identity, supported read/write contract, stale-state/concurrency behaviour, duplicate-effect handling and outcome-verification path. Saved-file interoperability, live application access and remote platform records must be validated separately. Where a destination cannot support a claimed update guarantee, the product must expose that limit and provide the appropriate review/reconciliation or export route.

Operational and processing commitments require actual workload/data classification, service eligibility and policy. Client support, account lifecycle, retention, support responsibility, accessibility targets, availability, recovery objectives and cost limits are defined before a promise about the affected route. UX/architecture may compare options while those choices remain open; build/rollout plans must not treat an unspecified contract as settled.

Candidate component and transport details belong in the addendum and subsequent architecture. The established Codex-derived foundation does not imply that all desktop UI source, hosted tools or services are reusable or transferable. No architecture, SSO system, database, tenancy topology or public endpoint design is selected here.

## 9. Product risks and validation response

- **Breadth outruns delivery evidence.** The full mirror is broad and service-dependent. Maintain the inventory and capability evidence; report explicit unmet scope rather than claiming parity from grouped requirements.
- **Review effort consumes the benefit.** Fluent outputs can be expensive to reconstruct or correct. Evaluate SM-1 with SM-C1/SM-C2 on complete workflows, including failed work.
- **File or record changes break trust.** External edits, unsupported features, stale proposals and partial writes can invalidate relied-on results. Exercise round trips, conflicts and uncertain-outcome recovery before enabling the affected workflow.
- **Context crosses an authority boundary.** Memory, delegation, snapshots and unattended jobs can expose material beyond its permitted use. Validate negative cases, revocation and actual route policy, including retained material.
- **Method flexibility becomes inconsistent practice.** Reuse without visible versions/parameters can undermine review. Keep Method identity and departures inspectable while leaving the distribution/governance model open.

## 10. Open decisions and dependency gates

**[ASSUMPTION AS-2]** Owners below are proposed role assignments for the internal team, not confirmed appointments. Assign named people when the affected work begins. These are downstream gates, not a request to reopen the accepted product breadth or V1/V2 boundary. Gates marked **Decided 2026-10-27** were settled by the product owner during spec review; the decision text replaces the earlier option list.

1. **OQ-1 — Human and guest collaboration. Decided 2026-10-27:** team-only participation. Workspace audit-team and reviewer access with external stakeholder exchange; no guest participation in V1. **Owner:** product lead with audit lead.
2. **OQ-2 — Retained supporting evidence. Decided 2026-10-27:** retain references plus the extracts and derivations the analysis relied on, as Codex thread history already does; no full source copies. Under OQ-3, retained extracts are visible across a Workspace's Engagements. **Owner:** audit method owner and organisation data-policy owner.
3. **OQ-3 — Cross-Engagement recall. Decided 2026-10-27:** no isolation between Engagements or clients within a Workspace; isolation between Workspaces. Inquello extends an auditor who already holds knowledge of all their engagements, as existing audit tools do. Not configurable. **Owner:** product lead and data-policy owner.
4. **OQ-4 — Method distribution and review authority. Decided 2026-10-27:** inherit Codex mechanisms (Workspace, local and plugin-packaged skills; curated or team plugin marketplaces; MCP configuration; Agent Security managed policy). No managed catalogue or approval workflow for first validation; refine on usage evidence. **Owner:** method owner with audit lead.
5. **OQ-5 — Task/team cost policy. Decided 2026-10-27:** inherit Codex usage handling (plan/workspace limits, model/reasoning/speed selection, usage inspection, enterprise analytics). No Inquello budget values for first validation; adjust on usage evidence. **Owner:** product lead with team administrator.
6. **OQ-6 — Initial clients, formats and integrations. Decided 2026-10-27:** desktop first, mirroring Codex clients; Excel, Word, PowerPoint and CSV; no named external record system for first validation, import/export only. The full target remains unchanged. **Owner:** product lead with integration/architecture lead.
7. **OQ-7 — Validation participants and quantitative targets. Decided 2026-10-27:** an internal audit team validates on the task types it picks during validation planning; no numeric thresholds until a baseline exists, measure first. Permitted examples and acceptance owners are named at validation planning. **Owner:** audit lead with product lead. **Revisit:** when a baseline exists, to set thresholds.
8. **OQ-8 — Operating and accessibility commitments. Decided 2026-10-27:** single-team scale for first validation with no service promises; workload, availability/support, latency, recovery/loss and accessibility targets are set after first validation. **Owner:** product lead with design/operations leads. **Revisit:** after first validation.
9. **OQ-9 — Processing and provider eligibility. Decided 2026-10-27:** every documented route stays in scope and must be tested; none is excluded or presumed approved. Organisational policy eligibility is verified per route before real data uses that route. **Owner:** organisation policy/security owner with architecture lead.
10. **OQ-10 — Release sequencing. Decided 2026-10-27:** sequencing, first increment and explicit deferrals are decided at story breakdown and recorded there with unmet acceptance. No implicit MVP cut. **Owner:** product lead.
11. **OQ-11 — V2 record policy.** Resolve organisation/workspace precedence, supported native lifecycle rules, review/hold/amendment/retention and migration contracts. Workspace choice within organisation policy is a recommendation. **Owner:** product lead, audit lead and data-policy owner. **Revisit:** before native-mode architecture and implementation commitments; not a V1 blocker.
12. **OQ-12 — Final name and design direction.** Select the final visual identity/UX and complete appropriate name checks; concept-screen and naming-research territories do not select launch markets. **Owner:** product/design lead. **Revisit:** before public brand commitments; Inquello remains the working name.
13. **OQ-13 — Hosted agent browser and sandbox. Added and decided 2026-10-27:** the agent browser and agent sandbox are local in V1 (Codex desktop built-in browser profile, Computer Use, OS sandbox enforcement); a hosted browser or hosted sandbox is deferred to V2 and must be revisited there. **Owner:** product lead with architecture lead. **Revisit:** at V2 planning, explicitly.
14. **OQ-14 — Identity and authorisation. Added and decided 2026-10-27:** Inquello owns identity and authorisation through its own auth module covering Workspace membership, audit-team roles, Engagement membership and the differing internal-audit and external-audit models; inference-provider sign-in (ChatGPT subscription, Claude, Azure, Bedrock, Vertex) is separate and only selects and authorises the inference route. Claude as a direct route is not in the documented Codex route list; the architecture update confirms how it is reached. **Owner:** product lead with architecture and security leads. **Revisit:** architecture update must define the module and where it runs.

There is no unresolved contradiction in the documented product direction. OQ-1/2/3/4/5/6/8/9/10 were decided on 2026-10-27 and travel downstream as decisions. OQ-7 was decided on 2026-10-27 as measure-first; numeric thresholds follow the baseline. OQ-8 commitments are revisited after first validation; OQ-11 and OQ-12 remain open. OQ-13 and OQ-14 were added and decided on 2026-10-27; OQ-13 carries an explicit V2 revisit.

## 11. Assumptions and handoff

- **AS-1 — Illustrative names (§2.2):** user journeys structure the existing proposed scenarios, not captured practitioner observations. Validate the flows with the validating internal audit team (OQ-7, decided 2026-10-27).
- **AS-2 — Proposed owners (§10):** role owners and revisit gates provide a working handoff; the product lead assigns actual owners before the affected work starts.

No product audience assumption remains. Guest, retention, recall, Method-distribution, budget, client/format/integration, operating-scale, provider-route and sequencing choices were decided by the product owner on 2026-10-27 (§10); none was inferred.

UX should turn the retained scenarios, status distinctions and Capability Contracts into reviewable interaction designs. Architecture should evaluate component/service routes, file and external-record consistency, identity/policy boundaries and operational constraints while keeping open decisions visible. Story creation should preserve FR/NFR/UJ IDs and satisfy the applicable decision gates. The addendum's technical context and existing brand explorations are inputs, not selected implementations.
