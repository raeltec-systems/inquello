# Diligent audit workflows × Codex capabilities

**Research cut-off:** October 23, 2026  
**Phase:** scouting and evidence review; no product design or architecture decision.

## Purpose and comparison rules

This crosswalk compares all 78 capability and product-lens entries in the current [Codex capability catalog](CODEX_CAPABILITY_CATALOG.md)—75 capability entries and three product-lens entries—plus six public implementation-map components, for 84 comparison rows total. It compares those entries with audit workflows and public evidence in the [Diligent study](DILIGENT_AUDIT_STUDY.md). It is a workflow-level comparison, not a claim that Diligent uses Codex, that Codex already contains audit-management features, or that similar labels imply equivalent implementations.

The Diligent study found distinct Audit and Projects experiences. Audit documents a path through auditable entities, risk assessments, plans, control testing, findings, and remediation. Projects documents broader project/workpaper workflows, including objectives, risks, procedures, requests, evidence, reviews, reports, and issue remediation. Diligent describes bounded AI capabilities for Projects and Risk Manager; do not generalize those claims to every Diligent app. Public repositories and developer materials do not disclose Diligent's private audit application runtime. The six implementation-map rows are Codex repository components, not additional product capability rows.

### Status labels

- **Mapped** — Diligent documents a close audit-workflow or object counterpart. This does not mean the Codex feature or underlying implementation is present.
- **Adapt** — a useful general mechanism or related workflow exists, but audit-specific meaning, provenance, methodology, permissions, review, or persistence needs adaptation.
- **Adjacent** — related Diligent infrastructure or product exists, but it does not perform the same user task.
- **Unknown** — the public-source study does not establish a Diligent counterpart or enough detail to compare it.

**Review clarification, October 26, 2026:** these labels describe reference relationships, not implementation readiness or coverage in our future product. Workflow analogy and evidence for the underlying mechanism are separate questions. A follow-up inventory must also start from each competitor's own capabilities and from auditor outcomes; matching every Codex row does not establish that those other inventories are exhaustive. See [the research review](RESEARCH_REVIEW.md).

## Two operating modes from the product hypothesis

The user has specified both modes below, now phased as **V1 external records** and **V2 built-in records**. This crosswalk spans the overall roadmap, not simultaneous first-version scope. “End to end” describes carrying out and coordinating work in the conversational platform; formal audit-record authority remains external in V1 and can become native in V2.

| Capability area | External-record mode | Built-in-record mode |
| --- | --- | --- |
| Authority | The practitioner's existing audit or other system remains authoritative. The platform prepares work and outputs, and can connect or hand them off under the user's authority. | The platform provides Diligent-like native audit records and becomes authoritative for the records the practitioner chooses to keep there. This requires a complete records and governance model. |
| Engagement lifecycle | Read or write to external engagements, plans, evidence, approvals, findings, and actions according to connector support and permission. Make handoff status and failed/partial sync visible. | Native engagement, plan, risk/control, procedure/test, evidence/workpaper, finding/action, review/approval, and reporting objects need linked states and history. |
| Evidence and analysis | Keep source identity, location, version, scope, extraction time, transformations, and limitations with generated analyses so outputs can be reconciled with the external file. | Preserve source links and versions alongside the native workpaper, test, conclusion, and reviewer history so another practitioner can reperform the work. |
| Review and approvals | The connected audit system remains the approval authority when that is the practitioner's process. A conversational confirmation is not an official sign-off unless the integration records it there. | Role-based approval states, preparer/reviewer attribution, delegated authority, changes, and retained approval evidence become native product responsibilities. |
| Outputs and exchange | Provide portable documents, spreadsheets, data and metadata, plus supported connectors. Q4 B selects deliberate, reviewable writeback; supported operations still vary by destination. Continuous two-way sync is not the selected baseline. | Provide export, reporting, and portability while maintaining native records, relationships, permissions, and audit history. Diligent's exports are useful examples, not a sufficient requirements list. |
| Governance questions | Which systems, entities, and fields are in scope? Which identities can read/write? How are freshness, retries, conflicts, revocation, and lineage shown? | What is the record schema and lifecycle? How do roles, retention, legal hold, deletion, backups, tenant isolation, exports, and audit logs work? |
| Mode selection | **Selected by the user: organisation/workspace level (Q3 A).** Exact organisation/workspace policy precedence remains to be designed; engagements do not silently switch mode. | Same selected scope. Migration requires an explicit authority handoff and verified preservation of relevant records/history. |

## Audit journey overview

This summary connects Diligent's documented end-to-end workflow to the Codex capability clusters detailed below. Codex capabilities can support the work, but audit-specific objects and controls need adaptation; the table does not claim that Codex already performs these audit functions.

| Diligent workflow slice | Codex capability clusters that could support the work | Crosswalk read | External-record mode | Built-in-record mode |
| --- | --- | --- | --- | --- |
| Audit universe, entities, and risk assessment | Projects/navigation; connected apps and files; analysis; reusable skills/configuration; task context and memory | **Adapt** — Codex can gather context and analyze source material; Diligent's auditable entities, risk factors, and assessment workflow are audit-specific. | Link to source systems and preserve entity/risk provenance; external risk records remain authoritative. | Add native entity/universe, risk assessment, ownership, scoring, and history objects. |
| Engagement planning and approval | Plan mode/task lists; goals; threads; file creation; roles and approval controls | **Adapt** — a generated plan can help structure work, but it is not a formal approved audit plan. | Read/write a connected plan only with explicit permissions and show sync/approval state from the external authority. | Add a plan object with versioning, reviewer roles, approval state, and controlled changes. |
| Scope, objectives, controls, procedures, and tests | Files/repository understanding; instructions and skills; subagents; generated outputs; project configuration | **Adapt** — general tools can prepare procedures and structure work, while audit-specific risk/control/procedure relationships require domain semantics. | Transfer generated scope/procedures and references into the external engagement record. | Maintain linked scope, objective, risk/control, procedure/test, owner, and version records. |
| Evidence requests and collection | Connected apps/MCP; file handling; browser/search; shell/data tools; source identity; sandbox and permissions | **Adapt / Unknown** — Codex offers source and execution mechanisms; Diligent documents requests and evidence handling, but source-specific connectors and complete access behavior need validation. | Make connector identity, scope, freshness, source location, and partial/failure states visible; do not treat a local copy as the source record. | Store evidence metadata, source links, versions, access, and retention alongside the engagement objects. |
| Fieldwork, control testing, and data analysis | Code/shell; analysis/review; parallel agents; generated files; scheduled tasks; tool controls | **Adapt** — general analysis and automation can help, but populations, sampling, test steps, exceptions, and conclusions need methodology-specific support. | Preserve inputs, queries/code, parameters, population/sample definition, and outputs for transfer/reperformance. | Link tests and results to procedures, evidence, exceptions, reviewer decisions, and versioned workpapers. |
| Workpapers, QA review, and sign-off | File creation/editing; diffs and review; thread history; roles; approval gates; shared snapshots | **Adapt** — Codex review surfaces help inspect changes but do not constitute audit QA or professional sign-off. | Use the external system's official reviewer/approval states; export drafts and review evidence as required. | Add preparer/reviewer attribution, sign-off states, change history, retention, and reperformable links. |
| Findings, management response, and action plans | Analysis; document generation; connected apps; human steering/review; notifications | **Adapt** — drafting can be assisted, while cause/effect, significance, disagreement resolution, and action ownership are methodology-specific judgments. | Keep official findings, responses, risk acceptance, and actions in the connected system; show reconciliation status. | Add linked finding, response, action, owner, due date, disposition, and approval records. |
| Remediation, retesting, and follow-up | Scheduled tasks; background work; notifications; connectors; analysis and file outputs | **Adapt** — Diligent and Codex both document scheduling/notifications, but an alert or run does not verify remediation; retesting semantics must be adapted. | Read action status and evidence from external systems; record follow-up work there where authorized. | Track due dates, evidence, retest outcomes, escalation, closure, and risk acceptance as native states. |
| Reporting, analytics, and closure | File generation/previews; analysis; connected sources; project/task context; sharing and export | **Adapt** — Codex can create and review artifacts; Diligent documents audit reports, dashboards, and exports. Audit conclusions, approval, and distribution controls need adaptation. | Package portable outputs and provenance for the practitioner's selected destinations. | Generate reports from native records and preserve approval, version, and dissemination history. |

## Capability-by-capability crosswalk

### Product surfaces and run locations

| Codex catalog capability | Status | Diligent comparison and boundary |
| --- | --- | --- |
| Codex in the ChatGPT desktop app | **Adapt** | Role-based Audit home and the Projects workspace provide audit navigation and status. The study does not document a unified conversational agent task surface. |
| Projects, chats, and navigation | **Adapt** | Audit plans and Projects organize engagements, work, and assignments. Chat continuity, search, archive, and resume behavior are not documented as counterparts. |
| Codex CLI | **Adjacent** | ACLScript, Robots, and Developer Portal APIs support scripting and automation, not a conversational audit CLI. |
| CLI command and session controls | **Adjacent** | Diligent documents script/robot configuration and APIs, not agent-session commands or controls. |
| Agent Command Center (`codex agents`) | **Adapt** | Audit home dashboards show role-specific assignments, statuses, and pending approvals. A shared multi-agent command center is not described. |
| IDE extension | **Unknown** | No audit-oriented IDE extension is documented. |
| Codex Cloud | **Adjacent** | Diligent One is SaaS and some Robots run in the cloud; this does not establish per-task hosted workspaces like Codex Cloud. |
| Mobile and remote control | **Unknown** | Remote steering or approval of a running agent task is not documented. |
| Codex Micro hardware controls | **Unknown** | No counterpart is documented. |
| Local, worktree, and cloud environments | **Adjacent** | ACL Robots have cloud and supported on-premises execution paths. Git worktrees and thread handoff are not described. |

### Public implementation map

| Codex catalog capability | Status | Diligent comparison and boundary |
| --- | --- | --- |
| `codex-rs/core/` | **Unknown** | The study found no public Diligent audit runtime source. User-facing AI descriptions do not reveal the internal harness. |
| `codex-rs/app-server/` and protocol | **Adjacent** | Public APIs and schemas support customer integrations; they are not documented as a local client/server protocol for the audit app. |
| `codex-rs/exec-server/` and sandboxing | **Adjacent** | Robot execution has cloud/on-premises distinctions, but no equivalent per-command sandbox or approval semantics were established. |
| Memory, thread store, state, and rollout trace | **Adapt** | Projects workpapers, engagement records, and limited activity-log information serve audit-record needs. They are not documented as Codex-style thread memory or diagnostic traces; comprehensive retention is unknown. |
| CLI/TUI and SDK | **Adjacent** | The Developer Portal offers APIs, scripts, examples, and toolkits, but no corresponding Codex-style client/TUI package is documented. |
| Docs and protocols | **Adapt** | Diligent Help Center documents workflows and the Developer Portal documents APIs/schemas. Neither exposes a product-internal runtime protocol. |

### Agent runtime and work lifecycle

| Codex catalog capability | Status | Diligent comparison and boundary |
| --- | --- | --- |
| Agent harness / tool loop | **Adapt** | Diligent documents scoped agent analysis and recommendations in Projects/Risk Manager. This is a related user workflow; public evidence does not establish an equivalent harness, tool loop, or orchestration mechanism. |
| Parallel independent read-only lookups | **Unknown** | No comparable agent-runtime optimization is documented. |
| Threads and turns | **Adapt** | The documented agent session retains context for follow-up prompts. Fork, archive, and resume lifecycle operations are not described. |
| Progress, steering, and interruption | **Adapt** | Users trigger analysis, review insights, and decide whether to apply recommendations. Streaming progress, interruption, and queued steering are not documented. |
| Plan mode and task lists | **Adapt** | Audit plans have review, revision, approval, launch, and closure states. A generated agent plan is not equivalent to formal audit-plan approval. |
| Goals and long-running tasks | **Adapt** | Audit plans and Projects track objectives, timelines, and assigned work; persistent agent goals and stopping criteria are not described. |
| Background tasks and parallel work | **Adjacent** | Robots support scheduled automation, and Projects support assignments/reminders. These are not documented as delegated parallel agent tasks. |

### Inputs, reasoning, execution, and outputs

| Codex catalog capability | Status | Diligent comparison and boundary |
| --- | --- | --- |
| Repository and file understanding | **Adapt** | Projects handles workpapers and evidence; Analytics connectors bring in source data. Code-repository indexing and project instructions are not described. |
| Code and shell execution | **Adjacent** | ACL Analytics and Robots support scripts and data analysis. That is a distinct analytics lane, not a general-purpose shell in the audit app. |
| Code Mode | **Unknown** | No comparable model-authored code-cell/tool execution feature is documented. |
| File creation and editing | **Mapped** | Projects uses workpapers, evidence, reports, and engagement artifacts. Codex-style diffs, Git actions, and patch review are not counterparts. |
| Images and visual inputs | **Unknown** | Screenshot or image inputs as an audit workflow are not documented. |
| Image generation and editing | **Unknown** | No counterpart is documented. |
| Composer Predictions | **Unknown** | No counterpart is documented. |
| Web search, built-in browser, browser extension, and Computer Use | **Unknown** | Connectors provide data-source integrations, but agent browser research or GUI operation is not documented. |
| Browser annotations and site integration API | **Unknown** | No counterpart is documented. |
| Appshots | **Unknown** | No counterpart is documented. |
| Analysis and code review | **Adapt** | Diligent documents control testing, findings, and Projects QA review. These are audit analysis/review workflows, not code-diff or software-vulnerability review. |
| Codex Security scans and workbench | **Adjacent** | Diligent supports audits that may cover technology, but the study found no source-code vulnerability scanning and remediation workbench. |
| Desktop editor and PR Chat | **Adapt** | Projects supports workpapers, discussions, comments, and review/sign-off. GitHub PR chat and patch acceptance are not documented audit equivalents. |
| Generated outputs and previews | **Mapped** | Diligent documents PDF plan exports, CSV fieldwork exports, dashboard PDFs, reports, and data tables/visualizations. Codex file previews and annotation are not established as equivalents. |
| Sites and hosted app outputs | **Adjacent** | Dashboards and reports are related outputs; user-created hosted websites/apps comparable to Sites are not documented. |

### Tools, integrations, and customization

| Codex catalog capability | Status | Diligent comparison and boundary |
| --- | --- | --- |
| Built-in tools | **Adapt** | Diligent documents audit functions, Analytics, Robots, and application actions. A general agent's tool registry and execution loop are not described. |
| Connected apps and app catalog | **Adjacent** | Marketplace connectors and Analytics integrations provide data access, but their availability and linkage to each Audit workflow vary and are not fully established. |
| MCP servers and connected tools | **Adjacent** | Public APIs/connectors are integration points; Diligent does not document MCP as an audit-app tool protocol. |
| Plugins and marketplaces | **Adjacent** | Diligent Marketplace provides connectors and related resources, not a Codex-like plugin package and runtime. |
| Skills | **Adapt** | Templates and Frameworks provide repeatable audit content; reusable agent instruction bundles are not documented. |
| Record & Replay | **Unknown** | No counterpart is documented. |
| Repository instructions and configuration | **Adapt** | Templates, Frameworks, risk factors, assessment methods, tags, and app settings support configuration, but not scoped instruction files like `AGENTS.md`. |
| Hooks | **Adjacent** | Robots provide automation and triggers in some workflows; Codex-style lifecycle hooks are not documented. |
| App-server protocol | **Adjacent** | Developer APIs expose customer integration contracts, not the same local streaming protocol. |
| Client-supplied dynamic tools (app-server) | **Unknown** | No comparable per-client dynamic tool registration is documented. |
| Codex SDK, non-interactive execution, and GitHub Action | **Adapt** | Diligent APIs, scripts, and Robots enable programmatic integrations and automation. A general agent SDK or GitHub Action equivalent was not established. |
| Task entry points from connected services | **Unknown** | The study does not establish equivalent agent task launch points from external services. |

### Delegation and concurrent work

| Codex catalog capability | Status | Diligent comparison and boundary |
| --- | --- | --- |
| Subagents | **Adapt** | Diligent describes specialized audit/risk agents and an orchestrator at a high level. Exact runtime, delegation controls, and availability are not established. |
| Side chats, fork, and task references | **Unknown** | No comparable side-chat/fork/task-reference behavior is documented. |
| Worktrees and concurrent tasks | **Adjacent** | Project assignments support concurrent human work; this is not equivalent to isolated agent worktrees or concurrent task execution. |

### Context, memory, and continuity

| Codex catalog capability | Status | Diligent comparison and boundary |
| --- | --- | --- |
| Active context and compaction | **Adapt** | Audit records preserve structured work. Context compaction, token limits, and agent-context carryover are not described. |
| Conversation persistence and history | **Adapt** | Projects/Risk Manager AI sessions retain context for follow-up; full conversation history, archive, and retrieval behavior remain unknown. |
| Memory | **Adapt** | Templates, Frameworks, and object libraries can reuse audit knowledge; persistent agent memory and its boundaries are not documented. |
| Computer History | **Unknown** | No counterpart is documented. |
| Durable instructions vs memory vs skills | **Adapt** | Diligent has reusable templates and Frameworks, but the distinctions among instruction, memory, and executable skill are not documented in the Codex sense. |
| Usage, models, speed, and reasoning controls | **Unknown** | The study documents an AI provider/model detail for a bounded feature but not equivalent user/workspace controls over model, reasoning, or usage. |
| Amazon Bedrock provider | **Mapped** | Diligent documents Amazon Bedrock for specified AI capabilities. This is a provider counterpart only, not an equivalent agent runtime. |
| Organization model gateway | **Unknown** | A tenant-wide model gateway or provider-routing control was not established. |
| Local open-source model provider (`--oss`) | **Adjacent** | Supported on-premises Robots are execution options, not evidence of a local open-weight model provider. |
| Programmatic access and service identities | **Adapt** | Developer APIs and Robots support programmatic access. Identity scope and service-account semantics across the product are not fully mapped. |

### Workflow, review, and operations

| Codex catalog capability | Status | Diligent comparison and boundary |
| --- | --- | --- |
| Git and change review | **Adapt** | Projects offers QA reviews, comments, and sign-off. Git diffs and patch-level code review are different mechanics. |
| Scheduled tasks | **Mapped** | Robots support scheduled analyses/automation; reminders and due dates support scheduled human follow-up. These are not necessarily scheduled agent conversations. |
| Voice and dictation | **Unknown** | No counterpart is documented. |
| Notifications and task visibility | **Mapped** | Audit home, assignment status, due dates, and notifications surface work and pending items. Their agent-run details differ. |
| Pets and floating task companion | **Unknown** | No counterpart is documented. |
| Import and setup migration | **Adjacent** | Data imports and templates help configure/migrate work, but Codex profile/settings migration is a different task. |
| Shared thread snapshots | **Adapt** | Diligent reports, PDFs, and CSVs share audit artifacts, but they are not snapshots of an agent conversation with its exact context. |

### Security, trust, and governance

| Codex catalog capability | Status | Diligent comparison and boundary |
| --- | --- | --- |
| Sandbox and permission profiles | **Adapt** | Diligent role access and cloud/on-prem Robot options are related controls. They do not establish Codex-like command sandbox profiles or per-task filesystem/network boundaries. |
| Approvals and automatic review | **Adapt** | Diligent documents formal audit review/sign-off. Permission to execute an agent action and automated action review are different controls; their detailed Diligent counterparts remain unestablished. |
| Approved cyber model access (Daybreak / Trusted Access) | **Adjacent** | Diligent technology audits may address cyber controls, but the study found no comparable restricted model-access program. |
| Prisma AIRS prompt inspection | **Unknown** | No comparable prompt inspection service is documented. |
| Command rules | **Unknown** | No equivalent command allow/deny rules are documented. |
| Agent Security and managed policy | **Adapt** | Diligent's roles, permissions, and administration provide governance controls. Agent-specific managed policy and security telemetry are not established. |
| Workspace roles, access, and user lifecycle | **Mapped** | Role-based access and assignments are central to Diligent Audit and Projects. The exact matrix across applications remains open. |
| Source/connector identity | **Adapt** | Connectors and integrations access external sources. Exact principal, delegated identity, scope, and provenance behavior need further study. |
| Untrusted inputs and hooks | **Unknown** | The study does not describe prompt-injection handling or hook trust boundaries. |
| Enterprise usage analytics and compliance records | **Adapt** | Diligent has activity/audit logging and reporting, but full event coverage, retention, export, and usage-analytics scope remain unknown. |
| Retention, logs, and telemetry | **Adapt** | Projects/Audit records and limited activity logs support audit visibility; comprehensive telemetry, retention, legal hold, and deletion behavior were not established. |

### Product lens

| Codex catalog capability | Status | Diligent comparison and boundary |
| --- | --- | --- |
| Task workflow | **Mapped** | Audit and Projects document end-to-end audit task lifecycles. This is a reference for workflow coverage, not proof of a conversational Codex-like surface. |
| Agent capability/runtime | **Adapt** | Bounded agentic capabilities are documented for Projects/Risk Manager and broader claims are marketed. Scope, availability, and implementation details need verification. |
| Auditor-tailored workflow | **Adapt** | Diligent offers configuration patterns and more than one audit workflow. How well the product adapts across internal/external audit, advisory, IT/IS, industries, and methodologies remains to be established. |

## What this crosswalk suggests for continued scouting

1. **The two modes change where authority lives.** External-record mode emphasizes connectors, identity, data freshness, lineage, and portable outputs. Built-in-record mode adds native audit objects, state transitions, approval history, retention, legal hold, export, and deletion responsibilities.
2. **Codex contributes a broad work engine.** Its capabilities span surfaces, execution, files/data, tools, agents, context, customization, review, scheduling, collaboration, and governance. Diligent documents audit-domain objects and lifecycle semantics that a general-purpose agent does not supply automatically.
3. **Workflow similarity is strongest in the audit lifecycle.** Planning, assignments, fieldwork artifacts, review, reporting, notifications, and scheduled automation have close documented analogues. Agent runtime, context, general-purpose shell/browser operation, and agent-specific security controls have weaker or unknown Diligent counterparts.
4. **Diligent itself contains multiple workflows.** Preserve the distinction between its newer control-testing Audit app and broader Projects execution workflow; the study also documents no data exchange between them despite record linking.
5. **Practice tailoring remains an evidence question.** Templates, Frameworks, risk factors, and settings are useful examples, but public materials reviewed do not establish comprehensive tailoring across every practice, industry, and methodology the user wants to support.

## Evidence limits and next research questions

This is a document-led crosswalk based on the public-source review in [DILIGENT_AUDIT_STUDY.md](DILIGENT_AUDIT_STUDY.md) and the capability definitions in [CODEX_CAPABILITY_CATALOG.md](CODEX_CAPABILITY_CATALOG.md). It is not a live product comparison. “Unknown” means the reviewed public evidence does not establish a counterpart; it does not prove the feature is absent. A “Mapped” label means a comparable workflow/object is documented, not that internal design or quality is equivalent.

Next, continue market research and authorized product observation around: Audit vs Projects state transitions; evidence lineage and workpaper re-performance; reviewer/manager/CAE authority; agent action approval; role and connector identity; retention, legal hold, export, deletion, and log coverage; mode selection and mixed-mode work; and tailoring across practice types and methods. No implementation or architecture choice is implied by this list.
