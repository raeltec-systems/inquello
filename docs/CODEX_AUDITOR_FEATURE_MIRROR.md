# Full Codex-to-auditor feature mirror

**Date:** October 26, 2026. **Phase:** research and functional mapping. The auditor side describes proposed behavior, not an implemented product. Accepted product phasing is V1 external-record workbench and V2 built-in audit-record mode; detailed architecture and implementation are not selected.

Coverage: **76 capability groups**, **3 separately labelled composition lenses**, **270 subfeature mappings** (261 within capability groups), **93 proposed audit enhancements**, and **20 expanded behavior entries** linked to the parent groups. The six public component patterns are also mapped separately. Expanded entries unpack grouped capabilities and are not added to the independent feature count.

Start with [the comparison overview](CODEX_AUDITOR_FEATURE_MAP.md) for every feature side by side. [Nine worked examples](CODEX_AUDITOR_WORKED_EXAMPLES.md) show how the capabilities combine. Continuous assurance is one example; the inventory covers the full existing catalog, including everyday assistance, execution, artifact work, collaboration, customization, providers, administration and peripherals.

## Mapping rule

Preserve the role and working experience of each Codex feature, then translate its inputs, actions and results into auditor work. Audit enhancements explain what must change to make that equivalent useful. They belong to this first mirror layer even when technically substantial. A later V2 exercise will consider additional capabilities beyond the mirror; this mapping does not silently defer necessary adaptations.

Shared supported saved files are a baseline: the auditor can review work here or continue in Excel, Word, PowerPoint and other tools. An editor API is not required merely to read or write a compatible saved artifact. Live application state, embedded assistance and remote records are separate capabilities. V1 uses external audit records; V2 adds built-in authoritative audit records. An editor choice does not determine record authority.

## Evidence and completeness

The frozen [source inventory](mapping/2026-10-26/SOURCE_INVENTORY.json) preserves the earlier catalog descriptions, stable C IDs, source lines and file hash. Entries cite inherited October 22 evidence or specifically checked October 26 sources. The official documentation index was revisited to unpack integrations, Security workflows and WebMCP. This is coverage of the named documented inventory and its mapped behaviors, not proof of every undocumented feature, account-specific rollout, or proprietary implementation. No signed-in behavior or audit workflow was executed for this mapping.

The user-requested Microsoft Azure Foundry provider is added as C54A beside Bedrock, with [a separately sourced addition](mapping/2026-10-26/PROVIDER_ADDITIONS.json). The original 78-entry inventory and its IDs remain preserved. The Azure entry documents the supported Azure OpenAI route and identifies what still needs validation for the auditor product.

Source maturity and service eligibility are preserved as reference conditions. They do not exclude an intended counterpart; they identify what needs evidence before implementation. The public-source mechanism is not assumed to include every desktop or hosted service. [Earlier source/reuse review](RESEARCH_REVIEW.md).

Each feature records the developer behavior, proposed auditor use, trigger, inputs, action, outputs, auditor control, smaller behavior mappings, enhancement rationale and remaining boundary. The readable files are generated from [the structured mapping](CODEX_AUDITOR_FEATURE_MIRROR.json); [coverage checks](mapping/2026-10-26/COVERAGE_REPORT.json) reconcile all baseline IDs.

## Product surfaces and run locations

### C01

**Codex in the ChatGPT desktop app → Auditor desktop workbench**

**Developer behavior:** The desktop experience brings projects, chats, agent activity, files, execution tools, review, configuration and execution-location choices into one workspace. Available features differ by operating system, account and client release.

**Auditor trigger:** The auditor opens a workspace or starts a task.

**Inputs:** Working folder and audit materials; Task instructions and permitted tools; Existing conversations and outputs.

**Proposed auditor action:** Coordinate audit work through conversation while keeping source material, workpapers, calculations and agent progress inspectable beside it.

**Outputs:** Reviewable work artifacts; Task progress and action history; Links to existing files and tools.

**Auditor control:** Choose the task and execution location, inspect changes, steer work, and open the same saved artifacts in external editors.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Chat beside files and previews | Conversation beside evidence and workpapers |
| Agent activity and terminal | Visible analysis jobs and inspectable execution |
| Git/review views | Review changed audit work and its supporting calculations |
| Settings, skills and plugins | Configure the same assistance mechanisms around audit work |

**Audit-specific enhancements:**

- Show workbook ranges, document passages and evidence references beside the conversation. Auditors review work in units that differ from code lines.
- Provide an explicit open-in-existing-tool path for supported artifacts. Review must continue in established applications without replacing the underlying work files.

**Example:** Ask for a loan-interest reconciliation, inspect its workbook beside the chat, then continue reviewing that workbook in Excel.

**Boundary / remaining evidence:** Retain the working experience while replacing developer emphasis with audit materials. Embedded editing depth and platform parity require validation; a desktop workspace alone does not establish formal audit records.

**Codex evidence:** [File previews and review surfaces](https://learn.chatgpt.com/docs/artifacts-viewer?surface=app) (checked-2026-10-26); [Desktop execution choices](https://learn.chatgpt.com/docs/environments/modes) (checked-2026-10-26). Baseline: C ID and source line 19 in the frozen inventory.

### C02

**Projects, chats, and navigation → Audit workspaces and focused work conversations**

**Developer behavior:** Projects group files, instructions and chats; local projects can attach folders. Each chat retains its own transcript. Navigation supports search, renaming, pinning and archival. CLI and IDE project context follow their directory or workspace.

**Auditor trigger:** Start a new assignment, standalone investigation or conversation within an existing workspace.

**Inputs:** Related folders and sources; Workspace instructions; Prior tasks and named outcomes.

**Proposed auditor action:** Group related audit work and start separate conversations for distinct outcomes, with explicit access to the relevant files and guidance.

**Outputs:** Organised task history; Searchable work conversations; Reusable workspace context.

**Auditor control:** Select attached folders, rename or pin recurring work, and archive or restore completed conversations.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Projectless chat | Standalone audit question without creating an engagement |
| Multiple project chats | Separate workstreams sharing selected materials |
| Attached primary and secondary folders | Related evidence and working-file locations with explicit guidance scope |
| Search, pin, rename, archive and restore | Find and organise current and completed audit conversations |

**Audit-specific enhancements:**

- Use assignment, client and reporting-period labels while retaining standalone tasks. Auditors must distinguish related work without forcing every request into an engagement.
- Show which instructions and folders belong to the current task. Similar files from different periods or clients can otherwise be mistaken for the applicable material.

**Example:** Keep rate-change testing, borrower communications review and report drafting in separate chats under the same assignment.

**Boundary / remaining evidence:** A workspace can support ad hoc work or a formal engagement. Folder organisation and pinning do not themselves grant access or enforce confidentiality; primary-folder instruction discovery needs explicit treatment.

**Codex evidence:** [Projects and chats](https://learn.chatgpt.com/docs/projects) (checked-2026-10-26). Baseline: C ID and source line 20 in the frozen inventory.

### C03

**Codex CLI → Auditor command-line and batch work client**

**Developer behavior:** The CLI supports interactive investigation, planning, file edits, tool execution and review within a directory. Non-interactive codex exec can run scripted tasks and emit structured events for other processes to consume.

**Auditor trigger:** An auditor or analyst starts an interactive command, or an authorised job invokes a saved task.

**Inputs:** Workspace path and task prompt; Source files and procedures; Configured tools and permissions.

**Proposed auditor action:** Offer the same audit assistance through a terminal for technical auditors, data analysts and repeatable batch jobs.

**Outputs:** Working files and analysis results; Readable task response; Structured execution events for automation.

**Auditor control:** Set working directory, execution scope and requested output; interrupt interactive work or review batch results before relying on them.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Interactive repository work | Interactive investigation of an audit folder |
| Non-interactive exec | Reusable headless audit jobs |
| Structured JSONL events | Machine-readable job progress and results |
| Resume and cloud handoff | Continue eligible work through another execution surface |

**Audit-specific enhancements:**

- Accept named audit procedures and structured procedure parameters through the command surface. Repeated analyses need explicit period, population and criteria inputs rather than only a freeform prompt.

**Example:** An IT auditor runs a saved access-review procedure against an approved directory export and receives an exceptions file.

**Boundary / remaining evidence:** Keep the CLI as a legitimate surface rather than forcing all auditors into it. Installed analysis tools, input formats and event consumers determine what an individual job can do.

**Codex evidence:** [CLI commands](https://learn.chatgpt.com/docs/cli/reference) (inherited-2026-10-22); [Non-interactive execution](https://learn.chatgpt.com/docs/non-interactive-mode) (inherited-2026-10-22). Baseline: C ID and source line 21 in the frozen inventory.

### C04

**CLI command and session controls → Audit task command and session controls**

**Developer behavior:** CLI and slash commands manage sessions, plans, goals, models, permissions, tools and review. Commands also expose context compaction, configuration, keymaps and reconnect controls. Maturity varies: some cloud and remote-control commands remain experimental.

**Auditor trigger:** The auditor invokes a task control through a command, shortcut or equivalent interface action.

**Inputs:** Current task state; Selected command and parameters; User configuration and policy.

**Proposed auditor action:** Expose the same task-management operations using audit-friendly labels while preserving access for power users.

**Outputs:** Updated task or session state; Requested review or plan; Visible configuration and status.

**Auditor control:** Explicitly choose operations that change execution, permissions, context or task direction.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Start, resume, fork and export | Manage investigation sessions and alternate approaches |
| Plan, goal and review | Control a work approach, objective and review pass |
| Model, status and compaction | Control effort and inspect available working context |
| Permissions and sandbox | Adjust permitted analysis actions within policy |
| Agents, subagents, apps, plugins and hooks | Manage assistance and extension mechanisms |
| Login, logout and project navigation | Select identity and working scope |
| Config, keymap, editor and completions | Personalise controls without changing audit methods |
| Daemon reconnect and remote/cloud handoff | Recover or move supported sessions |

**Audit-specific enhancements:**

- Expose audit-friendly labels and descriptions for task controls while retaining power-user commands. Users should understand execution, review and context operations without knowing developer terminology.

**Example:** Pause analysis, inspect its status, revise the plan, change the model effort, then resume the same investigation.

**Boundary / remaining evidence:** Command names are not audit controls by themselves. Preserve actual semantics and maturity labels; do not imply experimental remote or cloud commands are universally available.

**Codex evidence:** [CLI command reference](https://learn.chatgpt.com/docs/cli/reference) (inherited-2026-10-22); [Interactive commands](https://learn.chatgpt.com/docs/developer-commands) (inherited-2026-10-22). Baseline: C ID and source line 22 in the frozen inventory.

### C05

**Agent Command Center (`codex agents`) → Audit agent and workstream command center**

**Developer behavior:** The command center lists chats and their status on a shared local or remote server and lets a user switch into them. It is a coordination surface separate from spawning delegated subagents.

**Auditor trigger:** The auditor opens the task command center to inspect ongoing work.

**Inputs:** Accessible server and chats; Task status and attention signals; User-selected workstream.

**Proposed auditor action:** Provide one place to see active audit investigations, identify work awaiting input, and enter the relevant conversation.

**Outputs:** Workstream status list; Direct access to task context; Attention items.

**Auditor control:** Choose which investigation to enter and respond to its questions; visibility remains bounded by accessible work.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Local/remote server task list | Accessible audit workstreams by execution server |
| Task status | Identify work running, finished or requiring attention |
| Switch into a chat | Resume the chosen investigation in context |

**Audit-specific enhancements:**

- Display assignment and tested period beside each workstream's status. Auditors need to distinguish similarly named investigations across clients and periods.

**Example:** Move between a loan recalculation, an access review and report preparation without losing each conversation's context.

**Boundary / remaining evidence:** Preserve the distinction between finding a running task and directing a delegated agent. A shared server list does not by itself provide organisation-wide audit portfolio management or new access rights.

**Codex evidence:** [codex agents command](https://learn.chatgpt.com/docs/cli/reference) (inherited-2026-10-22). Baseline: C ID and source line 23 in the frozen inventory.

### C06

**IDE extension → Assistance inside an auditor's working application**

**Developer behavior:** The IDE extension provides Codex conversation and tools within supported code editors, using the open workspace and selected context. Its integration, orchestration and review features differ from desktop and CLI clients.

**Auditor trigger:** The auditor opens an available extension in a supported working tool and asks about selected material.

**Inputs:** Current workbook, document or presentation; Selected content where exposed; Task instructions and available tools.

**Proposed auditor action:** Bring conversation and contextual assistance beside the work already open in an auditor's application, using supported integration mechanisms.

**Outputs:** Contextual explanations and proposed changes; Updated artifacts where supported; A continuing task conversation.

**Auditor control:** Select the material and requested action, inspect proposed changes, and choose whether to apply them.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Conversation inside editor | Conversation beside current audit work |
| Workspace/open-file context | Current artifact context under host permissions |
| Selection context | Ask about a selected range, paragraph or slide |
| Review and apply changes | Inspect and accept supported changes without leaving the working tool |

**Audit-specific enhancements:**

- Map host selection to stable range, paragraph or slide references where the host supports them. Contextual assistance must identify the precise material being discussed.
- Expose whether context is saved file state or live application state. The agent and auditor must not unknowingly work from different versions.

**Example:** Select an exceptions table in a supported Excel extension and ask the agent to explain differences or prepare follow-up questions.

**Boundary / remaining evidence:** This directly mirrors the IDE-extension experience. It is additional to shared-file assistance; basic use of saved Office files does not depend on building an add-in. Live selection and unsaved state require explicit host support.

**Codex evidence:** [IDE workspace and selection context](https://learn.chatgpt.com/docs/projects) (checked-2026-10-26); [IDE capability baseline](https://learn.chatgpt.com/docs/codex/ide) (inherited-2026-10-22). Baseline: C ID and source line 24 in the frozen inventory.

### C07

**Codex Cloud → Remote audit execution workspace**

**Developer behavior:** Cloud tasks run in prepared remote workspaces with selected repositories, dependencies and tools. Work can continue while the local computer sleeps, and users can inspect results and follow up on the task.

**Auditor trigger:** The auditor starts or delegates an eligible task to a prepared cloud environment.

**Inputs:** Explicitly supplied working materials; Prepared analysis tools and procedure; Authorised remote service access.

**Proposed auditor action:** Execute an audit analysis or document task remotely and return its artifacts and task history for review.

**Outputs:** Analysis results and workpapers; Execution progress and logs; Proposed changes or a review package.

**Auditor control:** Select what is provided to the remote task, follow progress, stop work and review its returned outputs.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Prepared remote environment | Reusable audit execution environment |
| Task-specific working files | Scoped materials for a remote analysis |
| Continue while computer sleeps | Long remote analyses independent of the workstation |
| Inspect and follow up results | Review findings and request further testing in context |

**Audit-specific enhancements:**

- Make the supplied dataset version and procedure version visible in remote results. The reviewer must know what an unattended analysis actually examined.

**Example:** Run an overnight reconciliation on an approved extract and review the exceptions the following morning.

**Boundary / remaining evidence:** A cloud task cannot assume access to the auditor's local Excel session, local-only folders, VPN or browser sign-in. Residency, tools and permissions depend on the selected execution route.

**Codex evidence:** [Codex Cloud](https://learn.chatgpt.com/docs/cloud) (inherited-2026-10-22); [Prepared cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments) (inherited-2026-10-22). Baseline: C ID and source line 25 in the frozen inventory.

### C08

**Mobile and remote control → Remote steering and review of audit work**

**Developer behavior:** Supported mobile and remote clients can start, steer, approve and review tasks running on a connected host or in Cloud. Execution retains the chosen host's files, tools and permissions; the mobile device is a control surface.

**Auditor trigger:** The auditor connects from a supported remote device to accessible work.

**Inputs:** Connected execution host or cloud task; Current task status; User instructions or approval response.

**Proposed auditor action:** Let the auditor monitor and steer an investigation away from the workstation while preserving its execution context.

**Outputs:** Task updates and reviewable results; Recorded steering or decisions; Continued work on the execution host.

**Auditor control:** Choose the host and task, inspect what an approval authorises, and interrupt or revise the work.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Start and steer remotely | Direct audit work from another device |
| Remote approvals and review | Respond to scoped requests and inspect findings |
| Host-bound execution | Retain the authorised data and tool environment |
| Supported host handoff | Move an eligible investigation with explicit context transfer |

**Audit-specific enhancements:**

- Present concise findings with accessible supporting evidence on the remote review surface. An auditor away from the desk needs enough context to steer responsibly.

**Example:** During a site visit, check an ongoing reconciliation and tell the agent to investigate one flagged branch further.

**Boundary / remaining evidence:** Phone access does not move all data or execution onto the phone. Mobile remote workflows and the experimental CLI remote-control command have different maturity and platform conditions.

**Codex evidence:** [Mobile task control](https://learn.chatgpt.com/docs/mobile) (inherited-2026-10-22); [Remote hosts and connections](https://learn.chatgpt.com/docs/remote-connections) (inherited-2026-10-22). Baseline: C ID and source line 26 in the frozen inventory.

### C09

**Codex Micro hardware controls → Physical controls for audit task navigation**

**Developer behavior:** Codex Micro is a limited-run input device whose keys and other controls can reflect chat status and invoke desktop actions, skills, voice and navigation. Availability depends on hardware, companion software and operating-system permissions.

**Auditor trigger:** The auditor presses or turns an assigned physical control.

**Inputs:** User-defined task/action bindings; Current workstream status; Connected supported hardware.

**Proposed auditor action:** Offer optional physical shortcuts to switch investigations, dictate instructions, invoke a procedure or inspect a task needing attention.

**Outputs:** Selected conversation or action; Physical status indication; Invoked task control.

**Auditor control:** Choose bindings and keep the meaning of consequential commands visible before using them.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Agent Keys show chat status | Physical indicators for active audit tasks |
| Command Keys invoke actions/skills | Shortcuts to configured procedures and work controls |
| Stick, dial and voice controls | Navigate work and dictate observations |

**Audit-specific enhancements:**

- Name bindings with the audit task and action they invoke. A shortcut must remain understandable when several assignments are active.

**Example:** Bind keys to three active assignments and use a voice control to add an observation during a walkthrough.

**Boundary / remaining evidence:** This is retained in the feature mirror as an optional peripheral. It does not require designing new hardware, and a physical approval key cannot establish professional sign-off semantics by itself.

**Codex evidence:** [Codex Micro hardware](https://learn.chatgpt.com/docs/features/codex-micro) (inherited-2026-10-22). Baseline: C ID and source line 27 in the frozen inventory.

### C10

**Local, worktree, and cloud environments → Choice of working location and isolated analysis copies**

**Developer behavior:** A task can run in its local project directory, an isolated Git worktree, or a remote workspace created from a published environment. Supported handoff changes where work runs and which working files it uses.

**Auditor trigger:** The auditor starts a task or moves eligible work to another environment.

**Inputs:** Source workspace and permitted materials; Selected execution location; Analysis tools and configuration.

**Proposed auditor action:** Offer direct work on current artifacts, an isolated working copy for parallel investigation, or prepared remote execution.

**Outputs:** Changed working artifacts; Separately reviewable analysis alternatives; Task context tied to its environment.

**Auditor control:** Select the environment, understand its data access, and reconcile results before replacing shared working files.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Local mode | Work on authorised current files |
| Worktree mode | Isolate competing edits or investigation variants |
| Cloud mode | Run with explicitly supplied remote materials |
| Environment handoff | Move eligible work while making context and file changes explicit |

**Audit-specific enhancements:**

- Support isolated copies or versions of supported audit artifacts with explicit reconciliation of changes. Office files cannot be assumed to merge like source-code text.

**Example:** Compare two sampling approaches in isolated work areas while retaining the original population extract.

**Boundary / remaining evidence:** Git worktrees remain usable for suitable versioned material. Applying isolation to complex Office files requires checking copy/version/merge behavior; neither a worktree nor a working copy is an independent confidentiality boundary.

**Codex evidence:** [Execution modes](https://learn.chatgpt.com/docs/environments/modes) (checked-2026-10-26); [Git worktree lifecycle](https://learn.chatgpt.com/docs/environments/git-worktrees) (inherited-2026-10-22). Baseline: C ID and source line 28 in the frozen inventory.

## Agent runtime and work lifecycle

### C11

**Agent harness / tool loop → Audit agent execution loop**

**Developer behavior:** The harness maintains turn state, requests model responses, routes tool calls, applies relevant permissions, streams activity and persists supported task history. The model proposes work while tools perform permitted operations.

**Auditor trigger:** An auditor submits a task or a configured task receives an authorised continuation.

**Inputs:** Objective and working context; Available tool definitions; Permissions and prior tool results.

**Proposed auditor action:** Use the same iterative loop to inspect evidence, calculate or transform data, inspect results, revise work and explain the outcome.

**Outputs:** Working artifacts and findings; Tool results and visible progress; Resumable task context.

**Auditor control:** Steer the objective, set accessible resources, respond to approvals and stop work.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Model requests and tool routing | Reason over evidence and execute authorised analyses |
| Tool-result feedback loop | Investigate further based on actual results |
| Permission enforcement | Keep actions within the task's authority |
| Streaming and persistence | Make work inspectable and continuable |

**Audit-specific enhancements:**

- Supply audit procedures, artifact-aware tools and evidence context to the retained execution loop. The loop is general-purpose; the relevant criteria and work objects make its assistance useful to auditors.

**Example:** Investigate a reconciliation difference by reading extracts, running a calculation, inspecting unmatched items and drafting an explanation.

**Boundary / remaining evidence:** The audit mirror changes tools, context and procedures while preserving the execution loop. The public harness is separate from model services, hosted integrations and the complete desktop interface.

**Codex evidence:** [Open agent harness and client boundary](https://developers.openai.com/blog/codex-as-a-platform) (inherited-2026-10-22); [Task and tool protocol](https://learn.chatgpt.com/docs/app-server) (inherited-2026-10-22). Baseline: C ID and source line 67 in the frozen inventory.

### C12

**Parallel independent read-only lookups → Concurrent retrieval of independent audit context**

**Developer behavior:** Documented CLI changes allow independent read-only lookups, including skill, memory and conversation-history reads, to run concurrently. This is a retrieval optimisation, separate from delegated subagents and concurrent writes.

**Auditor trigger:** A task needs several independent pieces of context.

**Inputs:** Independent context requests; Permitted skills, memory or history; Source-specific results or failures.

**Proposed auditor action:** Retrieve eligible independent guidance and task history concurrently, then combine the returned context for the main investigation.

**Outputs:** Retrieved context with its source; Individual lookup failures; A combined working context.

**Auditor control:** Choose accessible sources and inspect material used; source permissions remain unchanged by concurrent retrieval.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Independent skill reads | Retrieve relevant procedures without serial delay |
| Memory and conversation-history reads | Load eligible prior context alongside instructions |
| Single-agent result synthesis | Main investigator reconciles the returned context |

**Audit-specific enhancements:**

- Retain source and assignment scope on retrieved guidance and history. Concurrent retrieval must not blend another client's facts or a superseded method into the task.

**Example:** Load the configured reconciliation procedure and the current task's earlier decisions at the same time.

**Boundary / remaining evidence:** Preserve the narrow documented scope. Do not infer safe simultaneous workbook changes, unrestricted parallel connector requests, or a guarantee that every tool read can execute concurrently.

**Codex evidence:** [Parallel read-only lookup release notes](https://learn.chatgpt.com/docs/changelog) (inherited-2026-10-22). Baseline: C ID and source line 68 in the frozen inventory.

### C13

**Threads and turns → Persistent audit investigations and work turns**

**Developer behavior:** Threads can be started, read, resumed, forked, listed, archived or deleted through supported interfaces. Turns accept input, stream execution and reach completed, failed or interrupted states while retaining their thread context.

**Auditor trigger:** Start a new investigation or send another instruction to existing work.

**Inputs:** Task history and current instructions; Current working files; Thread state and access scope.

**Proposed auditor action:** Maintain a continuing audit conversation across questions, analysis runs, corrections and review responses.

**Outputs:** Task transcript and artifacts; Turn completion or failure status; Alternative investigation branches.

**Auditor control:** Resume an investigation, fork a different approach, interrupt a turn and manage chat visibility under applicable policy.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Start/read/list/resume | Maintain and revisit investigations |
| Fork | Explore another approach while preserving prior conversation |
| Archive/delete | Manage chat lifecycle subject to record policy |
| Completed/failed/interrupted turns | Distinguish task outcomes and unfinished analysis |

**Audit-specific enhancements:**

- Associate relied-on outputs with the input versions used in their turn. Resuming a conversation against changed evidence should not silently reuse an old conclusion.

**Example:** Resume an inventory investigation when missing count sheets arrive, retaining earlier questions and results.

**Boundary / remaining evidence:** A chat's current files may have changed since its earlier turn. Transcript persistence, archiving and deletion are distinct from approved workpaper retention or immutable audit records.

**Codex evidence:** [Thread and turn lifecycle](https://learn.chatgpt.com/docs/app-server) (inherited-2026-10-22). Baseline: C ID and source line 69 in the frozen inventory.

### C14

**Progress, steering, and interruption → Visible and steerable audit execution**

**Developer behavior:** Clients stream messages, tool activity, command output, edits and approval requests. Supported surfaces let users answer questions, send follow-ups, steer or queue instructions, and interrupt the current turn.

**Auditor trigger:** An analysis is running and the auditor observes progress or supplies new direction.

**Inputs:** Current execution state; User clarification or correction; Questions and approval requests.

**Proposed auditor action:** Keep analysis visible and let the auditor correct scope, explain context or stop an unsuitable line of work as it develops.

**Outputs:** Updated task direction; Visible intermediate results; Completed or interrupted work state.

**Auditor control:** Inspect actual tool results, respond to the agent, and stop the task without assuming already completed actions are undone.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Stream tool activity and edits | Inspect ongoing analysis and artifact changes |
| Answer questions and approvals | Supply missing context or scoped authorisation |
| Steer or queue follow-ups | Refine the investigation during work |
| Interrupt | Stop further work and inspect partial outputs |

**Audit-specific enhancements:**

- Explain changed testing scope and identify results affected by a steering correction. A revised criterion may invalidate earlier calculations even though the conversation continues.

**Example:** During procurement analysis, clarify which cancelled orders belong outside the population and ask the agent to revise the calculation.

**Boundary / remaining evidence:** Progress narration does not prove an action succeeded. Interruption and queued steering must preserve partial results and make unfinished work clear; behavior depends on the execution path.

**Codex evidence:** [Steering long-running work](https://learn.chatgpt.com/docs/long-running-work) (inherited-2026-10-22); [Streaming and interruption](https://learn.chatgpt.com/docs/app-server) (inherited-2026-10-22). Baseline: C ID and source line 70 in the frozen inventory.

### C15

**Plan mode and task lists → Reviewable audit task planning**

**Developer behavior:** Supported clients can produce a plan and clarifying questions before making changes, expose a task checklist, and let the user refine the proposed approach. The plan is working guidance generated within the task.

**Auditor trigger:** The auditor asks for an approach before analysis or artifact changes begin.

**Inputs:** Audit question and intended output; Available sources and constraints; Applicable procedure or methodology guidance.

**Proposed auditor action:** Draft the sequence of work, identify missing evidence and propose checks that the auditor can revise before execution.

**Outputs:** Proposed task plan; Clarifying questions; Visible work checklist.

**Auditor control:** Modify scope, methods and stopping conditions, then explicitly move from planning to execution where required.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Plan before edits | Agree the analysis approach before changing work |
| Clarification questions | Resolve scope and missing evidence |
| Editable task checklist | Track the proposed testing steps |

**Audit-specific enhancements:**

- Express plans using objective, population, procedure, criteria, expected output and outstanding evidence. These elements let an auditor evaluate whether a proposed analysis addresses the question.

**Example:** Plan an external-audit account analysis, identifying the assertions, supplied criteria, relevant records, procedure and expected supporting work.

**Boundary / remaining evidence:** This mirrors planning assistance. A model-generated checklist is not automatically an authorised engagement work program; professional approval requirements come from the applicable practice and record workflow.

**Codex evidence:** [Planning command surface](https://learn.chatgpt.com/docs/developer-commands) (inherited-2026-10-22); [Planning and context practices](https://learn.chatgpt.com/docs/learn/best-practices) (inherited-2026-10-22). Baseline: C ID and source line 71 in the frozen inventory.

### C16

**Goals and long-running tasks → Persistent objectives for sustained audit work**

**Developer behavior:** Goals retain an objective, completion criteria and steering context while work continues across turns. Supported controls inspect, edit, pause, resume or clear the goal. Goal state is separate from general memory and reusable instructions.

**Auditor trigger:** The auditor sets a sustained objective with explicit completion conditions.

**Inputs:** Objective and permitted scope; Completion criteria and limits; Current task evidence and progress.

**Proposed auditor action:** Continue a bounded investigation through repeated analyses until its completion conditions are met, it needs input, or the auditor stops it.

**Outputs:** Progress toward the objective; Completed work products; Outstanding blockers or unfinished tests.

**Auditor control:** Inspect and revise the objective, pause or resume it, and decide when the evidence supports ending the task.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Objective and stopping criteria | Bounded investigation outcome |
| Automatic continuation | Continue eligible work across task turns |
| Inspect/edit/pause/resume/clear | Retain control of sustained audit work |

**Audit-specific enhancements:**

- State completion conditions in terms of reconciled populations, explained exceptions or reviewed outputs. A finished command or generated report is not necessarily the requested audit outcome.

**Example:** Reconcile the approved inventory extract to its control total and explain material unmatched items within an agreed time or cost allowance.

**Boundary / remaining evidence:** A persistent goal is not a schedule or an event subscription. Completing a task objective does not itself approve an audit conclusion or authorise scope expansion.

**Codex evidence:** [Persistent objectives and controls](https://learn.chatgpt.com/docs/long-running-work) (inherited-2026-10-22); [Persisted goals feature setting](https://learn.chatgpt.com/docs/config-file/config-reference) (checked-2026-10-26). Baseline: C ID and source line 72 in the frozen inventory.

### C17

**Background tasks and parallel work → Concurrent audit work in the background**

**Developer behavior:** Supported clients keep long commands, tasks and delegated work running while users attend to other work. Status views expose active or completed tasks and work needing attention, subject to host and client behavior.

**Auditor trigger:** An auditor starts a longer job or multiple independent workstreams.

**Inputs:** Scoped tasks and permitted data; Execution resources; Task-specific instructions and tools.

**Proposed auditor action:** Run eligible independent audit tasks concurrently and surface their results or requests for input without blocking unrelated work.

**Outputs:** Completed analyses or artifacts; Per-task status and failures; Requests for clarification or approval.

**Auditor control:** Inspect and stop each task, prioritise attention, and review results before relying on them.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Long-running commands | Allow large analyses to finish while other work continues |
| Independent concurrent tasks | Separate audit procedures running in parallel |
| Attention and completion states | Surface results, failures and required input by workstream |

**Audit-specific enhancements:**

- Identify shared-file conflicts and separate analysis output destinations before concurrent edits. Parallel audit tasks may otherwise overwrite the same working file.

**Example:** Run duplicate-payment analysis while separately drafting walkthrough questions from a process narrative.

**Boundary / remaining evidence:** Background execution depends on host availability and the tools used. Two jobs editing the same workbook need coordination; GUI automation may occupy the foreground rather than allowing simultaneous human use.

**Codex evidence:** [Long-running and parallel work](https://learn.chatgpt.com/docs/long-running-work) (inherited-2026-10-22); [Foreground GUI execution limits](https://learn.chatgpt.com/docs/computer-use) (checked-2026-10-26). Baseline: C ID and source line 73 in the frozen inventory.

## Inputs, reasoning, execution, and outputs

### C18

**Repository and file understanding → Understanding an existing audit work folder**

**Developer behavior:** Codex reads and searches relevant workspace files, follows applicable repository instructions and uses attached or path-selected context to explain unfamiliar material. Actual read access depends on the execution environment and permission boundary.

**Auditor trigger:** The auditor asks a question about an existing collection of work or supplies specific files.

**Inputs:** Authorised source documents and data files; Folder guidance and task context; Explicit paths or attachments.

**Proposed auditor action:** Find relevant material, explain how files relate, identify procedures and prior work, and ground the task in the existing audit context.

**Outputs:** Source-linked explanation; Relevant file references; Identified gaps or contradictions.

**Auditor control:** Select sources and scope, inspect cited material, and correct the agent's interpretation.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Search/read workspace | Locate and read relevant evidence and workpapers |
| Follow repository guidance | Apply assignment and method instructions |
| Explain unfamiliar code | Explain unfamiliar processes, calculations or data structures |
| Attached/path-selected context | Direct the agent to specific supporting material |

**Audit-specific enhancements:**

- Read supported audit formats and retain references to the relevant sheet, range, page or passage. Source-backed explanations require more precise references than a filename alone.
- Report inaccessible or unreadable material separately from searched material. An auditor must understand the actual scope of the investigation.

**Example:** Explain a supplier-onboarding process using its policy, workflow narrative, configuration export and prior workpapers.

**Boundary / remaining evidence:** File discovery does not prove population completeness or document authenticity. Complex formats require appropriate readers, and saved-file access does not imply visibility into unsaved application state.

**Codex evidence:** [File context and repository investigation](https://learn.chatgpt.com/docs/learn/best-practices) (inherited-2026-10-22); [Scoped project instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md) (inherited-2026-10-22). Baseline: C ID and source line 79 in the frozen inventory.

### C19

**Code and shell execution → Executable audit analysis and utility work**

**Developer behavior:** Codex can run available commands, scripts and project tools, inspect their output and use results in later reasoning. Execution and file changes remain subject to the relevant environment, sandbox and approval policy.

**Auditor trigger:** An audit task needs calculation, transformation, validation or a supported external utility.

**Inputs:** Permitted data and calculation parameters; Analysis scripts or generated code; Available execution tools.

**Proposed auditor action:** Write or use executable analyses to reconcile data, recalculate values, test conditions and produce reviewable results.

**Outputs:** Result datasets and exception lists; Calculation scripts and parameters; Execution output and errors.

**Auditor control:** Inspect methods and inputs, choose permitted execution, and verify results against known checks or control totals.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Generate/run scripts | Perform reproducible audit calculations |
| Invoke installed tools | Use approved data, document and system utilities |
| Inspect output and errors | Verify analysis and diagnose failed procedures |
| Iterate based on results | Refine the test without hiding earlier assumptions |

**Audit-specific enhancements:**

- Retain procedure code, input identifiers, parameters and reconciliation checks with results. Another auditor needs to inspect and reperform the calculation.

**Example:** Recalculate expected payroll amounts from approved inputs and supplied rules, then compare them with the payment extract.

**Boundary / remaining evidence:** The code engine is general-purpose; audit formulas and rules must come from the task's actual criteria. A successful script exit does not establish correct inputs, methodology or conclusions.

**Codex evidence:** [Command execution capabilities](https://learn.chatgpt.com/docs/cli/reference) (inherited-2026-10-22); [Execution boundaries](https://learn.chatgpt.com/docs/agent-approvals-security) (inherited-2026-10-22). Baseline: C ID and source line 80 in the frozen inventory.

### C20

**Code Mode → Programmatic composition of audit tools**

**Developer behavior:** Where enabled, Code Mode lets model-authored JavaScript compose tool calls through an execution host. The public configuration labels the feature under development and off by default, with controls over exposed tool namespaces.

**Auditor trigger:** An enabled task needs to combine several permitted tool operations in a programmatic step.

**Inputs:** Tool definitions exposed to the cell; Task data and tool results; Execution and namespace restrictions.

**Proposed auditor action:** Compose permitted retrieval and analysis operations, transform their results and return the relevant material to the conversation.

**Outputs:** Combined tool results; Derived intermediate data; Execution errors or partial results.

**Auditor control:** Keep effective tool permissions visible, inspect results, and interrupt work through supported controls.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Model-authored execution cell | Compose a bounded audit-tool procedure |
| Nested tool calls | Pass authorised results between tools |
| Direct-only/excluded namespaces | Restrict which audit tools may be composed |
| Cell and nested-call interruption | Stop supported execution while reporting partial work |

**Audit-specific enhancements:**

- Preserve provenance through intermediate transformations and composed tool calls. A compact programmatic result must remain traceable to the evidence and procedure that produced it.

**Example:** Retrieve independent approved extracts, align their identifiers and pass only the exceptions into the next analysis step.

**Boundary / remaining evidence:** Keep its experimental maturity explicit in the mirror. Programmatic composition does not enlarge tool authority or guarantee cancellation of every nested operation; interruption behavior needs verification on the chosen host.

**Codex evidence:** [Code Mode configuration and maturity](https://learn.chatgpt.com/docs/config-file/config-reference) (checked-2026-10-26). Baseline: C ID and source line 81 in the frozen inventory.

### C21

**File creation and editing → Create and revise the auditor's actual work files**

**Developer behavior:** Codex creates and changes workspace files and supports inspection of changes through relevant clients. Desktop file surfaces can preview supported outputs; Git-specific actions and terminal review differ from artifact-focused editing experiences.

**Auditor trigger:** The auditor requests a new deliverable or a revision to existing work.

**Inputs:** Existing saved files or output requirements; Supporting evidence and analysis; Requested changes and formatting constraints.

**Proposed auditor action:** Create or revise supported workbooks, documents, presentations, scripts and other files while retaining their use in existing applications.

**Outputs:** Editable working artifacts; Inspectable changes; Supporting calculation or source references.

**Auditor control:** Review changes in the workbench or another editor, accept or revise them, and continue assistance after saving external edits.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Create new files | Generate workpapers, analyses and reports |
| Edit existing files | Revise the auditor's current working artifacts |
| Inspect/revert selected changes | Review and control changes with format-appropriate support |
| Continue in external editor | Keep Excel, Word and PowerPoint in the working flow |

**Audit-specific enhancements:**

- Use format-aware comparisons for supported workbooks, documents and presentations. A reviewer needs to see meaningful changes such as formulas, values and narrative revisions.
- Detect external saved edits before applying another change. The auditor and agent share artifacts and may modify them through different tools.

**Example:** Update a reconciliation workbook and its report narrative, then let the auditor refine both in Excel and Word.

**Boundary / remaining evidence:** Baseline shared-file work requires no API to the editor. Semantic comparisons, formula preservation, macros, comments and concurrent edits require format-specific verification; Git text diffs do not establish Office-file merge safety.

**Codex evidence:** [Supported output previews and refinement](https://learn.chatgpt.com/docs/artifacts-viewer?surface=app) (checked-2026-10-26); [Change inspection and Git review](https://learn.chatgpt.com/docs/code-review) (inherited-2026-10-22). Baseline: C ID and source line 82 in the frozen inventory.

### C22

**Images and visual inputs → Visual material as audit task context**

**Developer behavior:** Supported clients accept image inputs such as screenshots and diagrams. Attachment handling and supported formats vary by client, host and version, including differences in remote and mobile flows.

**Auditor trigger:** The auditor supplies a screenshot, diagram or other supported image.

**Inputs:** Image and its provenance; Question about visible content; Relevant task context.

**Proposed auditor action:** Interpret visible material, relate it to the task and identify what further evidence is needed to test the relevant assertion.

**Outputs:** Explanation of visible content; Potential exceptions or follow-up questions; References to the supplied image.

**Auditor control:** Confirm the image's source and context, inspect the interpretation and supply clearer or authoritative material where needed.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Screenshot input | Inspect captured application context |
| Diagram interpretation | Understand a supplied process or system diagram |
| Client-specific attachments | Provide visual context through supported local or remote surfaces |

**Audit-specific enhancements:**

- Keep image provenance, capture context and interpretation uncertainty beside the analysis. Visible content alone does not establish the relevant period or completeness of evidence.

**Example:** Provide a screenshot of an access-administration screen and ask which visible entitlements differ from the supplied approved-role matrix.

**Boundary / remaining evidence:** A screenshot may omit fields, history or population scope. Visual interpretation does not establish authenticity, completeness or that the visible configuration was active at the relevant time.

**Codex evidence:** [Image input support](https://learn.chatgpt.com/docs/image-inputs?surface=cli) (inherited-2026-10-22). Baseline: C ID and source line 83 in the frozen inventory.

### C23

**Image generation and editing → Create explanatory audit visuals**

**Developer behavior:** Supported Codex surfaces can generate or edit images using available image tooling, including a reusable skill. Generated visual files can accompany other work; availability and usage conditions depend on the client and workspace.

**Auditor trigger:** The auditor requests an illustration or a revision to an explanatory visual.

**Inputs:** Visual brief and intended audience; Source diagram or image where applicable; Required labels and approved content.

**Proposed auditor action:** Produce visuals for explanations, presentations and training, keeping them distinct from captured source evidence.

**Outputs:** Generated or edited image files; Illustrative report or slide assets; Revision variants for review.

**Auditor control:** Check wording and depicted relationships, request revisions and decide where the visual will be used.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Generate an image | Create an explanatory audit illustration |
| Edit a supplied image | Revise an authorised presentation visual |
| Reusable image skill | Reuse visual production instructions for audit deliverables |

**Audit-specific enhancements:**

- Label explanatory generated visuals distinctly from captured source material. Illustrations used in reports must not be mistaken for observed evidence.

**Example:** Create a clearly labelled illustration explaining role separation in a procurement process for an advisory presentation.

**Boundary / remaining evidence:** Retain image generation as a general capability without treating a generated illustration as proof of how a process operates. Exact data charts and validated process models need appropriate source-backed methods.

**Codex evidence:** [Image generation and editing](https://learn.chatgpt.com/docs/image-generation) (inherited-2026-10-22). Baseline: C ID and source line 84 in the frozen inventory.

### C24

**Composer Predictions → Suggested continuations while writing audit instructions**

**Developer behavior:** Eligible desktop users can receive a suggested continuation while drafting a prompt. Accepting it places text in the composer rather than sending it. The documented beta has account, plan, age and region conditions.

**Auditor trigger:** The auditor types an instruction in an enabled composer.

**Inputs:** Draft instruction; Available composer context; User acceptance or rejection.

**Proposed auditor action:** Suggest a continuation that helps the auditor articulate a task, while leaving the complete instruction editable before submission.

**Outputs:** Suggested draft continuation; User-edited task prompt.

**Auditor control:** Ignore or accept the suggestion, edit it and explicitly send the instruction.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Suggest prompt continuation | Help formulate an audit request |
| Accept into draft | Retain editable user control before submission |
| Eligibility limits | Expose availability rather than assuming universal support |

**Audit-specific enhancements:**

- Keep suggested audit wording editable and distinguish it from submitted instructions. Convenient drafting must not silently introduce a criterion or authorisation.

**Example:** While writing a reconciliation request, accept a suggestion to include the relevant reporting period, then correct the date before sending.

**Boundary / remaining evidence:** A suggested prompt is neither a discovered fact nor permission to execute. Preserve the distinction between accepting draft text and submitting a task; the reference feature remains eligibility-limited beta.

**Codex evidence:** [Composer Predictions beta behavior](https://learn.chatgpt.com/docs/changelog) (inherited-2026-10-22). Baseline: C ID and source line 85 in the frozen inventory.

### C25

**Web search, built-in browser, browser extension, and Computer Use → Research and interact with relevant audit sources and applications**

**Developer behavior:** Codex distinguishes web search, a separate-profile built-in browser, approved extension access to existing browser context, and permitted desktop GUI control. These routes have different session and permission boundaries; Windows GUI control uses the foreground.

**Auditor trigger:** An audit task requires current public information, a web workflow or authorised application interaction.

**Inputs:** Research question or target workflow; Approved sites/apps and signed-in context; Applicable task authority.

**Proposed auditor action:** Research criteria, inspect relevant interfaces or carry out scoped application steps through the appropriate available route.

**Outputs:** Source-linked research; Observed workflow details; Retrieved artifacts or action results.

**Auditor control:** Choose the target and action scope, approve access where needed, inspect consequences and stop the operation.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Cached/live web search | Find relevant current criteria and public sources |
| Separate built-in browser | Inspect public pages and local audit tools |
| Approved browser extension | Work with permitted existing tabs and authenticated sources |
| Desktop Computer Use | Observe or operate supported applications when needed |
| Per-app and action permissions | Keep research access separate from authority to change business state |

**Audit-specific enhancements:**

- Capture the source location, observation time and permitted action scope for a workflow observation. Reviewers need to know where an observation came from and whether business state was changed.

**Example:** Inspect an authorised vendor-onboarding workflow in a test environment and compare visible approval steps with its documented procedure.

**Boundary / remaining evidence:** Browser state, GUI state and shell networking are distinct. Treat source content as untrusted; confirm consequential actions and recorded results. Windows foreground use and macOS locked-use conditions are not interchangeable.

**Codex evidence:** [GUI interaction and platform boundaries](https://learn.chatgpt.com/docs/computer-use) (checked-2026-10-26); [Built-in browser profile](https://learn.chatgpt.com/docs/browser) (inherited-2026-10-22); [Existing browser context](https://learn.chatgpt.com/docs/chrome-extension) (inherited-2026-10-22); [Cached/live search](https://learn.chatgpt.com/docs/web-search) (inherited-2026-10-22). Baseline: C ID and source line 86 in the frozen inventory.

### C26

**Browser annotations and site integration API → Point at a specific source passage or application object**

**Developer behavior:** Users can select page content, annotate it and send it with available context to Codex. A site integration API can customise selectable targets and metadata. This is separate from general browser actions and WebMCP tools.

**Auditor trigger:** The auditor selects content in a supported browser surface and adds an instruction.

**Inputs:** Selected text or page object; User annotation; Available page metadata and context.

**Proposed auditor action:** Anchor an audit question or revision request to the material the auditor is viewing, rather than requiring a separate description of its location.

**Outputs:** Contextual response or proposed revision; Referenced selection; Follow-up analysis tied to the selected material.

**Auditor control:** Choose the selection, inspect supplied context and state the requested action.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Select and comment on content | Ask about a particular passage or displayed object |
| Custom annotation targets | Let supported audit pages identify meaningful selectable records |
| Context metadata and preview controls | Provide relevant source context while showing what is supplied |

**Audit-specific enhancements:**

- Carry useful audit references such as policy section or record identifier with selected content when available. A later reviewer needs to locate the material behind the question.

**Example:** Select a clause in an online incident-management procedure and ask how it relates to the proposed walkthrough.

**Boundary / remaining evidence:** Selection metadata is context, not automatic evidence capture or source authenticity. Website-defined metadata must remain distinguishable from the auditor's instructions; browser annotation does not imply connector write access.

**Codex evidence:** [Browser annotation targets and metadata](https://learn.chatgpt.com/docs/annotations-extensibility) (inherited-2026-10-22); [Separate site-tool boundary](https://learn.chatgpt.com/docs/webmcp) (inherited-2026-10-22). Baseline: C ID and source line 87 in the frozen inventory.

### C27

**Appshots → Bring the current audit screen into the conversation**

**Developer behavior:** Appshots attach the frontmost window image and available accessibility text to a desktop chat. Text coverage depends on the source application; macOS/Windows permissions and client support govern availability.

**Auditor trigger:** The auditor chooses to share the current application window with a task.

**Inputs:** Selected application window; Available visible/accessibility text; The auditor's question.

**Proposed auditor action:** Examine the supplied screen in the context of the audit task, explain unfamiliar fields, identify apparent inconsistencies, and request underlying data when the capture cannot support a conclusion.

**Outputs:** Annotated explanation or questions; References to the captured screen; A proposed next inspection.

**Auditor control:** Choose the window and purpose; inspect what was captured before relying on it or sharing further.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Capture the frontmost window | Bring the current evidence or system screen into the task |
| Include accessible text where available | Provide readable labels and values alongside the image |
| Attach the capture to a chat | Keep the supplied screen linked to the resulting analysis |

**Audit-specific enhancements:**

- Attach capture time, application/source identity and declared coverage to the shared screen. A reviewer needs to distinguish what was actually supplied from unseen source-system data.

**Example:** While reviewing a loan-system rate configuration screen, ask which fields should be reconciled to the approved change request.

**Boundary / remaining evidence:** A capture is a limited point-in-time input. It does not establish complete configuration history, actual application execution, or access to hidden records.

**Codex evidence:** [Appshots](https://learn.chatgpt.com/docs/appshots) (inherited-2026-10-22). Baseline: C ID and source line 88 in the frozen inventory.

### C28

**Analysis and code review → Review audit work and business changes for supported findings**

**Developer behavior:** Codex analyses repository state and tool results; dedicated review examines selected changes and returns prioritised findings without modifying the working tree. GitHub review is a separate configured entry point.

**Auditor trigger:** An auditor requests review of a workpaper/change, or a configured review event starts it.

**Inputs:** Selected workpaper or change and baseline; Applicable review instructions; Supporting evidence and analysis results.

**Proposed auditor action:** Inspect audit scripts or authorised application code directly, and adapt the same review loop to changed workpapers or business-process evidence. Test supplied expectations and return located findings, impact and proposed corrections separately from applying them.

**Outputs:** Prioritised review findings; Supporting references and limits; Suggested fixes or follow-up tests.

**Auditor control:** Select scope and criteria, challenge findings, and separately authorise corrections and professional sign-off.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Review a diff | Review changed cells, passages, rules, or records against their prior state |
| Prioritise actionable findings | Rank evidenced exceptions under the chosen audit criteria |
| Review without editing | Return review notes before any corrective changes |

**Audit-specific enhancements:**

- Replace code-location review anchors with cell, document, record and evidence anchors. Audit findings must be traceable to the affected work and its support.
- Use the engagement's criteria and significance scheme for findings. Developer severity labels do not determine audit significance or professional conclusions.

**Example:** Review a revised reconciliation workbook and flag an excluded account, a broken formula, and an unsupported conclusion with cell/source references.

**Boundary / remaining evidence:** The review pattern transfers directly; audit-specific assertions and tests require explicit procedures and evidence. A clean review is not assurance beyond the work performed.

**Codex evidence:** [Code review](https://learn.chatgpt.com/docs/code-review) (inherited-2026-10-22); [GitHub review](https://learn.chatgpt.com/docs/third-party/github) (inherited-2026-10-22). Baseline: C ID and source line 89 in the frozen inventory.

### C29

**Codex Security scans and workbench → Control, application-security and findings workbench**

**Developer behavior:** Codex Security provides specialised scans, change review, finding triage, remediation and verification through distinct local, cloud and programmatic surfaces. Cloud availability includes research-preview limits; it differs from Codex's own execution safeguards.

**Auditor trigger:** The auditor starts a targeted/bulk assessment or enables an authorised change-monitoring run.

**Inputs:** Bounded population or process materials; Test rules and risk context; Prior findings and remediation evidence; Authorised application source and revision when performing actual software-security work.

**Proposed auditor action:** Retain actual security scanning for authorised IT/IS audit of application code. Adapt the scan-and-review loop to supplied business-control procedures: consolidate exceptions, investigate evidence, propose improvements and retest while preserving coverage.

**Outputs:** Findings workspace and run coverage; Evidence-linked exception reports; Remediation proposals and retest results.

**Auditor control:** Set scope, validate findings, accept or dispute classifications, and decide whether remediation is sufficient.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Deep and bulk scans | Focused control testing and bounded population-wide checks |
| Finding triage | Investigate and classify exceptions |
| Patch proposal and verification | Propose corrective action and test supplied remediation |
| Export and track findings | Produce portable findings and follow-up evidence |
| Code security scanning | Retain authorised application-security assessment for IT/IS audit |
| Change and commit monitoring | Reassess the affected scope after a relevant code or business change |
| Structural hardening proposals | Compare preventive control or process improvements grounded in findings |

**Audit-specific enhancements:**

- Supply audit-specific control tests and population reconciliation checks. A vulnerability scanner's rules cannot test arbitrary business controls.
- Separate suggested exceptions, validated findings and retest outcomes. The auditor must know which conclusions have supporting investigation and review.

**Example:** Scan user-access extracts across several systems, investigate conflicting privileged roles, and retest an updated access population after remediation.

**Boundary / remaining evidence:** Actual code-security capabilities remain useful for authorised IT/IS audit. General business-control tests require different tools and procedures; their proposed mirror preserves the work loop. Enterprise risk ownership needs separate domain design, with no delivery phase selected here.

**Codex evidence:** [Codex Security](https://learn.chatgpt.com/docs/security) (inherited-2026-10-22); [Local security scans](https://learn.chatgpt.com/docs/security/plugin) (inherited-2026-10-22). Baseline: C ID and source line 90 in the frozen inventory.

### C30

**Desktop editor and PR Chat → Contextual workpaper editing and review conversations**

**Developer behavior:** Desktop editing and PR Chat place supported files or pull-request context beside conversation. Users can annotate content, request changes, inspect proposed patches, and accept or reject edits in supported flows.

**Auditor trigger:** The auditor opens an artifact or proposed change and selects content for discussion.

**Inputs:** Current artifact and version; Selected passage, cell, or change; Reviewer comment or revision request.

**Proposed auditor action:** Keep the discussion anchored to the selected work, explain its reasoning, prepare a targeted revision, and show the proposed result before incorporating it into the working artifact.

**Outputs:** Contextual review conversation; Proposed artifact revisions; Accepted or rejected change outcome.

**Auditor control:** Edit directly or in the preferred external tool; decide which revisions to accept and separately perform any professional approval.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Edit supported content in the desktop | Inspect and edit supported audit artifacts in context |
| Annotate selected content | Anchor a review request to a specific passage or data area |
| Accept or reject proposed patches | Review and apply individual proposed artifact changes |

**Audit-specific enhancements:**

- Show format-aware changes in cells, formulas, report passages and evidence links. Raw code-style patches can hide material workbook or document changes.
- Keep edit acceptance distinct from any configured professional sign-off. Accepting wording does not establish that the underlying evidence is sufficient.

**Example:** Select a finding's cause statement in a Word report, ask for stronger supporting reasoning, and review the proposed wording beside its evidence.

**Boundary / remaining evidence:** Audit cell/document-aware review needs format-specific presentation. Accepting an edit does not sign off the workpaper, and a shared file does not require an editor API.

**Codex evidence:** [Code review and PR interactions](https://learn.chatgpt.com/docs/code-review) (inherited-2026-10-22); [Work with files](https://learn.chatgpt.com/docs/artifacts-viewer?surface=app) (inherited-2026-10-22). Baseline: C ID and source line 91 in the frozen inventory.

### C31

**Generated outputs and previews → Reviewable audit deliverables in familiar formats**

**Developer behavior:** Codex produces text and file changes, with supported desktop previews and annotations for several document formats. Terminal and IDE surfaces present outputs differently and do not all offer the same visual review experience.

**Auditor trigger:** A task produces a workbook, report, slide deck, PDF, or other supported output.

**Inputs:** Task results and source references; Existing output files or templates; Requested deliverable format.

**Proposed auditor action:** Create or revise the deliverable, present a suitable preview, support contextual feedback, and leave the saved artifact available for continued work in Excel, Word, PowerPoint, or another appropriate application.

**Outputs:** Saved editable deliverable; Preview or external-open reference; Revisions responding to annotations.

**Auditor control:** Choose where to review/edit, request corrections, and decide when the output is ready for distribution.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Generate saved artifacts | Produce reusable workpapers, reports, and presentations |
| Preview supported formats | Inspect outputs beside the conversation |
| Annotate previews | Request targeted revisions without re-describing the whole deliverable |
| Use external viewers | Continue reviewing the same files in existing audit tools |

**Audit-specific enhancements:**

- Verify round-trip fidelity for supported workbook, document and slide features. Continued work in external tools depends on preserving usable artifacts.
- Detect intervening saved changes before revising an artifact. Agent output must not silently overwrite the auditor's newer work.

**Example:** Produce an exception workbook and committee presentation, inspect each in the workbench, then refine the presentation in PowerPoint.

**Boundary / remaining evidence:** Format fidelity, formulas, comments, and save/reopen behavior must be verified. Previewing an artifact does not prove all its calculations or metadata are correct.

**Codex evidence:** [Work with files](https://learn.chatgpt.com/docs/artifacts-viewer?surface=app) (inherited-2026-10-22). Baseline: C ID and source line 92 in the frozen inventory.

### C32

**Sites and hosted app outputs → Create and publish audit dashboards and lightweight tools**

**Developer behavior:** Supported Sites flows create, refine, save, and deploy websites or applications. The documented public-beta managed publishing surface differs from CLI/IDE source editing; saved non-deployed versions can be reviewed before deployment.

**Auditor trigger:** The auditor asks for an interactive output or chooses to publish a reviewed version.

**Inputs:** Approved data or synthetic examples; Dashboard/tool requirements; Audience and publishing destination.

**Proposed auditor action:** Build an explorable exception dashboard or small audit utility, inspect its calculations and interactions, revise it through conversation, then publish only through an authorised hosting route.

**Outputs:** Reviewable application or dashboard; Saved version and supporting files; Deployment reference when authorised.

**Auditor control:** Approve the data audience and release separately from creating the draft; inspect interactions and data handling.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Create or refine an app from instructions | Build a small audit analysis or reporting tool |
| Review a saved version | Validate the interactive output before release |
| Deploy and manage a site | Publish the approved tool to its authorised audience |

**Audit-specific enhancements:**

- Carry source period, calculation definitions and evidence links into audit dashboards. Interactive summaries need an inspectable basis for reliance.
- Apply explicit audience and data-release choices to publishing. A useful working dashboard may contain information that cannot be shared with its default audience.

**Example:** Create a dashboard for exploring aged reconciliations with filters and drill-through references, then publish the reviewed version for the intended team.

**Boundary / remaining evidence:** This mirrors a build-and-publish capability. A generated dashboard is not automatically a durable audit record system; hosting, access, and data storage remain distinct concerns.

**Codex evidence:** [Sites](https://learn.chatgpt.com/docs/sites) (inherited-2026-10-22); [Creating a site](https://learn.chatgpt.com/docs/sites/creating-a-site) (inherited-2026-10-22). Baseline: C ID and source line 93 in the frozen inventory.

## Tools, integrations, and extension mechanisms

### C33

**Built-in tools → Core audit work tools available to the agent**

**Developer behavior:** Codex surfaces expose tools for files, execution, images, search and agent operations according to the environment. Tool availability, permission to use a tool, and a completed invocation are separate states.

**Auditor trigger:** An audit task requires a supported file, calculation, search, or agent operation.

**Inputs:** Task instructions; Permitted files or data; Available runtime tools.

**Proposed auditor action:** Select and call the relevant tool, inspect its result, and use the result in the next step. Keep concrete operations visible so the auditor can connect claims to actual file reads, calculations, or changes.

**Outputs:** Tool results and generated artifacts; Visible progress or errors; Analysis grounded in completed operations.

**Auditor control:** Set operating scope, review consequential actions, and interrupt or redirect the task.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Read and modify files | Inspect evidence and prepare working outputs |
| Run processes | Execute reproducible analysis |
| Inspect tool outcomes | Distinguish performed tests from intended work |

**Audit-specific enhancements:**

- Provide format-aware extraction and calculation tools with inspectable results. Office artifacts and audit populations need more than plain-text editing.

**Example:** Read an expenses CSV, run a duplicate-payment query, inspect candidate matches, and create a workbook for review.

**Boundary / remaining evidence:** An audit-facing label does not itself supply a new execution engine or permission. Domain-specific tools extend the same mechanism; their correctness needs separate validation.

**Codex evidence:** [Codex CLI](https://learn.chatgpt.com/docs/codex/cli) (inherited-2026-10-22); [Approvals and security](https://learn.chatgpt.com/docs/agent-approvals-security) (inherited-2026-10-22). Baseline: C ID and source line 99 in the frozen inventory.

### C34

**Connected apps and app catalog → Discover and manage available audit data connections**

**Developer behavior:** Codex app integrations have catalog, installation and effective callable states. Enabled configuration, identity and policy affect access; connector traffic follows a distinct control path from sandboxed shell networking.

**Auditor trigger:** The auditor selects a connected service or asks what sources/actions are available.

**Inputs:** App catalog and effective state; Authorised user/service identity; Requested read or write operation.

**Proposed auditor action:** Show which integration can actually supply the requested material, use its permitted operations, and identify the acting account and destination before a side effect.

**Outputs:** Available-source/action list; Retrieved material or confirmed action result; Clear unavailable/unauthorised state.

**Auditor control:** Connect the intended account, limit scope, and authorise consequential writes.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Discover apps | Discover permitted audit information sources |
| Distinguish installed/enabled/callable state | Explain whether a connection can perform the requested operation now |
| Use connector identity | Make the acting account and record destination explicit |

**Audit-specific enhancements:**

- Display the client/entity scope and effective read/write actions of each connection. The same app may contain data from unrelated engagements or clients.

**Example:** Retrieve an approved policy from a connected repository while leaving an unrelated client connection unavailable to the engagement.

**Boundary / remaining evidence:** Shared local files remain usable without an app connector. A catalog listing does not prove support for a particular audit object or operation.

**Codex evidence:** [Plugins](https://learn.chatgpt.com/docs/plugins) (inherited-2026-10-22); [App-server app and tool state](https://learn.chatgpt.com/docs/app-server) (checked-2026-10-26). Baseline: C ID and source line 100 in the frozen inventory.

### C35

**MCP servers and connected tools → Connect reusable audit tools through a standard tool interface**

**Developer behavior:** Codex connects to local or remote MCP servers supplying tools, resources and prompts. Connections and authentication are explicit; tools may read or mutate systems. App-server uses a different protocol from MCP.

**Auditor trigger:** The task needs a capability supplied by a configured MCP server.

**Inputs:** Server/tool definitions; Permitted identity and resource scope; Operation arguments.

**Proposed auditor action:** Discover the supported operation, supply bounded inputs, execute it through the connection, and inspect the result before incorporating evidence or recording a claimed update.

**Outputs:** Structured evidence or calculation results; Confirmed mutation result where authorised; Tool errors and access limitations.

**Auditor control:** Choose trusted connections and permitted operations; review writes separately from reads.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Connect local or remote tools | Attach local analytics or approved remote audit services |
| Read resources and prompts | Retrieve task references and reusable tool-specific guidance |
| Authenticate and inspect tools | Confirm identity and available read/write actions |

**Audit-specific enhancements:**

- Require source identity, extraction scope and observation time in evidence-returning tools. Structured tool output needs enough context to assess relevance and freshness.

**Example:** Use a read-only database tool to obtain a loan-rate change population, then use a separate analysis tool to test effective dates.

**Boundary / remaining evidence:** MCP supplies an interface, not audit semantics or a universal connector. A remote tool's authority and data path need individual assessment.

**Codex evidence:** [MCP](https://learn.chatgpt.com/docs/extend/mcp) (inherited-2026-10-22); [Codex MCP server removal](https://learn.chatgpt.com/docs/mcp-server) (inherited-2026-10-22). Baseline: C ID and source line 101 in the frozen inventory.

### C36

**Plugins and marketplaces → Installable audit capability packages**

**Developer behavior:** Plugins bundle skills and other capabilities such as MCP tools, hooks or UI. Curated and team/project distribution paths exist; installing a package and authorising its capabilities are distinct, with client-specific support.

**Auditor trigger:** The auditor or administrator adds or updates an approved capability package.

**Inputs:** Plugin package and declared capabilities; Installation scope; Tool credentials and policy where needed.

**Proposed auditor action:** Make packaged procedures, references and tools available to the workbench while exposing their ownership and effective permissions. Allow the team to reuse a consistent capability set across relevant workspaces.

**Outputs:** Installed capability inventory; Available skills/tools; Version and configuration context.

**Auditor control:** Choose package scope, inspect included behavior, and enable only permitted connections or actions.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Bundle skills and tools | Package reusable audit procedures with the tools they use |
| Distribute through marketplaces | Share approved practice or team capability packages |
| Manage package lifecycle | Inspect versions, updates, disablement and removal |

**Audit-specific enhancements:**

- Declare supported practices, input formats, dependencies and procedure versions in an audit package. A team needs to understand where a reusable package applies and what an update changes.

**Example:** Install a team package containing access-review procedures, an approved export parser, and reporting templates.

**Boundary / remaining evidence:** Installation does not approve an audit methodology or grant source access. Preserve separate owners and update paths for workspace, personal and plugin-provided skills.

**Codex evidence:** [Plugins](https://learn.chatgpt.com/docs/plugins) (inherited-2026-10-22); [Build plugins](https://learn.chatgpt.com/docs/build-plugins) (inherited-2026-10-22). Baseline: C ID and source line 102 in the frozen inventory.

### C37

**Skills → Reusable audit procedures invoked through conversation**

**Developer behavior:** Skills package instructions with optional references, scripts and resources. Codex can select a relevant skill or run one explicitly requested by the user; skill ownership and distribution differ by source.

**Auditor trigger:** The auditor invokes a procedure, or the agent recognises a matching task.

**Inputs:** Skill instructions and version; Task-specific files or parameters; Referenced criteria and supporting resources.

**Proposed auditor action:** Follow the reusable procedure with the current inputs, execute permitted supporting tools, and return the procedure's expected work product and verification evidence.

**Outputs:** Procedure-specific working output; Supporting calculations or references; Exceptions and unmet prerequisites.

**Auditor control:** Choose or adjust the procedure and inspect its assumptions, inputs and resulting work.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Explicit skill invocation | Run a named audit procedure |
| Automatic selection by description | Suggest an applicable working method |
| Bundle scripts and references | Keep instructions, calculations and templates together |

**Audit-specific enhancements:**

- Include criteria references, required inputs, expected outputs and verification steps in audit procedure skills. A reusable routine must explain what was tested and how its result should be checked.

**Example:** Invoke a bank-reconciliation skill with this month's statements and ledger export, then review the reconciling items in the generated workbook.

**Boundary / remaining evidence:** A skill guides execution and does not grant data access. Procedure criteria, version references and required task-level checks belong to the direct audit counterpart. Formal methodology governance requires separate domain design; no delivery phase is selected here.

**Codex evidence:** [Build skills](https://learn.chatgpt.com/docs/build-skills) (inherited-2026-10-22); [Skills and plugins](https://learn.chatgpt.com/docs/skills-and-plugins) (inherited-2026-10-22). Baseline: C ID and source line 103 in the frozen inventory.

### C38

**Record & Replay → Teach the assistant a demonstrated audit routine**

**Developer behavior:** On supported macOS setups, Record & Replay observes a permitted demonstration and drafts a reusable skill. Later runs use current task tools and variable inputs; Computer Use availability is required.

**Auditor trigger:** The auditor chooses to record a familiar repeatable procedure, then later invokes the resulting skill.

**Inputs:** Explicitly recorded demonstration; Variable inputs and expected result; Available replay tools.

**Proposed auditor action:** Capture the demonstrated steps, draft an inspectable procedure with inputs and verification guidance, let the auditor refine it, and repeat it with new values under the current task's permissions.

**Outputs:** Draft reusable skill; Performed routine and output; Verification results or replay exceptions.

**Auditor control:** Start/stop recording, inspect the generated procedure, provide new inputs, and review replay outcomes.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Record a workflow | Demonstrate an existing audit routine |
| Draft a skill from actions | Turn the demonstration into an inspectable reusable procedure |
| Replay with changed inputs | Repeat for another period, entity, or population |

**Audit-specific enhancements:**

- Add review of captured assumptions and validation on a second representative case before routine reuse. A demonstrated path may omit exceptions or depend on unnoticed application state.

**Example:** Demonstrate downloading a monthly control report, filtering the period, and saving it under the engagement's naming convention.

**Boundary / remaining evidence:** Recording is not proof that the demonstrated method is appropriate or that replay succeeded. The reference is macOS-specific; matching it elsewhere requires investigation.

**Codex evidence:** [Record & Replay](https://learn.chatgpt.com/docs/extend/record-and-replay) (checked-2026-10-26). Baseline: C ID and source line 104 in the frozen inventory.

### C39

**Repository instructions and configuration → Workspace guidance and operating preferences**

**Developer behavior:** Codex discovers applicable AGENTS.md guidance and combines configuration with managed requirements under defined precedence. Settings control models, tools, permissions and other behavior, and some configuration can live outside the project.

**Auditor trigger:** An audit workspace or scoped task starts, resumes, or changes its applicable configuration.

**Inputs:** Workspace and folder instructions; User preferences; Managed requirements and effective settings.

**Proposed auditor action:** Apply the relevant vocabulary, file conventions, preferred procedures and operating limits to work in that scope. Make inherited guidance inspectable when it affects an outcome.

**Outputs:** Context-aware work products; Effective operating configuration; Visible conflicts or unsupported settings.

**Auditor control:** Maintain workspace instructions and inspect which higher-level requirements apply.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Discover scoped instruction files | Apply the relevant client, engagement and folder guidance |
| Layer user and managed settings | Combine practitioner preferences with organisational limits |
| Configure tools/models/approvals | Tailor operating behavior without changing the underlying workspace experience |

**Audit-specific enhancements:**

- Expose the effective client/engagement guidance and its provenance. Auditors must identify which conventions and criteria shaped the task.

**Example:** A client workspace specifies financial year, entity naming, working-paper conventions, approved criteria references and read-only access to source extracts.

**Boundary / remaining evidence:** Instructions shape agent behavior; they are not by themselves enforced access controls or proof of methodology compliance. Engagement facts still need identified sources.

**Codex evidence:** [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) (inherited-2026-10-22); [Configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference) (inherited-2026-10-22). Baseline: C ID and source line 105 in the frozen inventory.

### C40

**Hooks → Checks at agent workflow events**

**Developer behavior:** Hooks react to supported agent lifecycle events using configured handlers. MCP hooks use existing connections; an explicit blocking result can stop an operation, while missing tools or errors do not inherently block it.

**Auditor trigger:** A configured agent event occurs, such as a tool call, compaction, task start or completion.

**Inputs:** Hook event and matched operation; Configured handler and policy; Current task context.

**Proposed auditor action:** Run an appropriate contextual or output check at that lifecycle point and report its result. For example, validate a generated workpaper's required references after an edit and surface any gap before the auditor relies on it.

**Outputs:** Check outcome or added context; Warnings or supported blocking decision; Hook failures visible for follow-up.

**Auditor control:** Approve trusted handlers, inspect their scope, and decide how an unmet or failed check affects the workflow.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Before/after tool events | Check intended actions and generated work |
| Context/compaction events | Restore essential task guidance on continuation |
| Task/subagent lifecycle events | Surface required completion checks and handoff information |

**Audit-specific enhancements:**

- Define the consequence of a failed or unavailable mandatory audit check separately from the reference hook default. The current hook failure behavior does not establish that required checks ran or blocked subsequent reliance.

**Example:** After the agent writes an exception workbook, check that its population source and test parameters are recorded.

**Boundary / remaining evidence:** Lifecycle hooks do not themselves detect business events such as rate changes. Their reference failure behavior is not a fail-closed compliance guarantee or immutable audit trail.

**Codex evidence:** [Hooks](https://learn.chatgpt.com/docs/hooks) (checked-2026-10-26). Baseline: C ID and source line 106 in the frozen inventory.

### C41

**App-server protocol → A workbench client that can drive and observe the agent runtime**

**Developer behavior:** App-server exposes thread operations, streamed activity, tools, configuration and approval exchanges to a rich client over JSON-RPC. Its command and WebSocket transport are experimental; individual execution methods have different authority.

**Auditor trigger:** The workbench starts a task, resumes work, displays activity, or answers an agent request.

**Inputs:** User request and thread state; Runtime configuration and available tools; Approval or clarification response.

**Proposed auditor action:** Present the familiar conversational workspace while the runtime performs permitted work. Translate runtime events into understandable audit-task progress, artifact changes, input requests, errors and completion states.

**Outputs:** Visible agent/task activity; Reviewable files and results; Human response events and resumable work.

**Auditor control:** Steer, inspect, interrupt and approve applicable actions through the workspace.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Thread and turn requests | Start, continue and stop audit work |
| Streamed runtime events | Explain actual progress and generated outputs |
| Approval/input exchanges | Let the auditor resolve a specific permission or clarification request |

**Audit-specific enhancements:**

- Translate runtime events into audit-task, evidence and artifact status without overstating completion. Tool completion, successful analysis and accepted audit work are different states.

**Example:** While testing expenses, show the active data extraction, completed calculation, missing evidence request and resulting workbook in one task.

**Boundary / remaining evidence:** This maps the runtime/client contract, not a selected architecture. Experimental status, service eligibility and each method's effective authority require verification; a single protocol does not imply one sandbox boundary.

**Codex evidence:** [App-server](https://learn.chatgpt.com/docs/app-server) (checked-2026-10-26). Baseline: C ID and source line 107 in the frozen inventory.

### C42

**Client-supplied dynamic tools (app-server) → Task-specific tools supplied by the audit workspace**

**Developer behavior:** The experimental dynamic-tools API lets a client describe tools and fulfil runtime tool requests through item/tool/call. It requires opt-in and is distinct from configuring an external MCP server.

**Auditor trigger:** An agent requests a tool that the current workspace has exposed.

**Inputs:** Tool schema and description; Current task/record identity; Validated call arguments.

**Proposed auditor action:** Expose bounded operations appropriate to the current audit context, fulfil a requested operation through the host, and return a structured result that the agent can inspect.

**Outputs:** Tool result linked to its invocation; Updated working artifact where authorised; Validation or execution error.

**Auditor control:** Operate within the workspace's authorised scope and review consequential changes; an agent-proposed call does not determine its own authority.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Supply tool definitions at thread start | Offer context-relevant audit operations |
| Handle client tool-call requests | Perform a bounded operation under host authority |
| Return content and success/error | Make the result and any failed action explicit |

**Audit-specific enhancements:**

- Bind each audit-specific host tool to the current artifact/entity and validate returned identifiers. Task-specific operations must not act on unrelated or stale audit material.

**Example:** A workpaper view exposes a tool to fetch a selected sample's evidence references without giving the agent access to unrelated engagements.

**Boundary / remaining evidence:** The tool mechanism is a direct counterpart; specific native record operations depend on the later record-mode design. Experimental API and host-side enforcement remain unresolved implementation questions.

**Codex evidence:** [App-server dynamic tools](https://learn.chatgpt.com/docs/app-server) (checked-2026-10-26). Baseline: C ID and source line 108 in the frozen inventory.

### C43

**Codex SDK, non-interactive execution, and GitHub Action → Run audit procedures from scripts and event-driven jobs**

**Developer behavior:** Codex offers SDKs, non-interactive exec and a GitHub Action for programmatic tasks. They provide distinct runtime interfaces and maturity levels, with structured events available for supported batch or CI workflows.

**Auditor trigger:** A script, scheduler or configured external event starts a bounded job.

**Inputs:** Procedure prompt and parameters; Identified source version/population; Service identity and permitted environment.

**Proposed auditor action:** Run the declared analysis without an interactive foreground session, retain its structured outcome and artifacts, and route a completed, failed or needs-attention result to the auditor.

**Outputs:** Repeatable run result; Evidence-linked findings and output files; Machine-readable status and errors.

**Auditor control:** Configure the mandate and limits beforehand; review exceptions and authorise any consequential follow-up.

| Codex subfeature | Auditor mirror |
| --- | --- |
| SDK invocation | Call a reusable audit task from another authorised tool |
| Non-interactive execution | Run a bounded assurance job without a foreground conversation |
| CI/event runner | Start a configured test when a relevant business change is detected |
| Structured lifecycle events | Track completion, errors and generated results |
| SDK run, stream and resume | Start, observe and continue a programmatic audit investigation |
| Ephemeral runtime rollout | Run an eligible transient task without retaining its runtime rollout |

**Audit-specific enhancements:**

- Bind automated runs to an event/source version, procedure version and bounded population. Results must identify exactly which change and evidence were tested.
- Surface missed, duplicate, failed and inconclusive runs distinctly from passed checks. Continuous assurance requires visibility into coverage and execution gaps.

**Example:** A detected approved interest-rate change starts a job that tests specified approval and effective-date controls against the relevant evidence.

**Boundary / remaining evidence:** The automation runner does not create an event feed or prove control compliance. Source access, duplicate-event handling and missed/failed runs require explicit design and validation. Ephemeral rollout behavior does not delete generated files, external records or other copies; retain relied-on work according to the chosen policy.

**Codex evidence:** [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk) (inherited-2026-10-22); [Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode) (inherited-2026-10-22); [GitHub Action](https://learn.chatgpt.com/docs/github-action) (inherited-2026-10-22). Baseline: C ID and source line 109 in the frozen inventory.

### C44

**Task entry points from connected services → Receive audit requests and change-triggered reviews where work already happens**

**Developer behavior:** Configured integrations can create or route Codex tasks from services such as GitHub, GitLab, Slack or Linear; selected enterprise flows use Teams. Hosted execution, availability and maturity depend on the integration.

**Auditor trigger:** A permitted mention, request, ticket transition or configured service event arrives.

**Inputs:** Originating item and event identity; Relevant context and attachments; Requester identity and routing configuration.

**Proposed auditor action:** Create or continue a scoped task from that source, obtain the permitted supporting material, perform the requested review, and return findings or a task link to the appropriate destination.

**Outputs:** Task linked to its source item; Review findings or requested work product; Completion, failure or clarification response.

**Auditor control:** Define eligible events, accounts and destinations; distinguish a request to test from authority to approve or change records.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Mention the agent in a service | Request assistance from the existing work conversation |
| Route service context into a task | Carry the originating change/request into audit analysis |
| Return results to the originating work | Make review findings actionable beside the relevant item |

**Audit-specific enhancements:**

- Define business-event adapters, qualifying events and audit context requirements. A PR event integration does not automatically observe loan-rate or other business-process changes.
- Bind returned findings to the originating change and intended reviewer. The person receiving a result needs to know which event it addresses.

**Example:** A change ticket moves to ready-for-review and invokes the assurance agent to inspect approval, segregation and implementation evidence.

**Boundary / remaining evidence:** A business event adapter is an audit-specific counterpart to the service integration. Its availability is not established by Codex's GitHub integration; ordinary saved-file work remains independent.

**Codex evidence:** [GitHub integration](https://learn.chatgpt.com/docs/third-party/github) (inherited-2026-10-22); [Slack integration](https://learn.chatgpt.com/docs/third-party/slack) (inherited-2026-10-22); [Linear integration](https://learn.chatgpt.com/docs/third-party/linear) (inherited-2026-10-22). Baseline: C ID and source line 110 in the frozen inventory.

## Delegation and collaboration

### C45

**Subagents → Delegate parallel audit work to specialised assistants**

**Developer behavior:** Codex delegates tasks to separate agent threads and combines results. Custom agents can specialise instructions and supported model settings; they inherit parent permissions, provider and MCP connections rather than independently expanding access.

**Auditor trigger:** The auditor or coordinating agent divides suitable work into independent tasks.

**Inputs:** Specific delegated question; Bounded source material and criteria; Role instructions and expected output.

**Proposed auditor action:** Assign separate agents to population analysis, criteria research, evidence inspection or workpaper review, track their work, and reconcile their findings into a coherent result with visible disagreements.

**Outputs:** Per-agent results and references; Combined analysis; Unresolved disagreements or missing evidence.

**Auditor control:** Inspect delegated scope and progress, redirect tasks, and verify the synthesis before relying on it.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Delegate independent tasks | Split evidence and testing work by question |
| Define specialist agents | Reuse distinct analysis or review roles |
| Inspect agent threads | Trace a result back to the delegated work |
| Synthesize returned results | Reconcile findings and surface disagreement |

**Audit-specific enhancements:**

- Require delegated results to identify evidence, method and unresolved disagreements. The coordinating agent must reconcile substantive support rather than count agreeing agents.

**Example:** One agent checks rate-change approvals, another recalculates affected interest, and a third reviews customer-notification evidence.

**Boundary / remaining evidence:** Parallel agents are not automatically independent assurance providers. Shared assumptions can produce correlated mistakes; formal human review remains a separate decision.

**Codex evidence:** [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) (checked-2026-10-26). Baseline: C ID and source line 116 in the frozen inventory.

### C46

**Side chats, fork, and task references → Explore audit questions without losing the main work**

**Developer behavior:** Side chats and forks create separate conversational paths for focused questions or alternative approaches. Supported clients can reference other tasks and navigate between related work without rewriting the original transcript.

**Auditor trigger:** The auditor opens a side investigation or tries a different approach from existing context.

**Inputs:** Parent task context; Focused question or alternative hypothesis; Referenced task or artifact.

**Proposed auditor action:** Investigate a specific issue separately, preserve the main engagement conversation, and bring relevant conclusions back with a clear reference to the supporting branch.

**Outputs:** Separate investigation conversation; Alternative analysis or interpretation; Referenced conclusion for the main task.

**Auditor control:** Choose what context is carried, compare paths, and identify which conclusion is adopted or superseded.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Side conversation | Investigate a narrow evidence or methodology question |
| Fork with existing history | Explore an alternative interpretation from the same starting context |
| Reference another task | Link the supporting investigation into the main work |

**Audit-specific enhancements:**

- Show which exploratory conclusion was adopted or superseded. Alternative analyses must not be mistaken for the current relied-on conclusion.

**Example:** Fork a sampling discussion to explore a different stratification while keeping the original test approach available for comparison.

**Boundary / remaining evidence:** Forking a conversation does not itself isolate working files, change permissions, or create an approved alternative procedure. Avoid treating an abandoned branch as the current conclusion.

**Codex evidence:** [Projects and chats](https://learn.chatgpt.com/docs/projects) (inherited-2026-10-22); [Thread fork and history operations](https://learn.chatgpt.com/docs/app-server) (inherited-2026-10-22). Baseline: C ID and source line 117 in the frozen inventory.

### C47

**Worktrees and concurrent tasks → Separate working copies for parallel audit analysis**

**Developer behavior:** Git worktrees give independent tasks separate working directories in the same repository. App-managed copies can have different lifecycles; isolation and handoff behavior vary across local, remote and scheduled workflows.

**Auditor trigger:** The auditor or agent starts parallel work that could modify overlapping artifacts.

**Inputs:** Identified baseline files; Task-specific working directory; Reconciliation instructions.

**Proposed auditor action:** Give each analysis a separate working copy, preserve the starting version, and compare completed outputs before integrating selected changes into the main body of work.

**Outputs:** Separate task artifacts; Comparison against the baseline; Explicitly reconciled working result.

**Auditor control:** Choose which changes to retain and resolve conflicting edits before replacing the shared artifact.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Separate working directories | Protect concurrent analysis from accidental file overwrites |
| Retain a common baseline | Know which source version each analysis used |
| Integrate selected changes | Reconcile completed work into the main artifact |

**Audit-specific enhancements:**

- Provide format-aware comparison and explicit reconciliation of Office artifact changes. Separate working copies alone do not safely merge binary or structured document edits.

**Example:** Analyse alternate loan populations in separate copies of a workbook, then incorporate the selected result without overwriting the other analyst's work.

**Boundary / remaining evidence:** This is the isolation pattern, not a requirement to use Git for every Office artifact. Binary document merging needs format-aware handling; filesystem separation does not establish engagement confidentiality.

**Codex evidence:** [Git worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees) (inherited-2026-10-22). Baseline: C ID and source line 118 in the frozen inventory.

## Context, memory, and continuity

### C48

**Active context and compaction → Maintain task focus through long audit work**

**Developer behavior:** Codex carries instructions, conversation and tool results in active context. Automatic or requested compaction condenses earlier material for continuation; it reduces context pressure without guaranteeing that every prior detail survives.

**Auditor trigger:** A long-running audit conversation approaches its context limit or requests compaction.

**Inputs:** Task instructions and recent work; Relevant tool results; References to durable files and decisions.

**Proposed auditor action:** Continue the task from a concise state of its objective, completed work and next steps, reopening identified artifacts whenever exact evidence, calculations or wording are required.

**Outputs:** Continuation state; Resumed work linked to durable artifacts; Questions where needed context is missing.

**Auditor control:** Inspect the current scope, restate a correction, and require source verification for material conclusions.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Build active task context | Keep the current objective and relevant work available |
| Compact earlier history | Continue lengthy investigations within context limits |
| Reopen durable sources | Verify exact evidence instead of relying on a summary |

**Audit-specific enhancements:**

- Keep evidence identifiers, criteria references and material decisions in durable task artifacts. Compaction can omit details that should remain recoverable for audit work.

**Example:** Resume a multi-day payroll analysis with the population file, completed tests and unresolved exceptions still identified.

**Boundary / remaining evidence:** A condensed conversation is working context, not the evidence archive. Exact facts, approved criteria and relied-on outputs should remain in accessible artifacts or records.

**Codex evidence:** [Best practices](https://learn.chatgpt.com/docs/learn/best-practices) (inherited-2026-10-22); [Thread and compaction events](https://learn.chatgpt.com/docs/app-server) (inherited-2026-10-22). Baseline: C ID and source line 124 in the frozen inventory.

### C49

**Conversation persistence and history → Return to prior audit work and its reasoning**

**Developer behavior:** Supported Codex clients provide thread listing, resumption, search, branching, archiving and deletion. Available operations and storage differ between local, cloud and remote environments; structured runtime history supports continuation.

**Auditor trigger:** The auditor returns to earlier work, locates a prior discussion, or manages its lifecycle.

**Inputs:** Saved conversation identity; Search criteria or task reference; Current artifact state and permissions.

**Proposed auditor action:** Find the relevant task, recover its previous instructions and results, check current source versions, and continue with a new question or action without pretending the old context is current evidence.

**Outputs:** Retrieved task history; Continued analysis; Updated task status or archive state.

**Auditor control:** Choose what to resume, retain, archive or delete within applicable policy.

| Codex subfeature | Auditor mirror |
| --- | --- |
| List and search threads | Find earlier analysis and its working context |
| Resume a task | Continue unfinished audit work |
| Archive/delete history | Manage task history under the applicable policy |

**Audit-specific enhancements:**

- Link history to artifact versions and distinguish task-history retention from retained audit records. Resuming a discussion should not silently reuse superseded evidence or imply formal record preservation.

**Example:** Find the prior discussion explaining an exception rule, reopen the supporting workbook, and revise the analysis for a new period.

**Boundary / remaining evidence:** Conversation persistence is distinct from formal audit-record retention. Deleting a chat does not necessarily remove exported files, and a past accessible source may no longer be authorised.

**Codex evidence:** [Projects and chats](https://learn.chatgpt.com/docs/projects) (inherited-2026-10-22); [Thread operations](https://learn.chatgpt.com/docs/app-server) (inherited-2026-10-22). Baseline: C ID and source line 125 in the frozen inventory.

### C50

**Memory → Controlled recall of useful audit working preferences**

**Developer behavior:** Local Codex memory is a separate store, off by default. Eligible prior chats can contribute useful context; machine and chat controls govern use and contribution, with background generation and deletion controls.

**Auditor trigger:** Memory is enabled and a new task can benefit from eligible prior context.

**Inputs:** Permitted prior working context; Current chat memory settings; Relevant current task.

**Proposed auditor action:** Recall useful conventions or previously learned tool details, identify them as recalled context, and check current authoritative sources before using them as audit facts or criteria.

**Outputs:** Relevant recalled context; More consistent working preferences; Inspectable/deletable generated memory state.

**Auditor control:** Enable or disable memory use/contribution for the task and remove unwanted memory through supported controls.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Recall useful prior context | Remember permitted working conventions |
| Control use versus contribution | Keep a sensitive assignment from informing future tasks |
| Inspect and delete local memory | Correct or remove unwanted retained working context |

**Audit-specific enhancements:**

- Apply client/engagement scope and current-access checks to reusable recall. Useful preferences must not carry confidential evidence or stale conclusions into an unrelated assignment.

**Example:** Recall the team's preferred exception workbook layout while reading current-period facts directly from the supplied data.

**Boundary / remaining evidence:** Reuse must respect engagement/client scope and current access. Memory is not a substitute for a current policy, transaction record or approval; cross-engagement controls still need explicit adaptation.

**Codex evidence:** [Memories](https://learn.chatgpt.com/docs/customization/memories) (checked-2026-10-26). Baseline: C ID and source line 126 in the frozen inventory.

### C51

**Computer History → Optional recall of the auditor's recent application work**

**Developer behavior:** Computer History is an optional macOS feature using allowed-app interaction/accessibility events to create a searchable timeline and local memories. It has distinct opt-in, processing and retention behavior and excludes screenshots and private browsing.

**Auditor trigger:** The auditor enables permitted app/site capture and later asks about recent work.

**Inputs:** Allowed application/site activity; Event-derived text and timing; A question about recent work.

**Proposed auditor action:** Help locate a recently used file, reconstruct a working sequence or recover the context of a prior activity, then open original materials for any substantive audit analysis.

**Outputs:** Activity-based recall or timeline reference; Pointers to relevant work; Explicit gaps in captured context.

**Auditor control:** Choose permitted apps/sites, pause collection, and manage deletion and memory settings.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Allow selected apps and sites | Scope optional recent-work context |
| Search an activity-derived timeline | Locate previously inspected work |
| Create local memories | Recover useful context while verifying against original materials |

**Audit-specific enhancements:**

- Label ambient summaries as activity-derived context and maintain explicit app/client boundaries. Recent activity can aid navigation but cannot stand in for verified audit evidence.

**Example:** Locate the report the auditor examined before revising an exception workpaper and return to the original saved file.

**Boundary / remaining evidence:** Ambient recall is optional assistance, not employee surveillance or a complete audit trail. The reference has local storage plus server processing; local memory files alone do not establish local-only processing.

**Codex evidence:** [Computer History](https://learn.chatgpt.com/docs/customization/computer-history) (inherited-2026-10-22). Baseline: C ID and source line 127 in the frozen inventory.

### C52

**Durable instructions vs memory vs skills → Keep audit rules, procedures, recall and task history distinct**

**Developer behavior:** Codex separates durable project instructions, reusable skills, recalled memory and conversation history. These context sources have different ownership, lifecycle and authority; their roles should not be conflated.

**Auditor trigger:** A task gathers context or encounters conflicting guidance.

**Inputs:** Applicable durable instructions; Selected procedure or skill; Recalled context and current task history.

**Proposed auditor action:** Use instructions for enduring workspace rules, skills for repeatable methods, memory for helpful recall, and the conversation for current direction. Verify material facts in identified evidence and make conflicts visible.

**Outputs:** Appropriately sourced task guidance; Procedure-linked work; Clarification where guidance conflicts.

**Auditor control:** Choose the intended procedure, update durable guidance deliberately, and correct recalled preferences without silently changing policy.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Durable instructions | Workspace rules and lasting engagement guidance |
| Skills | Reusable working procedures |
| Memory | Helpful permitted recall |
| Conversation history | Current task directions and working discussion |

**Audit-specific enhancements:**

- Display whether a material instruction came from policy, a procedure, memory or the current request. Different context sources have different authority and should not silently override one another.

**Example:** Apply the engagement's approved criteria, use a sampling procedure, recall a formatting preference, and keep this period's exceptions in its own task files.

**Boundary / remaining evidence:** The separation transfers directly. Formal methodology versioning, professional approval and cross-client knowledge rules require domain design; memory must not silently replace them.

**Codex evidence:** [Customization overview](https://learn.chatgpt.com/docs/customization/overview) (inherited-2026-10-22); [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) (inherited-2026-10-22); [Memories](https://learn.chatgpt.com/docs/customization/memories) (checked-2026-10-26). Baseline: C ID and source line 128 in the frozen inventory.

### C53

**Usage, models, speed, and reasoning controls → Choose analysis effort and inspect consumption**

**Developer behavior:** Supported clients expose model and reasoning choices, usage information, and eligible speed modes. Faster modes can consume more allowance; access varies by model, plan, client and workspace. Delegated agents also consume resources.

**Auditor trigger:** The auditor starts a task, changes effort during work, or checks remaining capacity.

**Inputs:** Available model and speed options; Task scope and expected complexity; Usage and workspace limits.

**Proposed auditor action:** Preserve the model/effort controls so an auditor can choose a quick document explanation or a deeper cross-file investigation and inspect what each run consumed.

**Outputs:** Selected execution settings; Usage/status view; Work product associated with its run.

**Auditor control:** The auditor chooses among permitted options, changes direction, or stops work; the administrator retains applicable limits.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Model selection | Choose an approved model for the audit task. |
| Reasoning effort and speed | Adjust investigation depth and turnaround. |
| Usage and limits | Inspect consumption across main and delegated work. |

**Audit-specific enhancements:**

- Show effort choices through task examples and preserve settings with relied-on outputs. Auditors need to understand what changed between two analysis runs without interpreting model settings as evidence quality.

**Example:** Use a modest effort setting to explain a workpaper formula, then a deeper setting to investigate inconsistent revenue evidence across several files.

**Boundary / remaining evidence:** The mechanism transfers directly. A premium model or higher effort is not a professional assurance rating, and a model subscription is not assumed to fund a fork.

**Codex evidence:** [Speed modes](https://learn.chatgpt.com/docs/agent-configuration/speed) (inherited-2026-10-22); [Models](https://learn.chatgpt.com/docs/models) (inherited-2026-10-22). Baseline: C ID and source line 129 in the frozen inventory.

### C54

**Amazon Bedrock provider → Run the audit assistant with an approved AWS model provider**

**Developer behavior:** The local Codex experience can use Amazon Bedrock with AWS authentication. Hosted Codex Cloud and several OpenAI-managed integrations are unavailable on that path; capabilities vary by endpoint and region.

**Auditor trigger:** An organisation configures an approved provider, or an auditor selects an available provider profile.

**Inputs:** AWS identity and approved region/endpoint; Supported model; Local work context and tools.

**Proposed auditor action:** Retain the same audit workspace and local tool loop while sending permitted model requests through the configured Bedrock route.

**Outputs:** Analysis through the selected provider; Visible provider identity and availability; Explicit unavailable-capability status.

**Auditor control:** Administrators approve provider configuration; auditors work within its available models and source permissions.

| Codex subfeature | Auditor mirror |
| --- | --- |
| AWS-native authentication | Use the organisation-approved AWS principal. |
| Region and endpoint selection | Apply the permitted inference route for the assignment. |
| Provider-specific capability limits | Explain unavailable audit actions before running them. |

**Audit-specific enhancements:**

- Display provider and processing route with each engagement's effective policy. A reviewer must distinguish where evidence was processed from where files were stored.

**Example:** A team analyses locally held policy documents using its approved AWS model endpoint while keeping the same workpaper-review workflow.

**Boundary / remaining evidence:** Changing inference provider does not make every connector or product feature available. Source access and tool traffic remain separate; hosted GitHub review is not inherited through this path.

**Codex evidence:** [Bedrock client support and feature availability](https://learn.chatgpt.com/docs/amazon-bedrock) (checked-2026-10-26). Baseline: C ID and source line 130 in the frozen inventory.

### C54A

**Microsoft Azure Foundry / Azure OpenAI provider → Run the audit assistant through an approved Azure model deployment**

**Developer behavior:** Microsoft documents Codex CLI and its VS Code extension using an Azure OpenAI deployment in Microsoft Foundry through the v1 Responses API and configured provider credentials.

**Auditor trigger:** An organisation configures an approved Azure provider profile, and the auditor selects or inherits that profile for the task.

**Inputs:** Approved Azure OpenAI deployment name and endpoint; Provider credentials supplied outside task prompts; Permitted audit context and local tools.

**Proposed auditor action:** Retain the same audit workspace and tool workflow while routing permitted model requests through the organisation's selected Azure deployment.

**Outputs:** Analysis using the selected Azure deployment; Visible deployment and processing route; Clear capability and authentication failures.

**Auditor control:** Administrators approve provider profiles and credential handling; auditors use permitted deployments and can inspect the effective processing route.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Azure OpenAI v1 Responses provider configuration | Use an organisation-approved Azure inference route while preserving the workbench experience. |
| Deployment-name and endpoint selection | Identify the actual model deployment and route used for the audit task. |
| API-key environment-variable configuration | Supply approved provider credentials outside audit prompts and workpapers. |
| CLI and VS Code extension use of provider configuration | Preserve provider choice across supported attended and scripted work paths; validate each intended client. |

**Audit-specific enhancements:**

- Show the effective Azure deployment, endpoint and processing route for each task. Auditors need to distinguish the model's processing route from the location of their work files.
- Provide administrator-managed credential handling and a capability check for each approved deployment. The audit workflow must use supported tools and formats without placing provider credentials in engagement prompts.

**Example:** An audit team reviews policy documents and prepares workpapers using its approved Azure model deployment while continuing to edit the saved outputs in Word and Excel.

**Boundary / remaining evidence:** The checked Microsoft guide establishes an Azure OpenAI provider path for CLI and VS Code, not support for every Foundry model or automatic availability of hosted Codex services. Its documented configuration uses API keys and currently lists Entra ID as unavailable for that Codex path; alternative identity routes require separate verification. Model routing does not determine where files, tools, connectors or browser traffic run. Desktop parity and deployment-specific data handling remain verification items.

**Codex evidence:** [Microsoft: Codex with Azure OpenAI in Microsoft Foundry Models](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/codex?view=foundry-classic) (checked-2026-10-26). User-requested addition documented separately in PROVIDER_ADDITIONS.json; original baseline IDs are preserved.

### C55

**Organization model gateway → Route audit model requests through the organisation's gateway**

**Developer behavior:** Codex supports configured model gateways with provider identifiers, model aliases and credential resolution. Gateways must support expected streaming and tool behavior. This routing covers model requests; external tools may use different paths.

**Auditor trigger:** An administrator applies a model-gateway profile to the workbench.

**Inputs:** Gateway URL and supported protocol; Approved model aliases; Credential resolver and model catalog.

**Proposed auditor action:** Keep the auditor's task experience while selecting models and sending permitted inference requests through the organisation's managed gateway.

**Outputs:** Model responses through the configured route; Effective model/profile indication; Connection or compatibility failures.

**Auditor control:** Administrators determine permitted routing and credentials; the auditor can inspect the effective route and use available choices.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Provider/model aliases | Offer organisation-approved analysis profiles. |
| Credential/token resolver | Keep provider credentials out of engagement prompts. |
| Streaming/tool compatibility | Validate that routed models can complete supported audit tasks. |

**Audit-specific enhancements:**

- Show model processing and evidence-source access as separate routes. An auditor should not infer that all engagement data handling is governed by the model gateway.

**Example:** A firm exposes an approved 'document-review' model alias to auditors across different assignments.

**Boundary / remaining evidence:** The gateway does not automatically mediate spreadsheet reads, browser activity, MCP tools or record-system writes. A complete data-path policy requires those routes to be considered separately.

**Codex evidence:** [Gateway setup](https://learn.chatgpt.com/docs/enterprise/connect-to-a-gateway) (inherited-2026-10-22); [Gateway compatibility](https://learn.chatgpt.com/docs/enterprise/gateway-compatibility) (inherited-2026-10-22). Baseline: C ID and source line 131 in the frozen inventory.

### C56

**Local open-source model provider (`--oss`) → Use a local model for supported audit assistance**

**Developer behavior:** The CLI supports local Ollama or LM Studio models through --oss and provider configuration. Non-interactive execution requires a configured local provider. This inference route does not establish offline support for all tools or integrations.

**Auditor trigger:** The auditor starts an eligible task using an approved local model.

**Inputs:** Running local model provider; Selected model; Local work files and permitted tools.

**Proposed auditor action:** Perform supported explanations, extraction or analysis planning with locally served inference while retaining the task and tool workflow.

**Outputs:** Locally generated response; Supported local work artifacts; Explicit model/provider failures.

**Auditor control:** The auditor or administrator chooses the local model and permitted tools; access to outside services stays separately controlled.

| Codex subfeature | Auditor mirror |
| --- | --- |
| --oss provider selection | Choose local inference for a supported audit task. |
| Provider defaults | Retain the approved local model profile. |
| Non-interactive provider requirement | Fail clearly when an unattended local analysis lacks its model service. |

**Audit-specific enhancements:**

- Expose a task capability check for the selected local model. Auditors should know when document understanding or tool use needs validation before relying on the result.

**Example:** Explain a sensitive local control narrative with an approved local model before deciding which further analysis is appropriate.

**Boundary / remaining evidence:** Do not promise equal capability, accuracy or speed to hosted models, or treat local inference as proof that every task is offline.

**Codex evidence:** [CLI local model options](https://learn.chatgpt.com/docs/cli/reference) (inherited-2026-10-22); [Advanced provider configuration](https://learn.chatgpt.com/docs/config-file/config-advanced) (inherited-2026-10-22). Baseline: C ID and source line 132 in the frozen inventory.

### C57

**Programmatic access and service identities → Attribute unattended assurance runs to an authorised owner**

**Developer behavior:** Eligible workspace access tokens support trusted non-interactive CLI/app-server runs as their creator. Service-account flows are distinct. Token creation permission and local Codex access are separate; expiration and revocation govern continued use.

**Auditor trigger:** A permitted automation starts an audit test without an interactive sign-in.

**Inputs:** Appropriate automation identity; Scoped credentials and validity; Task mandate and runner.

**Proposed auditor action:** Execute the configured test under an identifiable workflow owner and preserve that identity alongside the resulting work.

**Outputs:** Attributed run and artifacts; Authentication or expiry status; Usage associated with the execution identity.

**Auditor control:** An authorised owner provisions, rotates and revokes credentials; the auditor defines the permitted task.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Non-interactive authentication | Start an authorised recurring test. |
| Token expiry and revocation | End or rotate an assurance job's access. |
| Separate service-account flow | Use an organisational run owner where supported. |

**Audit-specific enhancements:**

- Present workflow owner, source-system identity and initiating event together. Unattended findings must remain attributable when the person reading them differs from the executing principal.

**Example:** A monthly duplicate-payment check runs on a trusted machine using a dedicated workflow identity rather than an undocumented shared personal login.

**Boundary / remaining evidence:** The fork's supported authentication route must be established independently. A model credential does not confer access to the payment source or authorise modifying it.

**Codex evidence:** [Access-token authentication and lifecycle](https://learn.chatgpt.com/docs/enterprise/access-tokens) (checked-2026-10-26); [Service accounts](https://learn.chatgpt.com/docs/enterprise/service-accounts) (inherited-2026-10-22). Baseline: C ID and source line 133 in the frozen inventory.

## Workflow, review, and operational controls

### C58

**Git and change review → Inspect, accept and retain changes to audit work**

**Developer behavior:** Supported Codex clients expose file and branch diffs, annotations, selective staging/reversion, commits, pushes and pull requests. Review can examine selected changes without editing the working tree.

**Auditor trigger:** An agent or auditor changes a work product, or requests review of an alternative revision.

**Inputs:** Earlier and current versions; Selected changes and context; Review instructions.

**Proposed auditor action:** Show what changed in workpapers, calculations, narratives and supporting scripts; let the auditor inspect changes, comment, retain selected revisions, or restore an earlier version.

**Outputs:** Readable change comparison; Review observations; Chosen version and change history.

**Auditor control:** The auditor accepts or rejects changes and decides when to share the revised output. These choices remain separate from professional sign-off.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Diff and line annotations | Inspect and comment on meaningful workpaper changes. |
| Stage/unstage/revert | Select or undo proposed revisions where the artifact supports it. |
| Commit/branch/PR | Retain revisions, compare alternatives and request review. |

**Audit-specific enhancements:**

- Compare audit-relevant cells, formulas, passages and evidence links. Binary-file differences alone do not explain a changed conclusion.
- Warn when a revision affects previously reviewed work. A review of an earlier version may no longer cover the current one.

**Example:** After revising a sampling workbook, inspect changed parameters and formulas, retain the corrected calculation, and reject an unrelated narrative edit.

**Boundary / remaining evidence:** Preserve the review/acceptance experience. Semantic comparisons and safe merging for Office files require investigation; they cannot be assumed from text Git diffs, and auditors need not see Git terminology.

**Codex evidence:** [Code and Git change review](https://learn.chatgpt.com/docs/code-review) (inherited-2026-10-22). Baseline: C ID and source line 139 in the frozen inventory.

### C59

**Scheduled tasks → Run recurring assurance and preparation tasks**

**Developer behavior:** Desktop schedules run recurring work in local project folders or isolated worktrees under configured permissions. Local files require an available computer/app. Web event-triggered tasks are a separate path; CLI lacks the Scheduled management interface.

**Auditor trigger:** An explicitly configured time or recurring interval arrives.

**Inputs:** Task instructions and recurrence; Work folder and permitted sources; Applicable skills, tools and execution policy.

**Proposed auditor action:** Repeat a defined audit analysis, evidence check or preparation routine and return its results to the designated task or separate run.

**Outputs:** Dated result package; Run success/failure and exceptions; Items requiring attention.

**Auditor control:** The auditor configures, edits, pauses or removes the schedule and reviews consequential conclusions or actions.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Recurring schedule | Repeat defined assurance procedures. |
| Project/worktree execution | Run against current work or an isolated analysis copy. |
| Run management and task destination | Inspect results, pause monitoring and resume investigation. |

**Audit-specific enhancements:**

- State the period, source version and last successful coverage for each run. A quiet monitor should not conceal a missed week or stale extract.

**Example:** Every Monday compare the current vendor-master extract with the prior snapshot and report newly changed bank details for investigation.

**Boundary / remaining evidence:** A schedule is not a business-event detector or a guarantee that work ran. Device availability, missing data and failures must remain visible; successful execution does not close a finding.

**Codex evidence:** [Scheduled tasks and local execution limits](https://learn.chatgpt.com/docs/automations) (checked-2026-10-26). Baseline: C ID and source line 140 in the frozen inventory.

### C60

**Voice and dictation → Speak instructions and steer audit work hands-free**

**Developer behavior:** Supported desktop/mobile clients accept voice input and task interaction; existing task context can continue. Screen-context availability varies by platform. CLI voice is experimental, and this catalog does not establish general CLI audio-file ingestion.

**Auditor trigger:** The auditor starts voice input or continues a task through a supported voice surface.

**Inputs:** Spoken instruction; Selected task context; Explicitly available screen context.

**Proposed auditor action:** Let the auditor describe a discrepancy, ask for an explanation, change the analysis direction or review progress while working in their files.

**Outputs:** Captured task instruction; Spoken or displayed explanation; Updated task direction and artifacts.

**Auditor control:** The auditor can correct recognition errors, choose the active task and stop voice interaction.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Dictation | Speak audit instructions and notes. |
| Voice task steering | Redirect analysis while reviewing work. |
| Supported screen context | Discuss the visible work item where the client permits it. |

**Audit-specific enhancements:**

- Confirm ambiguous amounts, dates and entity names before consequential use. Misheard audit identifiers can direct testing toward the wrong population.

**Example:** While reviewing a reconciliation, say 'Explain why these three balances differ, then show the supporting transactions.'

**Boundary / remaining evidence:** Task dictation does not automatically constitute a recorded interview, an accurate transcript, or evidence of another person's statement. Live screen support must be verified per client.

**Codex evidence:** [Voice and dictation](https://learn.chatgpt.com/docs/features/voice) (inherited-2026-10-22). Baseline: C ID and source line 141 in the frozen inventory.

### C61

**Notifications and task visibility → See which audit work is running or needs attention**

**Developer behavior:** Desktop/mobile clients expose activity and unread or waiting work, with notifications when attention is needed. Available states, filters and alert behavior vary across clients.

**Auditor trigger:** A task finishes, encounters a problem, requires input, or has a new result.

**Inputs:** Task state and result metadata; Notification preferences; User's visible workstreams.

**Proposed auditor action:** Keep the auditor aware of analysis progress and direct them to the exact task, finding or decision needing attention.

**Outputs:** Activity/status display; Configured notification; Link to the relevant run and result.

**Auditor control:** The auditor decides what to open, prioritise or mute and can inspect the underlying task before acting.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Active/waiting status | Track concurrent tests and requested decisions. |
| Unread results | Find analyses not yet inspected. |
| Notifications | Bring consequential exceptions or blocked work to attention. |

**Audit-specific enhancements:**

- Separate completed analysis, detected exception, missing evidence and review-needed states. Each requires a different auditor response even if the agent turn has ended.

**Example:** While the auditor reviews a report in Word, a notice indicates that the access-review analysis found an unexplained privileged account.

**Boundary / remaining evidence:** A 'done' indicator describes execution state, not a favourable assurance conclusion or reviewer approval.

**Codex evidence:** [Notifications and task attention](https://learn.chatgpt.com/docs/notifications) (inherited-2026-10-22). Baseline: C ID and source line 142 in the frozen inventory.

### C62

**Pets and floating task companion → Optional floating companion for audit-task awareness**

**Developer behavior:** The desktop app offers an optional animated companion that can show task activity and provide chat or voice entry above other windows. Appearance changes do not change agent behavior; custom companions are supported in specified surfaces.

**Auditor trigger:** The auditor enables the companion or interacts with it while another application is active.

**Inputs:** Chosen appearance; Current task/activity state; Text or voice request.

**Proposed auditor action:** Preserve an optional lightweight entry and status surface while the auditor works in Excel, Word or another application.

**Outputs:** Ambient activity cue; Opened task or new request; Access to continuing assistance.

**Auditor control:** The auditor can enable, personalise or hide the companion and chooses when to open the underlying task.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Floating status | Show audit-task activity beside existing tools. |
| Text/voice entry | Resume assistance from the companion. |
| Custom appearance | Retain optional personalisation without changing analysis behavior. |

**Audit-specific enhancements:**

- Use discreet task labels and configurable notification detail. Ambient cues should not expose client names or findings during meetings or screen sharing.

**Example:** An auditor working in PowerPoint uses the floating companion to ask for the source behind a reported finding without navigating away first.

**Boundary / remaining evidence:** This remains a peripheral experience feature. Animation neither establishes completion nor grants access to the foreground document.

**Codex evidence:** [Pets and task companion](https://learn.chatgpt.com/docs/pets) (inherited-2026-10-22). Baseline: C ID and source line 143 in the frozen inventory.

### C63

**Import and setup migration → Bring existing assistance setup into the audit workbench**

**Developer behavior:** Supported Codex import flows transfer selected configuration and recent work from other agent tools. Coverage varies by client and source; imported tools may need reauthorisation. CLI import has local-session and recent-chat limits.

**Auditor trigger:** An auditor chooses to import supported setup or recent task context.

**Inputs:** Selected source configuration; Instructions, skills and agent definitions; Eligible project folders and recent chats.

**Proposed auditor action:** Bring reusable work conventions and selected task context into the audit workbench, showing what transferred and what needs attention.

**Outputs:** Imported setup inventory; Transfer exceptions; Reauthorisation or review items.

**Auditor control:** The auditor chooses the import scope and inspects executable extensions and connections before relying on them.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Configuration/skill import | Reuse established analysis procedures and preferences. |
| Recent task/project import | Continue supported investigative context. |
| Connection reauthorisation | Reconnect only the permitted evidence sources. |

**Audit-specific enhancements:**

- Identify engagement/client scope and source for imported memories and instructions. Convenient migration must not silently mix confidential client context.

**Example:** An auditor moves existing analysis skills and engagement instructions from another agent tool into the new workbench.

**Boundary / remaining evidence:** Importing agent setup is distinct from importing an entire audit system, preserving formal sign-offs or migrating authoritative records. Those require separate evidence and planning.

**Codex evidence:** [Import supported agent setup](https://learn.chatgpt.com/docs/import) (inherited-2026-10-22). Baseline: C ID and source line 144 in the frozen inventory.

### C64

**Shared thread snapshots → Share a fixed view of an audit investigation**

**Developer behavior:** The documented macOS desktop flow shares a fixed read-only Codex thread snapshot. Audience controls differ by account. Supported visible content and diffs may appear, while original tool calls/results are omitted; links can be revoked.

**Auditor trigger:** The auditor chooses to share a completed or in-progress investigation snapshot.

**Inputs:** Selected thread state; Intended audience; Visible work and changes.

**Proposed auditor action:** Prepare a fixed reviewable account of the investigation for an allowed recipient while preserving the distinction between a conversation snapshot and underlying evidence.

**Outputs:** Read-only snapshot link; Audience information; Revocable shared view.

**Auditor control:** The auditor inspects the shared view, selects recipients where supported, and revokes the link when appropriate.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Point-in-time snapshot | Share a fixed investigation narrative. |
| Audience selection | Limit review access under the supported account model. |
| Link inspection/revocation | Check disclosure and withdraw access to the snapshot. |

**Audit-specific enhancements:**

- Show which supporting evidence and execution details are absent from the shared view. The reviewer must know when to request the actual workpaper or evidence package.

**Example:** Share the discussion explaining a reconciliation exception with a manager before a review meeting.

**Boundary / remaining evidence:** Recipients do not automatically receive workspace access, executable context or a complete evidence file. Sensitive details can survive automated redaction; a snapshot is not formal sign-off.

**Codex evidence:** [Codex read-only snapshot sharing](https://learn.chatgpt.com/docs/use-chatgpt) (checked-2026-10-26). Baseline: C ID and source line 145 in the frozen inventory.

## Security, privacy, and trust boundaries

### C65

**Sandbox and permission profiles → Bound what an audit task can read, change and contact**

**Developer behavior:** Codex separates filesystem and network restrictions, with OS-specific sandbox enforcement and distinct local/cloud resources. Named permission profiles are documented as beta; technical access differs from approval policy and source-system identity.

**Auditor trigger:** A task starts under a permission profile or requests an operation outside its current boundary.

**Inputs:** Allowed paths and write scope; Network policy; Execution location and operating-system controls.

**Proposed auditor action:** Run audit tools within the permitted work area, such as reading source extracts while writing analyses only to the engagement's output folder.

**Outputs:** Allowed execution results; Clear access-denial or escalation state; Effective permission indication.

**Auditor control:** The auditor and administrator select permitted profiles within policy and review any eligible boundary-crossing request.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Filesystem scope | Separate source reading from permitted work-product changes. |
| Network restrictions | Control permitted evidence and service destinations. |
| Environment-specific profiles | Make local, remote and cloud task reach visible. |

**Audit-specific enhancements:**

- Explain access in terms of source evidence, working copies, outputs and external destinations. Auditors need to understand consequences without reading raw filesystem policy syntax.

**Example:** An agent tests a payroll extract and produces a results workbook while lacking authority to change the payroll source.

**Boundary / remaining evidence:** A sandbox limits technical reach; it does not prove an auditor is entitled to a dataset or that analysis methods are suitable.

**Codex evidence:** [Permission profiles](https://learn.chatgpt.com/docs/permissions) (inherited-2026-10-22); [Sandboxing](https://learn.chatgpt.com/docs/sandboxing) (inherited-2026-10-22). Baseline: C ID and source line 151 in the frozen inventory.

### C66

**Approvals and automatic review → Review consequential tool actions separately from audit conclusions**

**Developer behavior:** Codex can route eligible interactive approval requests to a separate reviewer agent while retaining the same sandbox and policy. Routine permitted actions proceed normally. Computer Use prompts remain human-facing; automatic review is not a permission expansion. Documented configurations also include full-access/no-prompt operation, subject to applicable policy.

**Auditor trigger:** A task runs under its selected approval policy, and an action may require a decision or proceed under a configured no-prompt mode.

**Inputs:** Exact proposed action; Applicable task authority and policy; Relevant retained conversation/tool evidence.

**Proposed auditor action:** Show the effective action authority and destination. Obtain decisions required by the configured policy; represent full-access/no-prompt operation explicitly when permitted, without treating that mode as professional approval.

**Outputs:** Permission decision and rationale; Executed action or safe alternative; Escalation when unresolved.

**Auditor control:** The auditor retains appropriate action-approval authority; managed controls remain effective and professional approval stays distinct.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Human approval prompts | Review a proposed external or consequential action. |
| Automatic action reviewer | Evaluate eligible permission requests under the same policy. |
| Denial and safe alternative | Continue authorised analysis without bypassing a rejected action. |
| Full-access/no-prompt configuration | Represent a broad execution mode when policy permits it, with its effective reach visible |

**Audit-specific enhancements:**

- Use separate labels for permission to act, analytical review and professional approval. The same word 'approve' must not conceal materially different authority.

**Example:** An analysis finishes locally; publishing its findings to a remote audit record requires a separately evaluated action permission.

**Boundary / remaining evidence:** Tool permission, agent review of work, and professional sign-off are different decisions. An automated permission reviewer cannot certify evidence sufficiency or grant wider access. Including the broad mode in this inventory is not a recommendation to enable it; its scope must remain visible.

**Codex evidence:** [Automatic approval review](https://learn.chatgpt.com/docs/sandboxing/auto-review) (checked-2026-10-26); [Approval and sandbox separation](https://learn.chatgpt.com/docs/agent-approvals-security) (inherited-2026-10-22). Baseline: C ID and source line 152 in the frozen inventory.

### C67

**Approved cyber model access (Daybreak / Trusted Access) → Use approved specialist cyber capabilities for authorised IT audit work**

**Developer behavior:** Specialist defensive and advanced cyber model offerings have separate eligibility and provisioning requirements tied to identity, project and product surface. Such access is distinct from security scanning and does not itself establish retention privileges.

**Auditor trigger:** An authorised IT/IS audit task selects an available specialist cyber capability.

**Inputs:** Approved model entitlement; Explicit assessment scope; Permitted system artifacts and environment.

**Proposed auditor action:** Retain access to specialist reasoning for scoped security investigations while showing the specific model and task boundaries.

**Outputs:** Security analysis and supporting evidence; Documented capability/access limits; Proposed corrective work for review.

**Auditor control:** The authorised practitioner defines scope and consequential actions; organisation and service access restrictions continue to apply.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Offering-specific access | Expose only approved specialist analysis choices. |
| Identity/project conditions | Keep authorised engagement and service boundaries visible. |
| Separate scanner/tool capability | Distinguish reasoning access from executable security tests. |

**Audit-specific enhancements:**

- Bind the selected specialist capability to the authorised audit target and test scope. A broad cyber model's capability should not be confused with the auditor's authority.

**Example:** An IT auditor analyses supplied access-control code and configuration within an authorised assessment.

**Boundary / remaining evidence:** No model entitlement authorises activity against arbitrary systems. The offering is not a ready-made audit methodology, and availability in Codex does not establish availability to a fork.

**Codex evidence:** [Models and Trusted Access for Cyber](https://learn.chatgpt.com/docs/cyber-safety) (inherited-2026-10-22). Baseline: C ID and source line 153 in the frozen inventory.

### C68

**Prisma AIRS prompt inspection → Apply configured inspection to submitted audit prompts**

**Developer behavior:** Eligible workspace-authenticated Codex flows can send submitted prompt text to Prisma AIRS for configured checks. Policies may alert or block. The documented scope excludes responses, tool results, files and images, and API-key sessions.

**Auditor trigger:** An auditor submits prompt text on an enabled, supported surface.

**Inputs:** Submitted prompt text; Organisation inspection policy; Configured inspection service.

**Proposed auditor action:** Evaluate the prompt under configured disclosure and malicious-content checks before the supported workflow proceeds.

**Outputs:** Allowed prompt or block/alert result; Inspection-service status; User-visible reason where provided.

**Auditor control:** Administrators configure enforcement and failure behavior; auditors can revise blocked content or use an authorised path.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Prompt-text inspection | Check submitted audit instructions under policy. |
| Alert or block | Explain whether work can proceed. |
| Fail-open/fail-closed configuration | Make inspection-outage behavior explicit. |

**Audit-specific enhancements:**

- Explain which submitted audit material was inspected and which was outside coverage. An auditor should not infer that an attached workbook was checked because the surrounding prompt was allowed.

**Example:** An auditor accidentally pastes sensitive identifiers into a prompt and receives a policy block before the supported submission proceeds.

**Boundary / remaining evidence:** This narrow prompt inspection is not comprehensive evidence-file scanning or complete protection from prompt injection. Provider and client eligibility must be verified for a fork.

**Codex evidence:** [Prisma AIRS inspection scope](https://learn.chatgpt.com/docs/enterprise/prisma-airs) (inherited-2026-10-22). Baseline: C ID and source line 154 in the frozen inventory.

### C69

**Command rules → Allow, review or forbid particular analysis commands**

**Developer behavior:** Experimental command-prefix rules can allow, prompt or forbid commands running outside the sandbox; the most restrictive matching rule wins. These rules do not govern every app, browser, MCP or cloud action.

**Auditor trigger:** The agent attempts a command covered by a configured rule.

**Inputs:** Command and parsed arguments; Applicable rule files; Current execution and approval policy.

**Proposed auditor action:** Apply command-specific restrictions to repeatable analysis operations while preserving an understandable reason for allowed, prompted or blocked execution.

**Outputs:** Rule decision; Command result or refusal; Applicable rule explanation.

**Auditor control:** Administrators or authorised users set rules within policy; auditors respond to permitted prompts.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Allow rule | Permit a matching command outside the sandbox where the effective policy allows it, with that authority explicit. |
| Prompt rule | Review a consequential command invocation. |
| Forbid/precedence | Block restricted operations and explain the controlling rule. |

**Audit-specific enhancements:**

- Describe rules using the analysis action and destination as well as the command. Auditors need to understand a command's effect without judging executable names alone.

**Example:** Permit an approved reconciliation script while requiring review before an export command sends results outside the workspace.

**Boundary / remaining evidence:** Rules are one execution control, not a universal audit authorisation engine. Shell parsing and tool-path differences matter; allowing a command does not validate its findings.

**Codex evidence:** [Command rule matching and precedence](https://learn.chatgpt.com/docs/agent-configuration/rules) (inherited-2026-10-22). Baseline: C ID and source line 155 in the frozen inventory.

### C70

**Agent Security and managed policy → Apply organisational workbench policy consistently**

**Developer behavior:** Enterprise controls distinguish orchestration policy from execution settings and support documented local/cloud overrides and inheritance. Managed requirements constrain personal configuration. ChatGPT Work Cloud has separate controls rather than inheriting Codex Cloud policy automatically.

**Auditor trigger:** A task starts, changes environment, or uses a managed capability.

**Inputs:** Organisation requirements; Permitted local/cloud overrides; User and project configuration.

**Proposed auditor action:** Calculate and display effective policy for the auditor's task, including execution, tools, extensions and approval behavior.

**Outputs:** Effective policy view; Allowed or restricted capability state; Explanation of inherited restrictions.

**Auditor control:** Administrators govern required policy; auditors retain choices only within the allowed range.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Global orchestration controls | Apply common assistance and approval rules. |
| Environment overrides | Adapt permitted execution by location. |
| Managed precedence | Show which organisation rule governs a disputed setting. |

**Audit-specific enhancements:**

- Explain the effective policy against the current assignment and chosen execution location. Auditors must understand why an action available elsewhere is unavailable for this work.

**Example:** A firm permits local analysis for a client assignment but restricts cloud execution and unapproved extensions.

**Boundary / remaining evidence:** Managed agent policy is not an audit methodology or assurance standard. Different execution surfaces require explicit coverage; one environment's settings cannot be presumed to govern another.

**Codex evidence:** [Agent Security policy](https://learn.chatgpt.com/docs/enterprise/agent-security) (inherited-2026-10-22); [Managed configuration](https://learn.chatgpt.com/docs/enterprise/managed-configuration) (inherited-2026-10-22). Baseline: C ID and source line 156 in the frozen inventory.

### C71

**Workspace roles, access, and user lifecycle → Manage access as audit-team membership changes**

**Developer behavior:** Workspace roles, seats, local/cloud access and source permissions are distinct. Provisioning can use groups. Token suspension and revocation differ: restoring local access can reactivate suspended tokens unless they were revoked.

**Auditor trigger:** An auditor joins, changes assignment or role, or leaves the organisation.

**Inputs:** Workspace membership and groups; Runtime/tool entitlements; Owned credentials and external connections.

**Proposed auditor action:** Provision the permitted workbench capabilities and track which access must be changed or ended when responsibilities change.

**Outputs:** Effective access state; Provisioning/deprovisioning results; Outstanding credential/access actions.

**Auditor control:** Administrators manage entitlements; engagement responsibilities determine appropriate access through the chosen policy.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Groups and provisioning | Grant the intended workbench access. |
| Separate runtime entitlements | Distinguish local, cloud and tool access. |
| Token lifecycle | Suspend, revoke or reassign automation access deliberately. |

**Audit-specific enhancements:**

- Show engagement/client access and owned unattended jobs during reassignment or departure. Confidentiality and continuity extend beyond the person's visible workspace seat.

**Example:** A contractor finishes an engagement: remove the permitted workspace access and separately revoke or transfer the automation credentials they owned.

**Boundary / remaining evidence:** Removing a seat does not necessarily revoke every external credential. Workspace roles alone do not implement preparer, supervisor or partner sign-off semantics.

**Codex evidence:** [User lifecycle](https://learn.chatgpt.com/docs/enterprise/user-lifecycle) (inherited-2026-10-22); [Roles and permissions](https://learn.chatgpt.com/docs/enterprise/roles-and-workspace-permissions) (inherited-2026-10-22); [Token suspension and revocation](https://learn.chatgpt.com/docs/enterprise/access-tokens) (checked-2026-10-26). Baseline: C ID and source line 157 in the frozen inventory.

### C72

**Source/connector identity → Show whose access is used for each evidence source**

**Developer behavior:** Connected tools use their configured authentication and permission scope. Remote-host tasks use host-side credentials and resources. The person steering a task can differ from the principal performing its source-system actions.

**Auditor trigger:** The task reads evidence or proposes an action through a connected source or remote host.

**Inputs:** Connected account/principal; Source-system scope; Executing host and requested action.

**Proposed auditor action:** Use the permitted source identity and make its relationship to the initiating auditor clear.

**Outputs:** Retrieved evidence or action result; Source and principal attribution; Access failure or insufficient-scope status.

**Auditor control:** The auditor chooses an authorised connection where available; source-system permissions constrain what the task can do.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Connector authentication | Use the approved evidence-source account. |
| Permission scopes | Respect read/write and entity boundaries. |
| Remote-host identity | Explain which host's credentials executed the analysis. |

**Audit-specific enhancements:**

- Attach source account, entity scope and extraction context to relied-on results. A complete-looking dataset may reflect a principal that could see only one subsidiary.

**Example:** An access review reads a directory export using the approved read-only service account while the audit manager steers the investigation.

**Boundary / remaining evidence:** Visible workspace membership and model identity do not determine source permissions. Shared files remain a separate access path with their own filesystem permissions.

**Codex evidence:** [MCP authentication and tools](https://learn.chatgpt.com/docs/extend/mcp) (inherited-2026-10-22); [Remote-host access](https://learn.chatgpt.com/docs/remote-connections) (inherited-2026-10-22). Baseline: C ID and source line 158 in the frozen inventory.

### C73

**Untrusted inputs and hooks → Keep evidence content separate from instructions to the agent**

**Developer behavior:** Files, web pages, tool results and extension content may contain untrusted instructions. Hooks and plugin code can execute locally after applicable trust review; external tools may also cause side effects.

**Auditor trigger:** The agent encounters supplied evidence or a user enables executable extension behavior.

**Inputs:** Evidence/document content; Trusted task instructions; Hook/plugin code and declared actions.

**Proposed auditor action:** Treat material under examination as evidence, follow the authorised task instructions, and expose extension trust and side-effect decisions.

**Outputs:** Analysis that identifies its source material; Rejected or ignored embedded instructions; Extension trust or action decision.

**Auditor control:** The auditor controls task authority and permitted extensions; evidence providers cannot silently redefine the agent's mandate.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Untrusted repository/web/tool text | Separate examined evidence from authorised instructions. |
| Hook/plugin trust review | Inspect executable audit extensions before use. |
| External side effects | Explain what an evidence tool may change. |

**Audit-specific enhancements:**

- Make evidence-originated instructions recognisable in the investigation record. Audit evidence can contain adversarial or misleading content that should itself be evaluated.

**Example:** A supplied policy document contains text directing the assistant to omit a control weakness; the agent evaluates the document without treating that text as an instruction.

**Boundary / remaining evidence:** Trust review does not guarantee an extension is harmless. Preserve the existing instruction/evidence boundary rather than assuming every connected source is trustworthy.

**Codex evidence:** [Hook trust and execution](https://learn.chatgpt.com/docs/hooks) (inherited-2026-10-22); [Plugin permissions and trust](https://learn.chatgpt.com/docs/plugins) (inherited-2026-10-22). Baseline: C ID and source line 159 in the frozen inventory.

### C74

**Enterprise usage analytics and compliance records → Inspect workbench adoption, operation and supported compliance events**

**Developer behavior:** Enterprise usage analytics, the Analytics API, supported Compliance API events and local telemetry expose different information. They have separate permissions and coverage; none establishes a complete record of every action, input and model decision.

**Auditor trigger:** An authorised administrator or reviewer requests usage statistics or supported activity records.

**Inputs:** Aggregate usage data; Supported compliance events; Requested period and authorised scope.

**Proposed auditor action:** Report workbench adoption and operational activity while identifying which data source supports each statement.

**Outputs:** Usage/adoption summaries; Supported event exports; Coverage and access limitations.

**Auditor control:** Authorised roles select the scope and recipients; use of these records follows the applicable organisational purpose.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Usage dashboards/Analytics API | Understand adoption and consumption. |
| Compliance events | Inspect supported administrative/activity records. |
| Role-scoped exports | Provide authorised records with explicit coverage. |

**Audit-specific enhancements:**

- Separate task volume, completed tests, exceptions and accepted work from token usage. Auditor productivity and coverage cannot be inferred from consumption alone.

**Example:** A team lead examines how often automated tests ran and separately checks available access events when investigating an account issue.

**Boundary / remaining evidence:** Monitoring the audit tool is different from testing the client's controls. Usage counts do not measure assurance quality, and compliance events do not replace workpaper evidence.

**Codex evidence:** [Workspace analytics](https://learn.chatgpt.com/docs/enterprise/workspace-analytics) (inherited-2026-10-22); [Analytics API](https://learn.chatgpt.com/docs/enterprise/analytics-api) (inherited-2026-10-22); [Compliance API](https://learn.chatgpt.com/docs/enterprise/compliance-api) (inherited-2026-10-22). Baseline: C ID and source line 160 in the frozen inventory.

### C75

**Retention, logs, and telemetry → Retain and inspect task history with explicit coverage**

**Developer behavior:** Codex persistence and histories vary by surface. Optional OpenTelemetry exports selected operational events and is off by default; prompt content is redacted by default. Telemetry, aggregate analytics and compliance records have different retention and coverage.

**Auditor trigger:** A user resumes an investigation, diagnoses a failed run, exports supported records or applies a retention policy.

**Inputs:** Thread/run history; Enabled operational event sources; Retention and export settings.

**Proposed auditor action:** Preserve useful task continuity and diagnostics, and show what the retained record includes or omits.

**Outputs:** Resumable investigation history; Supported diagnostic records; Retention/deletion status and limitations.

**Auditor control:** The auditor or administrator chooses permitted retention and diagnostic settings; relying reviewers inspect the relevant evidence package separately.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Thread/rollout persistence | Resume the investigation with retained context. |
| Optional operational telemetry | Diagnose task and tool failures. |
| Retention/export/deletion controls | Apply the chosen working-data policy transparently. |

**Audit-specific enhancements:**

- Link retained task history to source versions, analysis artifacts and the designated record destination. A later reviewer needs to distinguish recoverable working context from the relied-on audit record.

**Example:** Investigate why a reconciliation job stopped by examining retained tool status and rerun context, then keep the approved output in its designated record system.

**Boundary / remaining evidence:** A chat transcript or telemetry stream is not automatically complete, immutable or compliant with the applicable audit-record policy.

**Codex evidence:** [Operational telemetry](https://learn.chatgpt.com/docs/agent-approvals-security) (inherited-2026-10-22); [Compliance-record boundaries](https://learn.chatgpt.com/docs/enterprise/compliance-api) (inherited-2026-10-22). Baseline: C ID and source line 161 in the frozen inventory.

## User-supplied composition hypothesis for later planning

These three entries are composition lenses retained from the earlier catalog. They are not additional standalone Codex features.

### C76

**Task workflow → Describe an audit outcome and carry the work through to review**

**Developer behavior:** This is a composition lens from ChatGPT Work, not a separate Codex feature: outcome-oriented requests combine research, tools, progress, steering and reviewable outputs. Its constituent mechanisms are mapped individually elsewhere.

**Auditor trigger:** The auditor describes the outcome, context and constraints of a task.

**Inputs:** Requested outcome; Relevant evidence and context; Constraints and review expectations.

**Proposed auditor action:** Coordinate the existing task mechanisms to investigate, analyse, prepare an output, explain limitations and respond to review.

**Outputs:** Reviewable work product; Progress and decisions; Supporting evidence references.

**Auditor control:** The auditor steers the task, challenges assumptions and decides how the output is used.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Outcome-focused request lens | Define the audit question and expected work product. |
| Steerable multistep workflow lens | Investigate and revise with the auditor. |
| Reviewable result lens | Inspect the output in the preferred tool. |

**Audit-specific enhancements:**

- Express outcomes and completion criteria using the practitioner's work products. The same task loop should serve standalone advisory work as well as formal audit procedures.

**Example:** Ask for a reconciliation and an explanation of unresolved items, then inspect the workbook in the workbench or Excel.

**Boundary / remaining evidence:** Retain this lens for composition coverage without counting it as an additional Codex capability. It does not require a prescribed engagement lifecycle for every task.

**Codex evidence:** [Work task workflow reference](https://learn.chatgpt.com/docs/get-started-with-work) (inherited-2026-10-22). Baseline: C ID and source line 169 in the frozen inventory.

### C77

**Agent capability/runtime → Retain Codex's general agent foundation for audit work**

**Developer behavior:** This is the catalog's composition lens for Codex's harness, execution, context, agents, extensions and controls. It summarises separately listed capabilities rather than introducing a further runtime feature.

**Auditor trigger:** An audit task invokes the general agent workflow.

**Inputs:** Task and workspace context; Permitted tools and extensions; Execution and provider policy.

**Proposed auditor action:** Preserve the general-purpose agent foundation while supplying audit-oriented tools, examples and work surfaces, with the original breadth still visible.

**Outputs:** Tool-assisted work and artifacts; Inspectible progress and resumable state; Delegated results where applicable.

**Auditor control:** The auditor retains task steering, output review and configured permission decisions.

| Codex subfeature | Auditor mirror |
| --- | --- |
| Tool-loop composition | Coordinate evidence reading, analysis and output creation. |
| Context/agent composition | Sustain and delegate investigative work. |
| Execution/control composition | Keep tasks inspectible and bounded. |

**Audit-specific enhancements:**

- Translate runtime outcomes into understandable audit activity while retaining technical detail on demand. Auditors need to follow the work without losing access to the actual analysis method.

**Example:** A single investigation searches documents, executes a reconciliation script, asks a specialist agent to inspect an exception and revises the report.

**Boundary / remaining evidence:** A composition lens is not another feature count or proof that every hosted/client component is reusable. Required services and source boundaries remain research evidence.

**Codex evidence:** [Open agent harness composition](https://developers.openai.com/blog/codex-as-a-platform) (inherited-2026-10-22); [Client/runtime boundary](https://learn.chatgpt.com/docs/app-server) (inherited-2026-10-22). Baseline: C ID and source line 170 in the frozen inventory.

### C78

**Auditor-tailored workflow → Use the Codex-derived experience across audit practices**

**Developer behavior:** This entry is the user's audit-product composition lens, not an existing Codex feature. It asks how general agent capabilities adapt across practice areas, methodologies and the two proposed record modes.

**Auditor trigger:** An auditor applies their working method to a task or engagement.

**Inputs:** Practitioner's terminology and method; Assignment context and work artifacts; Chosen external or built-in record mode.

**Proposed auditor action:** Compose the mapped mechanisms around the auditor's actual work while retaining shared-file editing, task steering and review.

**Outputs:** Practice-appropriate work products; Traceable analysis and decisions; Work delivered to the designated record destination.

**Auditor control:** The practitioner chooses methods and retains professional judgement; organisations define applicable roles and policies.

| Codex subfeature | Auditor mirror |
| --- | --- |
| General-purpose workflow composition | Apply the foundation to different audit practices. |
| Customisation mechanisms | Use the practitioner's procedures and terminology. |
| Output and integration mechanisms | Support shared files and the designated record mode. |

**Audit-specific enhancements:**

- Provide adaptable terminology, procedures and artifact views without imposing one audit methodology. Internal, external, advisory and IT/IS work need different domain content while sharing the same assistance experience.

**Example:** Use the same workspace experience for an operational advisory memo, a financial test and an IT access review, changing the task instructions and procedures.

**Boundary / remaining evidence:** Record this as a product requirement lens without attributing audit functionality to Codex. A full built-in audit record lifecycle requires separate domain planning; the accepted two-mode ambition remains.

**Codex evidence:** [Underlying Codex customisation reference; audit composition is user-specified](https://learn.chatgpt.com/docs/customization/overview) (inherited-2026-10-22). Baseline: C ID and source line 171 in the frozen inventory.

## Expanded behaviors within the feature groups

These entries unpack capabilities that the earlier catalog grouped together. They are linked to their parent C IDs and are not counted as additional independent feature families. Codex descriptions below were checked against the linked official pages on October 26, 2026. Every auditor counterpart and enhancement is a proposed adaptation. Availability remains specific to the reference product, account, client, and configuration.

| ID / parent | Codex behavior | Direct auditor use | Enhancement for audit work |
| --- | --- | --- | --- |
| E01 / C28, C44 | A person requests review of a pull request with a comment; findings return to the PR. [GitHub review](https://learn.chatgpt.com/docs/third-party/github) | Request a review of a submitted workpaper, calculation change, policy revision, or process-change package; receive findings linked to the affected material. | Reference document sections, cells, transactions and control steps; classify observation, evidence gap and proposed correction separately. |
| E02 / C28, C44 | Configured repository policies and matching events start automatic reviews. [GitHub review](https://learn.chatgpt.com/docs/third-party/github) | A new or revised change package starts a scoped control/evidence review automatically, including the user's interest-rate-change example. | Define eligible event sources, scope, effective version, test procedure, destination and reporting threshold. Distinguish event not received, review not run, incomplete review and no reported exceptions. |
| E03 / C39, C28 | Applicable repository instructions tailor review checks; one-off comments can narrow focus. [GitHub review](https://learn.chatgpt.com/docs/third-party/github) | Apply organisation, process, engagement and procedure-specific review criteria, with an explicit one-off focus when requested. | Version criteria and resolve conflicting instructions; make evidence requirements and method exceptions visible. Instructions guide analysis; they do not create formal approvals. |
| E04 / C21, C44 | A follow-up request can start a permitted cloud task to fix a reviewed issue. [GitHub review](https://learn.chatgpt.com/docs/third-party/github) | Ask the agent to correct a workpaper formula, improve a report, prepare a remediation proposal or rerun a failed test. | Distinguish edits to auditor work from operational changes. Keep proposed correction, application, retest and closure as separate actions. |
| E05 / C43 | A GitHub Actions workflow runs non-interactive Codex with selected context and permissions. [GitHub Action](https://learn.chatgpt.com/docs/github-action) | Run a repeatable audit procedure when an approved data delivery, period-end package or change event arrives; emit machine-readable results and a review package. | Define input completeness, event deduplication, reproducible procedure parameters, retries and explicit incomplete/error states. The trigger source and runner are additional mechanisms to establish. |
| E06 / C44 | GitLab merge-request review supports manual and automatic invocation; access, webhooks and review policy govern behavior. Beta; Smart Trigger is experimental. [GitLab](https://learn.chatgpt.com/docs/third-party/gitlab) | Receive change packages from different approved source platforms using a consistent audit-review experience. | Preserve source identity, change revision and permissions in every result. Different platforms need supported adapters; a generic connector label is insufficient. |
| E07 / C44 | An authorised Slack request can delegate repository work to a configured cloud environment and return a result to the thread. [Slack](https://learn.chatgpt.com/docs/third-party/slack) | Ask for an analysis or evidence review from a collaboration thread, follow the task and receive a suitable summary there. | Bind the correct client/engagement; distinguish the thread audience from access to full evidence; review consequential outgoing messages. |
| E08 / C44 | Assigning or mentioning Codex in a Linear issue starts work, posts progress and supports follow-up in that issue. [Linear](https://learn.chatgpt.com/docs/third-party/linear) | Delegate a workpaper request, exception investigation or remediation retest from the auditor's task system. | Resolve the intended engagement explicitly when ambiguous; retain requester, task identity, due date and result links without silently transferring record authority. |
| E09 / C44 | Linear triage rules can automatically delegate qualifying new issues to Codex. [Linear](https://learn.chatgpt.com/docs/third-party/linear) | Route new evidence requests or flagged exceptions into a predefined audit procedure automatically. | Record why an item matched, the acting identity and accessible evidence; prevent duplicate work and make failed routing visible. |
| E10 / C29, C44 | Specialist PR Security Review uses changed code, supporting context and threat guidance, with separate triggers and thresholds. [Security Review](https://learn.chatgpt.com/docs/security/security-review) | Add a specialist pass to a general work review: IT access, fraud indicators, financial calculations or another defined subject. | Supply practice-specific criteria and evidence expectations; preserve uncertainty and coordinate overlapping findings from different specialist passes. Professional assessment remains distinct from agent output. |
| E11 / C29 | The Security workbench supports codebase scans, change scans, progress, saved findings and repository history. [Workbench](https://learn.chatgpt.com/docs/security/plugin/workbench) | Review a selected engagement/process evidence collection or only its changes; return to its previous runs, findings and coverage. | Give scan scope meaning in audit terms: period, entity, population, procedure and exclusions. A saved run is not automatically a complete engagement record. |
| E12 / C29 | Deep codebase scans repeat review over a selected codebase; change scans are a separate mode. [Workbench](https://learn.chatgpt.com/docs/security/plugin/workbench) | Re-examine a difficult evidence set through additional scoped passes or focused analysis while retaining a visible budget and stopping rule. | Make added coverage and unresolved questions explicit. Repeated passes by similar agents do not create independent corroboration or statistical assurance. |
| E13 / C29 | Backlog triage assesses existing claims using read-only static source analysis; runtime validation is separate. [Backlog triage](https://learn.chatgpt.com/docs/security/plugin/triage-backlog) | Reassess an inherited exceptions/findings backlog against available evidence and rank the next work; request additional testing when records cannot resolve a claim. | Preserve original finding IDs and prior disposition, distinguish unsupported from disproved, and explain changes in priority or status. |
| E14 / C29, C21 | Generate, inspect, apply and verify a patch are separate steps; verification does not automatically close a finding. [Fix and verify](https://learn.chatgpt.com/docs/security/plugin/fix-findings) | Prepare a revised calculation or remediation proposal, inspect changes, apply authorised edits, then retest the original issue and intended behavior. | Track affected evidence and version; distinguish a corrected artifact from an operating control proven effective. Record approval and closure authority separately. |
| E15 / C29, C15 | Security hardening compares structural options grounded in findings and constraints before implementation is requested. [Hardening](https://learn.chatgpt.com/docs/security/plugin/security-hardening) | Develop advisory options for improving a control or process, showing expected benefit, residual risk and implementation effort. | Preserve factual findings separately from proposed designs; explain management responsibilities and the assumptions behind each option. |
| E16 / C29, C31 | Vulnerability writeups build self-contained reports from findings and supporting source/evidence. [Reports](https://learn.chatgpt.com/docs/security/plugin/vulnerability-reports) | Draft a self-contained audit observation or issue paper with criteria, condition, evidence, impact and proposed action as the method requires. | Use the practitioner's terminology and materiality/rating method; show unsupported claims and avoid inventing cause, impact, agreement or approval. |
| E17 / C29, C31, C34 | Security results can be exported; tracking prepares selected findings for issue systems with duplicate checks and approval before writing. [Export and track](https://learn.chatgpt.com/docs/security/plugin/export-findings) | Produce an exceptions workbook or send selected reviewed findings to the chosen audit/ticket system while preserving the originating work. | Preserve evidence references, identities, statuses and destination IDs; inspect duplicates and reconcile write outcomes. Portable output and remote writeback remain separate paths. |
| E18 / C29, C43 | Bulk security campaigns take selected repositories or a revision-pinned inventory, preserve individual results and support resume. [Bulk scans](https://learn.chatgpt.com/docs/security/cli/bulk-scans) | Run a common procedure across approved branches, entities, periods or evidence packages and resume an interrupted campaign. | Pin each entity's input version; report missing/failed entities and actual coverage separately from successful results; reconcile the population used. |
| E19 / C29, C43 | The Security SDK exposes typed findings, coverage, artifact locations, progress, budgets and cancellation for scans. [Security SDK](https://learn.chatgpt.com/docs/security/sdk) | Let approved internal processes invoke an audit-review job and consume structured findings and coverage alongside readable workpapers. | Define stable audit result schemas, procedure versions, result provenance and partial-failure semantics. Reusing an orchestration pattern does not make its security analysis an audit test. |
| E20 / C25, C26, C35 | Where available, Codex's built-in browser discovers tools offered by the current website through WebMCP. [Site tools](https://learn.chatgpt.com/docs/webmcp) | Work with an evidence portal, dashboard or document page using its exposed actions while the auditor sees the same page. | Preserve page/source identity and permission boundaries; verify changed state. Tools can disappear on navigation. Current support excludes iframe tools and declarative form APIs; availability is conditional. |

The direct event-driven audit-review pattern in E02/E05 belongs in the first mirror layer. Its useful implementation still needs the relevant business event, evidence and procedure adapters. It is not postponed to V2 merely because its audit application is sophisticated. Conversely, configuring a review event does not establish complete monitoring of all business changes.

## Public component patterns behind the mirrors

These six rows preserve the earlier component inventory without counting implementation packages as extra user features. They are a source-oriented conceptual mapping, not an architecture selection or a fresh trace through a pinned upstream source revision. References and previous evidence are in [CODEX_CAPABILITY_CATALOG.md](CODEX_CAPABILITY_CATALOG.md).

| Public component group | Preserved function for the auditor experience | Domain adaptation to examine |
| --- | --- | --- |
| `codex-rs/core/` | Continue the agent's context/tool/result loop for a scoped audit task. | Audit-oriented task guidance, supported tools, evidence-aware output checks and clear separation of factual results from conclusions. |
| `codex-rs/app-server/` and `app-server-protocol/` | Connect a rich audit client to threads, turns, progress, tools and decisions. | Render workpapers, calculations and evidence references; expose the actual authority of each operation. Reuse eligibility and API maturity remain separate checks. |
| `codex-rs/exec-server/` and sandbox modules | Execute permitted analysis with visible process results and limits. | Approved analytical runtimes, scoped inputs/outputs and cancellation behavior appropriate to files and data sources. |
| Memory, thread-store, state and rollout-trace components | Retain work continuity and diagnostics across supported runs. | Distinguish conversation recall, reusable methods and evidence records; preserve source links when context is compacted. |
| CLI/TUI and SDK components | Offer attended, batch and programmatic access to the same work capabilities. | Audit task vocabulary and structured output contracts; retain advanced scripting for practitioners who use it. |
| Documentation and protocol schemas | Define inspectable requests, results and lifecycle events. | Document audit-oriented operations, result meanings, limitations and error states. |

## Layer 1 adaptations and the later V2 layer

Layer 1 preserves a Codex capability's role and working loop while adapting its inputs, vocabulary, tools and reviewable outputs to auditors. Examples include workbook-aware change review, procedure-specific skills, evidence links, specialist review and triggered control testing. Required changes for those equivalents are listed in every feature card; technical effort does not decide whether a capability belongs in the mirror.

The user has assigned built-in audit-record mode to V2. V1 is the full Codex-derived workbench using external audit records and supported working files. Native authoritative record identities, relationships, sign-off history, controlled amendments, retention and export accompany the V2 mode; V1 retains work history, evidence references, review assistance and external delivery. Broad audit-universe/function management and a general workflow builder remain other, unprioritised V2 candidates. The [product brief](PRODUCT_BRIEF_V0_1.md) records this phase boundary; detailed sequencing within each phase remains open.

The next planning exercise should decide how to realise the mapped experience, using this inventory and the remaining evidence gaps. It should not repeat the already settled choice of whether the product should broadly mirror Codex.

