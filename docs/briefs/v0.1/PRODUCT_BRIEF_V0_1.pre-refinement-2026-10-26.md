# Auditor Workbench — Product brief

**Version:** 0.1 — first draft for review  
**Date:** October 26, 2026  
**Working name:** Auditor Workbench  
**Stage:** product definition, before detailed experience design and architecture

**Phasing clarification — October 26, 2026:** the user places built-in audit-record mode in V2. V1 is the full Codex-derived auditor workbench working with existing external record systems and supported files. The requirements below distinguish those phases.

## 1. Product proposition

Auditor Workbench gives auditors the working experience that Codex gives developers: an agent that understands their working context, performs permitted work, creates and changes useful artifacts, explains its results, responds to review and continues alongside them in their preferred tools.

The intended foundation is essentially a fork of Codex, redesigned around audit and assurance work. Preserve its broad capabilities and conversational workspace while adapting its terminology, tools, outputs and review interactions to auditors. The product serves internal audit, external audit, advisory and IT/IS audit across industries and methodologies.

An auditor should be able to bring an existing folder, workbook, procedure, evidence collection or engagement into the product and ask for an outcome. The assistant can investigate, plan, analyse, calculate, draft, revise, delegate, monitor and prepare delivery within the user's authority. The auditor can inspect the work in the product or continue using the same saved artifacts in Excel, Word, PowerPoint and other supported tools.

**V1 uses external-record mode:** it works with the team's existing authoritative audit system and supported working files. **V2 adds built-in-record mode:** it supplies native authoritative audit records, relationships and lifecycle capabilities. Both phases retain the same underlying Codex-derived work experience.

**Core promise:** help an auditor move from a question or assignment to useful, inspectable and reviewable work, while retaining control over methods, evidence, professional judgment and delivery.

## 2. How to read this draft

This document translates the completed research into proposed product requirements. Statements in the accepted-decisions table reflect the user's choices. Requirement IDs **P01–P22**, journeys **J1–J8**, acceptance criteria **A01–A18** and suggested defaults are draft proposals for review; they are not claims of implemented behavior.

The full functional mirror is the V1 target scope. It is not a promise of every capability in the first shipped release. Detailed release sequencing comes later and must make any deferral explicit. Built-in audit-record mode is expressly assigned to V2 by the user; other capabilities are not moved to V2 solely because their audit adaptations are difficult.

The research is sufficient to write this brief. Workflow quality, artifact fidelity, reliability and performance become product tests. Organisational policies and service eligibility remain dependencies to confirm before affected implementation or deployment commitments. No further general research phase is imposed as a prerequisite to reviewing this draft.

### Accepted decisions

| Area | Established direction |
| --- | --- |
| Foundation and experience | Essentially a Codex fork, retaining its broad working experience and capabilities while redesigning relevant aspects for auditors. |
| Practice coverage | Adaptable across internal/external audit, advisory, IT/IS audit, industries and methods. No universal methodology or required control-testing model. |
| First validation setting — Q1 B | One organisation's audit team; this does not set the permanent market boundary. |
| Record modes — Q3 A | V1 works with external audit records; V2 adds built-in audit records. When both modes are available, selection remains at organisation/workspace level. |
| Existing tools | Review supported artifacts in the workbench or continue editing the same saved files in existing applications. |
| Remote record integration — Q4 B | Deliberate, reviewable, authorised writeback; import/export remains a useful fallback. |
| Default autonomy — Q7 B | Execute within a scoped user-started task. Preauthorised unattended capabilities remain in the full mirror. |
| Methodology — Q8 | Begin with Codex's existing instructions, skills, tools, agents, configuration and memory mechanisms. |
| Processing — Q11 | Actual organisational data policy governs processing requirements. No exclusive provider or deployment topology selected. |
| Provider scope | Include Amazon Bedrock and Microsoft Azure Foundry/Azure OpenAI alongside other researched provider routes. |
| Sequence | V1: full Codex-to-auditor mirror and required adaptations using external records. V2: built-in audit-record mode and separately prioritised additions. Continuous assurance remains within the broader V1 mirror. |

## 3. Users, problems and outcomes

The first validation audience is a team whose members prepare work, review it, coordinate assignments and administer permitted access. These are responsibilities, not a fixed job-title or permission hierarchy. One person may hold several responsibilities when the team's policy permits. Guest access for management, clients and evidence providers remains an open product choice.

| User responsibility | Work the product should support | Desired outcome |
| --- | --- | --- |
| Practitioner / preparer | Understand a process, analyse evidence, perform procedures, investigate exceptions and prepare outputs. | Less repetitive preparation and transfer work; results remain explainable and editable. |
| Human reviewer | Inspect evidence, calculations and conclusions; question or reject work; assess corrections and approve where authorised. | Lower reconstruction effort and clearer visibility of what changed and why. |
| Assignment / team lead | Set scope, coordinate people and agents, monitor work and unresolved items, prepare reporting and follow-up. | A reliable view of actual progress, coverage and decisions awaiting attention. |
| Technical audit specialist | Query structured data, inspect systems/configuration/code, build repeatable analyses and investigate technical findings. | Retain powerful execution and developer-facing capabilities with audit context and usable outputs. |
| Administrator / method owner | Set access and operating policy, maintain reusable guidance and manage permitted tools/providers. | Consistent defaults with visible exceptions and controlled changes. Exact publishing rights remain to be designed. |

The product hypothesis is that auditors lose time gathering context, transferring work among files and systems, repeating analysis, reconstructing evidence for review and updating related outputs. These are hypotheses to validate with the selected team, not quantified market findings.

Success means producing accepted work with less total effort while maintaining or improving accuracy, traceability, confidentiality and practitioner control. Generation speed alone is insufficient: measure preparation, review, corrections, retries and delivery together.

## 4. Experience principles

1. **Start from the auditor's work.** Accept existing files, procedures and terminology. Support a standalone question as naturally as a formal engagement.
2. **Conversation directs visible work.** Keep relevant sources, artifacts, changes, agent activity and decisions inspectable beside the task. Detailed layouts are a later design exercise.
3. **Preserve breadth and progressive access to detail.** An auditor can ask in ordinary language; a technical practitioner can inspect code, queries, logs, parameters and structured outputs.
4. **Keep supported artifacts usable elsewhere.** External editing is a normal workflow. Format conversion or a proprietary document is not a prerequisite for assistance.
5. **Adapt methods through familiar mechanisms.** Begin with examples, instructions and skills; add governance where the team's actual process needs it.
6. **Make scope, evidence and uncertainty visible.** Distinguish supplied facts, derived calculations, proposed judgments, missing information and coverage limits.
7. **Separate permission, verification and professional approval.** Authority to run a tool, a successful calculation and an accepted audit conclusion are different events.
8. **Respect the chosen record authority.** Show whether work is local, delivered, accepted or retained as an authoritative audit record.
9. **Recover transparently.** Preserve work and explain partial completion, conflicts and uncertain outcomes. Resuming a conversation must not imply that an external action was undone.

## 5. The work model

These are product concepts, not a database schema. Teams may use different names and require different relationships.

| Concept | Meaning in the experience |
| --- | --- |
| Organisation / workspace | The policy and working context within which record mode, membership and permitted resources are determined. |
| Assignment / engagement | An optional organised body of work with objectives, scope, period, participants and outputs. Ad hoc tasks can exist without one. |
| Task / conversation | A specific outcome, its instructions, interactions, progress, agents and resulting work. Several tasks may contribute to one assignment. |
| Source / evidence | Material examined, with accessible origin, version/date, relevant scope and known limitations. |
| Method / skill / procedure | Reusable guidance or a particular procedure, including criteria, parameters, references, examples and optional calculation tools. |
| Analysis / test result | The performed work, inputs and derivations, actual coverage, exceptions and limits. |
| Artifact / workpaper | A saved workbook, document, presentation, dataset, script, visual or other output that people can inspect and continue editing. |
| Observation / finding / recommendation | An assessed matter supported by evidence, with status and terminology determined by the applicable method. |
| Review / decision | Human feedback, requested change, approval or other recorded decision, distinct from permission to execute an action. |
| Response / action / retest | Management response, assigned follow-up, completion evidence, verification and authorised closure where the process requires them. |

An external-audit task may organise work around assertions, materiality and substantive procedures. Advisory work may organise around questions, options and recommendations. IT audit may retain technical assets and scripts. A control object is not mandatory for every type of work.

## 6. Record-mode roadmap: external records in V1, built-in records in V2

| Behavior | V1 — external-record mode | V2 — built-in-record mode |
| --- | --- | --- |
| Audit-record authority | The designated external system is authoritative. Working files/history can exist in the workbench without becoming the final record. | The workbench is authoritative for the configured audit records. Operational source systems remain external. |
| Performing work | Analyse, draft, review and revise supported artifacts; read relevant records through permitted mechanisms. | The same assistance, linked to native assignments, procedures, evidence, workpapers, findings and decisions. |
| Delivery | Export a review package or prepare a specific remote update; confirm its outcome and destination identity. | Persist changes in the selected workspace with attributed history and required review/approval behavior. |
| Formal approval | Record or confirm approval in the designated authority when the team's process requires it; local comments alone do not establish external acceptance. | Record the authorised person's decision, its scope and the version approved. |
| Changes after review | Detect relevant changes, show affected work and prepare a revised package/update. | Preserve prior decisions, identify affected approvals and support controlled amendment or reopening. |
| Portability | Keep deliverables and enough permitted supporting material usable in the destination. | Export meaningful records, artifacts, relationships and history with declared transfer limitations. |

**Draft requirement:** organisation policy governs permitted workspace settings. V1 uses external-record mode. V2 introduces the mode choice at organisation/workspace level; the exact policy precedence remains open. Individual tasks or engagements cannot silently change record authority. Migration into built-in mode is a V2 capability with an identified destination and verified results.

The chosen mode does not depend on whether someone edits a workbook in Excel or in the workbench. Neither mode makes the product the ledger, HR system or operational transaction system. Editing source transactions is a separate authority and is not implied by audit-record writeback.

Supported saved-file collaboration does not require an API connection to each editor. Live selections, unsaved application state and remote platform records are separate capabilities with their own supported access mechanisms.

## 7. Functional scope

The following requirements organise the full researched mirror into a product specification. The [traceability appendix](PRODUCT_BRIEF_TRACEABILITY.md) assigns every existing C entry and expanded E behavior to a requirement. The linked feature cards remain the detailed subfeature inventory; grouping here does not remove them.

Unless marked V2, these are V1 workbench requirements. V1 retains working files, task history, evidence references, review assistance and external delivery; it does not supply a native authoritative audit-record system. P19–P21 identify the additional V2 responsibilities.

### Workspace, execution and work products

| ID | Proposed requirement | Required auditor behavior |
| --- | --- | --- |
| **P01** | Workspace and task navigation | Organise assignments, folders, conversations and active workstreams. Search, revisit, pin/archive and distinguish work awaiting input, review or delivery. Show the task's entity/client/period when applicable. |
| **P02** | Multiple ways to access assistance | Retain desktop, CLI/session controls, application-adjacent assistance, mobile/remote steering and optional physical shortcuts as capability targets. Adapt actions to the user's context; access must respect the same policy. Surface availability and integration limits explicitly. |
| **P03** | Local, isolated and remote work environments | Work in an approved local or remote environment. Support isolated alternatives analogous to worktrees, preserving originals and making promotion of changes deliberate. Detect concurrent edits and display execution location separately from model processing. |
| **P04** | Agent task lifecycle | Understand a request, plan when useful, use permitted tools, verify outputs and report results. Support progress, steering, interruption, continuation, long-running goals, background work and parallel independent reads. Explain incomplete work and retained effects after interruption. |
| **P05** | Rich context and input | Understand relevant folder/file structure, documents, data and visual material. Retain image inputs, contextual selections/annotations, application snapshots and composer assistance where supported. Identify source origin and distinguish saved file state from live state. |
| **P06** | Analysis and executable work | Perform calculations, queries, transformations and scripting through permitted runtimes, including code orchestration. Preserve input definitions, parameters, calculations and outputs needed to explain a result. Support full-population and sample-based work without inventing a universal sampling method. |
| **P07** | Artifact creation, editing, inspection and publishing | Create and revise supported spreadsheets, documents, presentations, datasets, scripts and visuals. Provide previews, change review and external-editor paths. Retain generated visuals and shareable/hosted outputs as targets; publishing requires destination/audience awareness. Unsupported features must be disclosed before destructive conversion. |
| **P08** | Web, browser and computer interaction | Research public sources and work with permitted websites/apps using available browser, site-tool and computer interaction mechanisms. Preserve references and acting identity; distinguish retrieved content from instructions. A visible browser session does not grant authority for every action. |
| **P09** | Review, investigation and correction | Review artifacts and changes, identify supported exceptions, suggest fixes, apply authorised revisions and recheck results. Retain actual code/configuration/security analysis for IT/IS auditors as well as general audit equivalents. Preserve review scope, evidence, uncertainty and finding history; correction does not automatically establish closure. |

### Methods, tools, delegation and continuity

| ID | Proposed requirement | Required auditor behavior |
| --- | --- | --- |
| **P10** | Teach and reuse ways of working | Accept examples and task guidance; preserve standing instructions; author/select skills with references, templates and optional helpers. Support demonstration-to-skill where an eligible mechanism exists. Make applicable method and parameters visible; record relevant versions and explicit departures. A general workflow builder is not required by this starting point. |
| **P11** | Extensible tools and reusable packages | Retain built-in tools, connected-app discovery, MCP, plugins/marketplaces, hooks, app-server integration and client-supplied tools. Expose capability, permission and dependency information. Separate ordinary guidance from enforced restrictions and test hook failure behavior. |
| **P12** | Programmatic, scheduled and event-driven work | Support batch/SDK entry points, structured results, schedules and approved events from connected services. Define trigger, input scope, procedure, identity, budget/limits, destination and escalation behavior. Report missing, failed and partial runs; prevent uncontrolled duplicate effects. |
| **P13** | Specialist agents and parallel investigations | Delegate bounded work, inspect agents, consolidate results and surface disagreements. Support side chats, forks, references and alternative analyses without losing task context. Coordinate shared writes or use isolated work. Agent roles do not replace human review authority or create independence by themselves. |
| **P14** | Context, history and memory | Retain useful task history, resume work and manage limited active context. Keep source/decision references available through compaction. Distinguish personal preferences, approved reusable knowledge and engagement/client evidence. Provide understandable memory-use/contribution controls; cross-engagement reuse follows policy. Retain optional, policy-controlled recall of permitted application/site activity, with clear capture/use controls and references to original material; this is separate from conversation history. |
| **P15** | Models, processing routes and usage choices | Support permitted models, reasoning/speed controls, usage visibility, organisational gateways, local-model routes and service identities. Include Bedrock and Azure Foundry/Azure OpenAI routes. Preserve the newly discovered GCP/Vertex route in the coverage backlog. Show actual provider/deployment and capability limits; model routing does not define all data locations. |
| **P16** | Continuity and convenience | Retain voice/dictation, useful notifications, optional task companions, import/setup migration and controlled conversation snapshots. Shared material has an explicit audience and scope. Optional convenience features remain inventoried; they do not determine audit completion. |

### Team operation and audit responsibilities

| ID | Proposed requirement | Required auditor behavior |
| --- | --- | --- |
| **P17** | Authority, permissions and input trust | Apply sandbox/permission profiles, approval mechanisms, command rules, managed policy and source identity. Default to scoped user-started execution. Represent broader/no-prompt modes explicitly when policy permits, without equating them with professional approval. Preserve supported prompt-inspection and specialist-access controls, with coverage limits. Treat evidence-originated instructions as untrusted content. |
| **P18** | Human collaboration and user lifecycle | Assign work and review responsibility, respect workspace/assignment access and preserve attribution. Support reassignment and departure, including ownership of unattended jobs. Exact review hierarchy and guest access are configurable/open; do not hard-code a single firm or internal-audit structure. |
| **P19** | Retention, diagnostics and operating visibility | V1: distinguish local work/history, external audit records, diagnostic logs and usage telemetry; apply relevant access, retention, deletion, export and recovery policy to workbench-held material. Report accepted work and actual coverage separately from task/token counts. V2 adds the native authoritative audit-record retention/hold/amendment regime. |
| **P20** | End-to-end audit and advisory work | V1: assist and coordinate planning/scoping, procedures, evidence requests/receipt, analysis, workpapers, review, conclusions, reports, responses and follow-up using working artifacts and external record systems. Permit alternate paths for substantive, advisory and technical work. Prepare stakeholder communications through approved tools. V2 adds native audit-record lifecycle management; a built-in guest portal remains a separate choice. |
| **P21** | Credible record authority and delivery | V1: prepare bounded external-record changes, obtain required authorisation and verify delivery; identify stale proposals and uncertain outcomes. V2: maintain native authoritative record identities, relationships, version history, evidence links, decisions, controlled amendment and export. Never equate an attempted write with a confirmed update. |
| **P22** | One coherent auditor experience | Make tasks, runtime capabilities and audit workflows compose into a continuous experience. Context and artifacts remain intelligible when the user delegates, changes editor, changes execution location, reviews or resumes work. Users should not have to manually reconstruct the assignment at each boundary. |

### Breadth that must remain visible

The mirror includes small and technical capabilities as well as headline workflows: session controls, structured streaming outputs, alternate branches, context compaction, migration, browser annotations, site-exposed tools, visual generation, voice, notifications, snapshots, optional companions and physical controls. Their implementation and availability may differ; any later omission or deferral must be named in the coverage ledger.

Code and shell execution remain useful capabilities for technical audit work. Continuous assurance, scheduled analytics and the interest-rate-change example are included under P12, alongside other use cases. They do not define the entire product.

## 8. Core user journeys

These describe the proposed experience and the evidence of success. They are not observed product demonstrations.

J1–J8 are V1 journeys: the workbench assists with work and outputs while formal audit-record authority remains external. V2 may carry those same journeys through native records; native record ownership is not required to validate the V1 journeys.

| Journey | Experience | Successful outcome |
| --- | --- | --- |
| **J1 — Answer an ad hoc question** | Open an existing body of work, state a question, inspect relevant sources, steer the analysis and receive a sourced response or artifact. | A useful answer with evidence, uncertainty and accessible working outputs; no formal engagement is required. |
| **J2 — Carry an engagement through review** | Use the team's method to establish scope and procedures, gather evidence, execute work, review exceptions and prepare conclusions/reporting. | Each relied-on result connects to its scope, evidence and review outcome; practice-specific methods work without mandatory control objects. |
| **J3 — Analyse and continue in Excel** | Ask for a reconciliation, inspect the workbook, edit the same saved file in Excel and ask the assistant to continue. | Supported formulas/references/comments survive; the assistant recognises changed inputs and recomputes or marks prior results stale. |
| **J4 — Prepare and revise a workpaper** | Draft a Word workpaper, obtain human review, revise through the workbench or Word and complete approval through the selected record authority. | Evidence references and review history remain intelligible; accepting a text edit does not silently approve the audit conclusion. |
| **J5 — Conduct a specialist investigation** | Delegate an access, configuration or code-security review to focused agents, inspect progress and reconcile their findings. | Actual population/coverage is clear; disagreements and gaps are visible; source analysis and reviewable outputs remain available. |
| **J6 — Develop advisory options** | Research a process, compare alternatives and prepare an options paper or presentation. | Facts, assumptions and recommendations are distinct; estimates are supported or labelled, and work is not forced into a deficiency workflow. |
| **J7 — Teach and reuse a method** | Supply a procedure and worked example, refine the guidance, make the repeatable work reusable and apply it to another assignment. | Appropriate instructions/skill/version/parameters are visible; client evidence does not silently become shared methodology or memory. |
| **J8 — Respond to a trigger and follow through** | A configured schedule or business change starts a scoped procedure; the auditor reviews results, delivers accepted matters and later retests responses/actions. | Trigger identity, coverage, exceptions, delivery state and closure authority remain traceable. A completed agent run does not by itself establish assurance or remediation. |

For J8, a microfinance interest-rate change could trigger checks of the approval, effective-date and implementation evidence defined by that team's procedure. Other triggers might be a new data extract, policy revision, workpaper submission or due remediation action. Each needs an actual supported event source and a bounded mandate; the product must not imply that all business changes were observed.

## 9. Teaching methodology and controlling work

The default learning path is **explain → demonstrate with examples → reuse → review → refine**. Users should get value from a task immediately and make it reusable when that helps.

| Layer | Product role | Necessary distinction |
| --- | --- | --- |
| Task context | The current question, files, example output and completion criteria. | A case-specific instruction is not automatically a team-wide rule. |
| Standing instructions | Persistent working conventions, source-routing guidance and recurring review expectations. | Show what applies and where it came from; resolve conflicts under the actual policy. |
| Skills and references | Reusable procedures, templates, worked examples and optional executable checks. | Discovery, invocation, successful execution and professional acceptance are separate. |
| Tools and agents | Capabilities and delegated responsibilities needed to perform the procedure. | A skill does not grant connector access; an agent title does not create an access boundary. |
| Memory | Helpful recall of permitted prior context and preferences. | Required methods and relied-on evidence need maintained sources; memory alone is insufficient. |
| Enforced policy | Permitted operations, resources, providers and required checkpoints. | Prose instructions and technical enforcement have different responsibilities. |

**Proposed team behavior:** preserve the identity/version of the procedure and significant inputs used for a relied-on output; show authorised overrides; identify affected work when the method changes. Allow review of a reusable-method update before wider adoption when the team's policy requires it. Do not impose a central publishing bureaucracy on every task or replace the user's method with a predefined framework.

## 10. Completion, changes and recovery

The product must distinguish at least these meanings, regardless of final labels: work planned; execution running; blocked or interrupted; artifact produced; checks completed or incomplete; human review requested; revision requested; professionally approved where applicable; delivery attempted; delivery confirmed or outcome uncertain.

These are semantic requirements, not a mandatory universal state machine. A quick advisory answer may need fewer steps than a signed workpaper. The interface must communicate the actual status rather than collapsing everything into “done.”

For remote writeback, the user reviews the destination, specific proposed changes and supporting evidence. The product validates the relevant current state, applies only the authorised action, preserves operation/destination identity and verifies the outcome. If the destination lacks conditional updates or reliable deduplication, the integration must state the limitation and use an appropriate review/reconciliation path. Continuous two-way sync is not the selected baseline.

When source evidence, formulas, methods or reviewed content change, identify affected outputs and approvals. When an agent stops, distinguish cancelled future work from effects already applied. Preserve a user's intervening edits or surface a conflict before replacement. Professional closure requires the configured person's decision and supporting retest/review; an AI assertion or closed task is insufficient.

## 11. Quality and operating requirements

| Area | Draft requirement | Evidence to establish during implementation/testing |
| --- | --- | --- |
| Artifact fidelity | Preserve declared supported features and identify unsupported ones before modification. | Round trips for formulas/calculation state, styles, named ranges, comments, revisions, references, charts, notes and applicable macro/link/signature cases. |
| Analytical reliability | Retain complete input definitions, reconciled populations and checkable derivations. | Known-result fixtures, boundary cases, false/missed exceptions, sampling reproducibility where applicable and reviewer correction effort. |
| Confidentiality and access | Apply the effective identity and policy to files, connectors, artifacts, memory and shared outputs. | Permission/identity tests, cross-client separation, access revocation, delegation and sharing cases. Folder labels alone are insufficient controls. |
| Recoverability | Preserve usable work through interruption, session loss, partial updates and failed delivery. | Crash/cancel/resume, duplicate-trigger, stale-version, uncertain-outcome and recovery/export cases. |
| Team usability | Make task progress, source references and decisions understandable without requiring code expertise. | Practitioner walkthroughs, keyboard/accessibility checks and review tasks with measurable completion/correction effort. |
| Performance and cost | Keep work observable and bounded under the selected limits. | Small/large workload profiles, latency and resource measurements, total cost per accepted deliverable. Numeric targets follow actual team baselines. |
| Portability | Export enough permitted artifacts and relationships for the claimed destination/use. | Reopen/reimport checks and declared losses; migration with verified authority and history. |
| Maintainability | Track feature availability, upstream changes, provider differences and integration contracts. | Compatibility checks for supported versions and regression cases for important workflows. |

Processing policy must address files, execution, inference, connectors/browser traffic, histories/logs, backups and unattended runs separately. A local UI or an Azure/Bedrock selection does not settle all of them. The interface should expose the effective route without overwhelming ordinary work with infrastructure details.

## 12. Acceptance and evaluation plan

These are criteria for evaluating the built product. No scenario is represented as already passed. Initial numerical correctness expectations come from synthetic fixtures, not a universal audit methodology.

A01–A10 and A13–A18 evaluate V1 workbench behavior. A11 separates V1 external authority/export from V2 mode selection/migration; A12 applies to V2 only.

| ID | Acceptance criterion | Requirements |
| --- | --- | --- |
| **A01** | An ad hoc question produces an inspectable output and sources without requiring engagement setup; a follow-up continues from retained work. | P01, P04, P22 |
| **A02** | An external-audit example can use assertions/materiality/substantive work; an advisory example can produce options without mandatory controls or deficiency states. | P10, P20 |
| **A03** | Reconciliation W1 preserves five ledger/six bank source rows, computes totals 4,600/4,750 and explains the 150 difference; revised R5 yields 4,700/4,750 and 50. Duplicate matching is traceable. | P05–P07 |
| **A04** | A stale formula cache is identified; saved external edits are respected; supported comments, named ranges and unrelated content survive or a conflict/limitation is surfaced before overwrite. | P03, P07 |
| **A05** | Workpaper W2 reports one prior and one later approval, preserves supported review metadata and evidence links, and checks policy effective dates before revising the conclusion. | P07, P09, P20 |
| **A06** | Access-review W3 retains seven accounts, flags A2/A5 for investigation and uses explicit valid approval for service account A6. Technical source/script review remains available. | P06, P09, P13 |
| **A07** | Methodology M1 applies approved guidance while treating instructions embedded in evidence as untrusted; missing dependencies and affected work after a method change are visible. | P10, P14, P17 |
| **A08** | Parallel agents preserve references and disclose disagreement; conflicting writes are isolated or resolved; a reviewer-agent response cannot impersonate human approval. | P03, P13, P18 |
| **A09** | A compacted/resumed task retains access to relevant decisions and sources; missing context or changed permissions are identified. Cancellation does not falsely report external rollback. | P04, P14, P17 |
| **A10** | A reviewed remote update identifies destination/fields/version, preserves unrelated fields and confirms resulting state; stale or uncertain outcomes require reconciliation rather than blind retry. | P11, P21 |
| **A11** | V1: show the external record authority and confirm/export work with declared transfer limitations. V2: expose the selected organisation/workspace mode consistently, prevent silent engagement-level switching and verify mode migration. | P19–P22 |
| **A12** | **V2 only:** built-in records preserve identities, relationships, attribution, reviewed versions, amendments and applicable retention/export behavior; changed work cannot silently retain obsolete approval. This is not a V1 acceptance gate. | P18–P21 |
| **A13** | Triggered/scheduled work identifies scope and procedure version, handles duplicate events and distinguishes not received/not run/incomplete/failed/no exceptions reported. | P12 |
| **A14** | Revoked access prevents subsequent prohibited use; reassignment addresses retained work and unattended jobs; snapshots/publications expose only the selected permitted audience/content. | P16–P19 |
| **A15** | Every enabled model/provider/client route reports supported capabilities and respects policy; unsupported operations fail intelligibly without silently changing the processing route. | P02, P03, P15, P17 |
| **A16** | Voice, visual inputs, browser context, migration, convenience controls and other smaller mapped features each have capability-specific acceptance tests. A documented delivery deferral remains an unmet capability requirement and cannot be counted as demonstrated full parity. | P02, P05, P08, P16 |
| **A17** | An advisory presentation preserves the declared supported theme, chart references and notes; material assertions link to analysis and unsupported estimates remain labelled. | P07, P20 |
| **A18** | For representative tasks, measure total effort through acceptance, accuracy, corrections, tool/model costs and recovery outcomes against the team's existing workflow. | P06, P19, P22 |

Detailed W1–W3 are in [artifact validation](research/2026-10-26-methodology/ARTIFACT_VALIDATION.md); M1 is in [the methodology study](CODEX_METHODOLOGY_STUDY.md). Expand these into test specifications during design/implementation. Establish performance and cost thresholds after collecting a baseline; this brief invents none.

## 13. V1 functional mirror and V2 built-in record mode

**V1: the direct functional mirror with external records.** Preserve all mapped Codex capabilities and the adaptations necessary to make them useful for auditors: artifact-aware review, evidence references, procedure skills, specialist analysis, event adapters, context continuity and understandable authority. Retain saved working files, task history, human review assistance, collaboration, monitoring and reviewed external writeback. Advanced automation and continuous assurance are not moved to V2 by the record-mode decision.

**V2: built-in audit-record mode — confirmed scope.** Add native authoritative audit records and their identities, relationships, access, review/sign-off attribution, version history, controlled amendments, applicable retention/deletion/hold behavior, recovery and export. These foundations are required when the V2 mode is delivered. They are not prerequisites for V1's external-record workbench.

**Other V2 candidates: additional domain capability.** Examples for later planning include a broad audit-universe and annual/portfolio planning suite, detailed staffing/capacity/budget management, organisation-wide assurance mapping, quality-programme administration and a general workflow builder. These remain unprioritised candidates, distinct from the confirmed built-in record mode. Ordinary engagement planning assistance, review and follow-up using external records remain in V1 under P20/P21.

The principal phase boundary is decided: V1 external-record workbench, V2 built-in audit-record mode. Detailed sequencing within those phases remains open and must show dependencies and any deferrals. Both modes remain in the product roadmap, and the broad Codex mirror remains the V1 target.

## 14. Dependencies and decisions carried forward

The intended Codex-derived foundation is established. Detailed component selection, UI design, data/storage structures, identity architecture, technology stack and deployment topology belong in subsequent design. Public source availability does not automatically supply every desktop/hosted capability; maintain a source/service route for each feature. See [foundation research](research/2026-10-26-methodology/FOUNDATION_REUSE.md).

Required dependencies include permitted source/component use, supported service authentication, actual team data policies, named integration contracts and access to representative non-sensitive/permitted examples. Testing can demonstrate behavior; it cannot grant provider eligibility or decide an organisation's policy.

The following choices refine the brief later. Recommendations are proposals, not new accepted decisions.

| Decision | Options | Draft recommendation |
| --- | --- | --- |
| Organisation/workspace mode relationship — V2 | A: organisation locks one mode. B: organisation permits workspace-level selection. C: workspace administrators choose independently. | B within organisation policy when V2 adds built-in mode; Q3 A's organisation/workspace scope remains fixed. V1 uses external records. |
| Human/guest collaboration — Q6 | A: private auditor workspace with outputs shared elsewhere. B: audit team and human reviewers, with stakeholder exchange through existing tools. C: audit team plus management/client/evidence-provider access. | B for the selected team validation setting; study the scope of C before committing guest workflows. Q6 remains unselected. |
| Retained supporting evidence | A: references only. B: necessary permitted extracts/snapshots and derivations. C: all imported source copies. | B, subject to actual source rights and retention policy. |
| Cross-engagement recall | A: separate assignment knowledge. B: approved reusable knowledge/carry-forward. C: automatic retrieval across authorised assignments. | B; keep case evidence and prior conclusions explicitly scoped. |
| Reusable-method distribution | A: team-owned instruction/skill files. B: reviewed versioned packages. C: controlled internal catalog with managed rollout. | Begin with A; introduce B/C where team governance justifies them. Preserve the Codex mechanisms in all options. |
| Cost controls | A: task limits. B: team-period budgets. C: both. | C for a team, with actual limits determined from measured workloads. |

Client/format support, initial integration targets, reviewer roles and quantitative operating targets need concrete choices during design. They should not reopen the accepted practice breadth, record modes or shared-file experience.

## 15. Research basis and traceability

The primary inventory contains **76 capability groups and three composition lenses**, with **270 subfeature mappings**, **93 proposed enhancements** and **20 expanded behaviors**. Counts describe the reconciled research inventory; they are not a permanent exhaustiveness claim. The separately discovered GCP/Vertex provider route is retained as a named delta.

- [Product requirement traceability](PRODUCT_BRIEF_TRACEABILITY.md): every C entry and E behavior mapped to this draft, plus domain foundations and the provider delta.
- [Feature map](CODEX_AUDITOR_FEATURE_MAP.md) and [detailed mirror](CODEX_AUDITOR_FEATURE_MIRROR.md): developer-to-auditor behavior and proposed enhancements.
- [Accepted decisions and remaining questions](OPEN_QUESTIONS.md): decision history.
- [Methodology study](CODEX_METHODOLOGY_STUDY.md) and [research pass 2](RESEARCH_PASS_02.md): existing mechanisms, pinned source traces and validation specifications.
- [Diligent study](DILIGENT_AUDIT_STUDY.md) and [crosswalk](DILIGENT_CODEX_CROSSWALK.md): audit-domain references, without importing one vendor's fixed methodology.
- [Claude Code crosswalk](CODEX_CLAUDE_CODE_CROSSWALK.md), [Cowork study](CLAUDE_COWORK_CATALOG.md) and [comparative study](COMPARATIVE_TOOL_STUDY.md): alternative approaches and evidence limitations.

This first draft is ready for product review. The next design work should translate accepted requirements and journeys into interaction flows, information structure and architecture options, with unresolved dependencies visible and testable behavior preserved.
